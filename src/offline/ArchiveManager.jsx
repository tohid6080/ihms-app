import React, { useState, useEffect } from "react";
import { Archive, FileSpreadsheet, Trash2, Users, AlertTriangle, GitBranch, History, Truck, Tag, ShieldAlert } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { sb, sbOk, styles, THEME, getCurrentCompanyId } from "../shared.js";
import { uploadBase64ToStorage, deleteFromStorage, parseStorageUrl } from "./storageUpload.js";
import { fetchStorageSizeMB } from "./dbSizeMonitor.js";
import { DOC_TYPES } from "../personnel/personnelApi.js";
import { loadBowtieCanvas } from "../bowtie/bowtieApi.js";
import { MACHINERY_DOC_TYPES, MACHINE_TYPES, OWNERSHIP_STATUSES, LICENSE_TYPES, TRAFFIC_STATUSES } from "../machinery/machineryApi.js";
import { scaffoldStatusMeta } from "../scaffold/scaffoldApi.js";
import { toJalaliSafe, toJalaliDateTime, jalaliFileTimestamp } from "../personnel/jalaliDate.jsx";
import { buildArchiveZip, fetchAttachmentBytes, safeFileName } from "./archiveZip.js";

function extFromMime(mime) {
  return (mime || "").includes("pdf") ? "pdf" : "jpg";
}

/**
 * Archive system for Personnel, Anomaly Report, and BowTie.
 * See earlier revisions for the approval-gating rationale (unchanged).
 * This revision changes how attachments reach the user:
 *
 *  1. Every date/timestamp field goes through toJalaliSafe()/
 *     toJalaliDateTime() — no Gregorian dates anywhere.
 *  2. Attachments no longer link to Supabase at all. Each archive run
 *     downloads every approved attachment's actual bytes and bundles them,
 *     together with the Excel file, into ONE zip (via archiveZip.js). The
 *     Excel's hyperlinks are RELATIVE paths ("files/xyz.jpg") — they only
 *     resolve correctly once the zip has been extracted, at which point
 *     clicking a link opens the local file directly. No internet, no
 *     Supabase URL, ever, after that point.
 *  3. Every successful archive run is logged to an `archive_log` table
 *     (module, who, when, how many records/files, how much space), and the
 *     Excel/zip filenames are stamped with the Jalali date/time the run
 *     happened (e.g. Personnel_Archive_1405-05-10_14-35.xlsx/.zip) so the
 *     pair is always identifiable and stays matched.
 */

const PERSONNEL_ARCHIVABLE_STATUS = "active";
const ANOMALY_ARCHIVABLE_STATUS = "Closed";
const BOWTIE_ARCHIVABLE_STATUSES = ["approved", "archived"];

function isLegacyBase64(v) {
  return typeof v === "string" && v.startsWith("data:");
}

// ================= تاریخچه‌ی آرشیو =================

async function logArchiveOperation({ module, performedBy, recordCount, fileCount, totalSizeMb }) {
  try {
    await sb("archive_log", {
      method: "POST",
      body: JSON.stringify([{ module, performed_by: performedBy || "", record_count: recordCount, file_count: fileCount, total_size_mb: totalSizeMb }]),
      prefer: "return=minimal",
    });
  } catch {
    // logging is best-effort; never block the archive itself
  }
}

async function loadLastArchiveLogs() {
  const rows = await sb("archive_log?select=*&order=created_at.desc&limit=10");
  return sbOk(rows) ? rows : [];
}

const MODULE_LABELS = { personnel: "پرسنل", anomaly: "آنومالی", bowtie: "BowTie", machinery: "ماشین‌آلات", scaffold: "داربست", hcms: "HCMS" };

// ================= Personnel =================

async function loadArchivablePersonnel(currentUser) {
  const companyFilter = getCurrentCompanyId() ? `&company_id=eq.${getCurrentCompanyId()}` : "";
  const contractorFilter = currentUser?.role === "CONTRACTOR" ? `&contractor_name=eq.${encodeURIComponent(currentUser.name)}` : "";
  const rows = await sb(`personnel?status=eq.${PERSONNEL_ARCHIVABLE_STATUS}&select=*&order=updated_at.asc${companyFilter}${contractorFilter}`);
  return sbOk(rows) ? rows : [];
}
async function loadDocsForPersonnel(personnelIds) {
  if (personnelIds.length === 0) return [];
  const rows = await sb(`personnel_documents?personnel_id=in.(${personnelIds.join(",")})&select=*`);
  return sbOk(rows) ? rows : [];
}

async function buildPersonnelArchive(setProgress, performedBy, currentUser) {
  const personnel = await loadArchivablePersonnel(currentUser);
  const docs = await loadDocsForPersonnel(personnel.map((p) => p.id));
  const docsByPersonnel = {};
  docs.forEach((d) => {
    if (!docsByPersonnel[d.personnel_id]) docsByPersonnel[d.personnel_id] = {};
    docsByPersonnel[d.personnel_id][d.doc_type] = d;
  });

  const docUrls = {};
  const docRelativePaths = {};
  const attachments = [];
  let totalBytes = 0;

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    setProgress(`آماده‌سازی مدارک پرسنل (${i + 1}/${docs.length})...`);
    if (d.status !== "approved") { docUrls[d.id] = null; continue; }
    if (isLegacyBase64(d.file_data)) {
      try {
        const ext = extFromMime(d.mime_type);
        const url = await uploadBase64ToStorage("personnel-documents", `${d.id}.${ext}`, d.file_data, d.mime_type || "image/jpeg");
        await sb(`personnel_documents?id=eq.${d.id}`, { method: "PATCH", body: JSON.stringify({ file_data: url }), prefer: "return=minimal" });
        docUrls[d.id] = url;
      } catch { docUrls[d.id] = null; }
    } else {
      docUrls[d.id] = d.file_data || null;
    }
    if (docUrls[d.id]) {
      const bytes = await fetchAttachmentBytes(docUrls[d.id]);
      if (bytes) {
        const person = personnel.find((p) => p.id === d.personnel_id);
        const docLabel = DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type;
        const ext = extFromMime(d.mime_type);
        const relPath = `files/${safeFileName(person?.full_name || d.personnel_id)}-${safeFileName(docLabel)}-${d.id.slice(-6)}.${ext}`;
        attachments.push({ relativePath: relPath, content: bytes });
        docRelativePaths[d.id] = relPath;
        totalBytes += bytes.byteLength || 0;
      }
    }
  }

  setProgress("در حال ساخت فایل اکسل پرسنل...");

  const headers = [
    "ردیف", "نام و نام خانوادگی", "کد ملی", "پیمانکار", "عنوان شغلی", "شماره تماس",
    "تاریخ شروع به کار", "وضعیت", "وضعیت اشتغال", "تاریخ ترک کار / تسویه حساب",
    "نیازمند تأیید صلاحیت", "وضعیت صلاحیت", "یادداشت صلاحیت",
    "مسیر طب کار", "تاریخ طب کار", "تاریخ انقضای طب کار", "مهلت مراجعه", "مهلت نتیجه",
    "ثبت‌کننده", "تاریخ ایجاد", "تاریخ آخرین تغییر",
    ...DOC_TYPES.map((t) => t.label),
  ];

  const aoa = [headers, ...personnel.map((p, idx) => [
    idx + 1, p.full_name, p.national_code, p.contractor_name, p.job_title, p.phone,
    toJalaliSafe(p.start_date) || "—", p.status,
    p.employment_status === "terminated" ? "ترک کار / تسویه حساب" : "فعال",
    p.employment_status === "terminated" ? (toJalaliSafe(p.termination_date) || "—") : "—",
    p.qualification_required ? "بله" : "خیر", p.qualification_status || "—", p.qualification_note || "—",
    p.occ_health_path || "—", toJalaliSafe(p.occ_health_date) || "—", toJalaliSafe(p.occ_health_expiry) || "—",
    toJalaliSafe(p.occ_health_visit_deadline) || "—", toJalaliSafe(p.occ_health_result_deadline) || "—",
    p.created_by || "—", toJalaliSafe(p.created_at) || "—", toJalaliSafe(p.updated_at) || "—",
    ...DOC_TYPES.map((t) => {
      const d = docsByPersonnel[p.id]?.[t.value];
      if (!d) return "—";
      return docRelativePaths[d.id] ? "مشاهده مدرک" : "تأییدنشده";
    }),
  ])];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  personnel.forEach((p, rowIdx) => {
    DOC_TYPES.forEach((t, colOffset) => {
      const d = docsByPersonnel[p.id]?.[t.value];
      const relPath = d ? docRelativePaths[d.id] : null;
      if (relPath) {
        const cellRef = `${XLSX.utils.encode_col(21 + colOffset)}${rowIdx + 2}`;
        if (ws[cellRef]) ws[cellRef].l = { Target: relPath };
      }
    });
  });
  ws["!cols"] = headers.map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "پرسنل");
  const stamp = jalaliFileTimestamp();
  const excelFileName = `Personnel_Archive_${stamp}.xlsx`;
  setProgress("در حال ساخت فایل ZIP آرشیو...");
  await buildArchiveZip({ workbook: wb, excelFileName, attachments, zipFileName: `Personnel_Archive_${stamp}.zip` });

  const fileCount = attachments.length;
  await logArchiveOperation({ module: "personnel", performedBy, recordCount: personnel.length, fileCount, totalSizeMb: +(totalBytes / 1024 / 1024).toFixed(2) });

  return { recordIds: personnel.map((p) => p.id), docIds: docs.map((d) => d.id), docUrls };
}

async function deletePersonnelArchive(archived, setProgress) {
  for (const id of archived.docIds) {
    setProgress("در حال حذف مدارک...");
    const url = archived.docUrls[id];
    const parsed = url ? parseStorageUrl(url) : null;
    if (parsed) { try { await deleteFromStorage(parsed.bucket, parsed.path); } catch { /* continue */ } }
    await sb(`personnel_documents?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
  for (const id of archived.recordIds) {
    setProgress("در حال حذف پرسنل...");
    await sb(`personnel?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

// ================= Anomaly =================

async function loadArchivableAnomalies(currentUser) {
  const companyFilter = getCurrentCompanyId() ? `&company_id=eq.${getCurrentCompanyId()}` : "";
  const contractorFilter = currentUser?.role === "CONTRACTOR" ? `&contractor=eq.${encodeURIComponent(currentUser.name)}` : "";
  const rows = await sb(`anomalies?status=eq.${ANOMALY_ARCHIVABLE_STATUS}&select=*&order=close_date.asc${companyFilter}${contractorFilter}`);
  return sbOk(rows) ? rows : [];
}
async function loadPhotosForAnomalies(anomalyIds) {
  if (anomalyIds.length === 0) return [];
  const rows = await sb(`anomaly_photos?anomaly_id=in.(${anomalyIds.join(",")})&select=*`);
  return sbOk(rows) ? rows : [];
}

async function buildAnomalyArchive(setProgress, performedBy, currentUser) {
  const anomalies = await loadArchivableAnomalies(currentUser);
  const photos = await loadPhotosForAnomalies(anomalies.map((a) => a.id));
  const photosByAnomaly = {};
  photos.forEach((p) => {
    if (!photosByAnomaly[p.anomaly_id]) photosByAnomaly[p.anomaly_id] = { report: [], fix: [] };
    photosByAnomaly[p.anomaly_id][p.stage === "report" ? "report" : "fix"].push(p);
  });

  const photoRelativePaths = {};
  const photoUrls = {};
  const attachments = [];
  let totalBytes = 0;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    setProgress(`آماده‌سازی عکس‌های آنومالی (${i + 1}/${photos.length})...`);
    let url;
    if (isLegacyBase64(p.photo)) {
      try {
        url = await uploadBase64ToStorage("anomaly-photos", `${p.id}.jpg`, p.photo, "image/jpeg");
        await sb(`anomaly_photos?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ photo: url }), prefer: "return=minimal" });
      } catch { url = null; }
    } else {
      url = p.photo || null;
    }
    photoUrls[p.id] = url;
    if (url) {
      const bytes = await fetchAttachmentBytes(url);
      if (bytes) {
        const anomaly = anomalies.find((a) => a.id === p.anomaly_id);
        const stageLabel = p.stage === "report" ? "گزارش" : "اصلاح";
        const relPath = `files/${safeFileName(anomaly?.tracking_number || p.anomaly_id)}-${stageLabel}-${p.id.slice(-6)}.jpg`;
        attachments.push({ relativePath: relPath, content: bytes });
        photoRelativePaths[p.id] = relPath;
        totalBytes += bytes.byteLength || 0;
      }
    }
  }

  setProgress("در حال ساخت فایل اکسل آنومالی...");

  // دقیقاً همان ۲۳ ستون و همان ترتیب فایل نمونه‌ی پیوستی — بدون «زیرپیمانکار»
  // و «موانع» که در فرمت درخواستی وجود نداشتند.
  const headers = [
    "ردیف", "شماره پیگیری", "پروژه", "پیمانکار", "محل/ناحیه", "تاریخ", "ساعت",
    "سطح ریسک", "دسته‌بندی", "فرمت", "شرح کامل آنومالی", "اقدام اصلاحی (پیمانکار)",
    "پیگیری‌کننده", "ثبت‌کننده", "وضعیت", "تاریخ بسته‌شدن", "اثربخشی", "یادداشت بررسی", "تاریخ ثبت",
    "عکس گزارش ۱", "عکس گزارش ۲", "عکس اقدام اصلاحی ۱", "عکس اقدام اصلاحی ۲",
  ];
  // عرض هر ستون، دقیقاً برداشت‌شده از فایل نمونه (واحد «character width» اکسل)
  const colWidths = [9.86, 25, 21.71, 15.29, 19, 15.71, 21.71, 14.29, 18.71, 16.86, 41.71, 15.71, 19.43, 10, 27.71, 20.43, 19.86, 27.57, 23.14, 25.14, 14.86, 18, 18];

  // نسخه‌ی رایگان کتابخانه‌ی xlsx امکان نوشتن استایل سلول (رنگ/فونت) را
  // ندارد؛ برای تطبیق دقیق ظاهری با فایل نمونه (تیتر خاکستری، هدر نارنجی،
  // جهت راست‌به‌چپ واقعی شیت) از ExcelJS استفاده می‌شود — فقط همین‌جا،
  // بقیه‌ی ماژول‌های آرشیو دست‌نخورده با همان xlsx قبلی کار می‌کنند.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("لیست آنومالی ها", { views: [{ rightToLeft: true, state: "frozen", xSplit: 3, ySplit: 2 }] });

  ws.columns = colWidths.map((w) => ({ width: w }));

  // ردیف ۱: عنوان — دقیقاً متن فایل نمونه، پس‌زمینه‌ی خاکستری، فونت درشت
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "لیست  گزارش شرایط و اعمال ناایمن شرکت ........";
  titleCell.font = { name: "B Mitra", bold: true, size: 22 };
  titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFBFBF" } };
  ws.getRow(1).height = 55;

  // ردیف ۲: هدر ستون‌ها — پس‌زمینه‌ی نارنجی، بولد، وسط‌چین، دورخط نازک
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "B Nazanin", bold: true, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4B183" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  headerRow.height = 32;

  // ردیف‌های داده — از ردیف ۳ به بعد
  anomalies.forEach((a, idx) => {
    const ph = photosByAnomaly[a.id] || { report: [], fix: [] };
    const rowIdx = idx + 3;
    const values = [
      idx + 1, a.tracking_number, a.project, a.contractor, a.area, toJalaliSafe(a.date) || "—", a.time,
      a.risk_level, a.category, a.format, a.description, a.corrective_action,
      a.follower, a.sender, a.status, toJalaliSafe(a.close_date) || "—", a.effectiveness || "—", a.review_note || "—", toJalaliDateTime(a.created_at) || "—",
    ];
    const row = ws.getRow(rowIdx);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v ?? "—";
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    // ۴ ستون عکس (۲۰ تا ۲۳) — لینک نسبی به داخل پوشه‌ی files/ همان zip
    const photoCells = [
      [20, ph.report[0] ? photoRelativePaths[ph.report[0].id] : null],
      [21, ph.report[1] ? photoRelativePaths[ph.report[1].id] : null],
      [22, ph.fix[0] ? photoRelativePaths[ph.fix[0].id] : null],
      [23, ph.fix[1] ? photoRelativePaths[ph.fix[1].id] : null],
    ];
    photoCells.forEach(([col, relPath]) => {
      const cell = row.getCell(col);
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (relPath) {
        cell.value = { text: "مشاهده عکس", hyperlink: relPath };
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      } else {
        cell.value = "—";
      }
    });
  });

  const excelBuffer = await wb.xlsx.writeBuffer();
  const stamp = jalaliFileTimestamp();
  const excelFileName = `Anomaly_Archive_${stamp}.xlsx`;
  setProgress("در حال ساخت فایل ZIP آرشیو...");
  await buildArchiveZip({ excelBuffer, excelFileName, attachments, zipFileName: `Anomaly_Archive_${stamp}.zip` });

  const fileCount = photos.filter((p) => photoUrls[p.id]).length;
  await logArchiveOperation({ module: "anomaly", performedBy, recordCount: anomalies.length, fileCount, totalSizeMb: +(totalBytes / 1024 / 1024).toFixed(2) });

  return { recordIds: anomalies.map((a) => a.id), photoIds: photos.map((p) => p.id), photoUrls };
}

async function deleteAnomalyArchive(archived, setProgress) {
  for (const id of archived.photoIds) {
    setProgress("در حال حذف عکس‌ها...");
    const url = archived.photoUrls[id];
    const parsed = url ? parseStorageUrl(url) : null;
    if (parsed) { try { await deleteFromStorage(parsed.bucket, parsed.path); } catch { /* continue */ } }
    await sb(`anomaly_photos?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
  for (const id of archived.recordIds) {
    setProgress("در حال حذف آنومالی‌ها...");
    await sb(`anomalies?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

// ================= BowTie =================

async function loadArchivableBowties() {
  const companyFilter = getCurrentCompanyId() ? `&company_id=eq.${getCurrentCompanyId()}` : "";
  const rows = await sb(`bowties?status=in.(${BOWTIE_ARCHIVABLE_STATUSES.join(",")})&select=*&order=updated_at.asc${companyFilter}`);
  return sbOk(rows) ? rows : [];
}

async function buildBowtieArchive(setProgress, diagramUrls, performedBy) {
  const bowties = await loadArchivableBowties();
  const allThreats = [], allCons = [], allBarriers = [], allFactors = [], allControls = [];

  for (let i = 0; i < bowties.length; i++) {
    const b = bowties[i];
    setProgress(`بارگذاری اجزای BowTie (${i + 1}/${bowties.length})...`);
    const canvas = await loadBowtieCanvas(b.id);
    canvas.threats.forEach((t) => allThreats.push({ bowtieTitle: b.title, ...t }));
    canvas.consequences.forEach((c) => allCons.push({ bowtieTitle: b.title, ...c }));
    canvas.barriers.forEach((br) => allBarriers.push({ bowtieTitle: b.title, ...br }));
    canvas.escalationFactors.forEach((f) => allFactors.push({ bowtieTitle: b.title, ...f }));
    canvas.escalationControls.forEach((c) => allControls.push({ bowtieTitle: b.title, ...c }));
  }

  setProgress("در حال آماده‌سازی دیاگرام‌های ضمیمه‌شده...");

  const diagramRelativePaths = {};
  const attachments = [];
  let totalBytes = 0;
  for (const b of bowties) {
    if (!diagramUrls[b.id]) continue;
    const bytes = await fetchAttachmentBytes(diagramUrls[b.id]);
    if (bytes) {
      const relPath = `files/${safeFileName(b.title)}-دیاگرام-${b.id.slice(-6)}.pdf`;
      attachments.push({ relativePath: relPath, content: bytes });
      diagramRelativePaths[b.id] = relPath;
      totalBytes += bytes.byteLength || 0;
    }
  }

  setProgress("در حال ساخت فایل اکسل BowTie...");

  const mainHeaders = ["ردیف", "عنوان", "خطر (Hazard)", "رویداد اصلی (Top Event)", "سایت", "بخش", "وضعیت", "نسخه", "ثبت‌کننده", "تاریخ ایجاد", "تاریخ آخرین تغییر", "دیاگرام PDF"];
  const mainAoa = [mainHeaders, ...bowties.map((b, idx) => [
    idx + 1, b.title, b.hazard, b.top_event, b.site || "—", b.department || "—", b.status, b.version, b.created_by || "—",
    toJalaliDateTime(b.created_at) || "—", toJalaliDateTime(b.updated_at) || "—",
    diagramRelativePaths[b.id] ? "مشاهده دیاگرام" : "—",
  ])];
  const wsMain = XLSX.utils.aoa_to_sheet(mainAoa);
  bowties.forEach((b, rowIdx) => {
    if (diagramRelativePaths[b.id]) {
      const cellRef = `${XLSX.utils.encode_col(11)}${rowIdx + 2}`;
      if (wsMain[cellRef]) wsMain[cellRef].l = { Target: diagramRelativePaths[b.id] };
    }
  });
  wsMain["!cols"] = mainHeaders.map(() => ({ wch: 16 }));

  const wsThreats = XLSX.utils.json_to_sheet(allThreats.map((t) => ({ "BowTie": t.bowtieTitle, "تهدید": t.label, "ترتیب": t.orderIndex })));
  const wsCons = XLSX.utils.json_to_sheet(allCons.map((c) => ({ "BowTie": c.bowtieTitle, "پیامد": c.label, "ترتیب": c.orderIndex })));
  const wsBarriers = XLSX.utils.json_to_sheet(allBarriers.map((b) => ({
    "BowTie": b.bowtieTitle, "طرف": b.side === "preventive" ? "پیشگیرانه" : "بازیابی", "عنوان مانع": b.label,
    "مسئول": b.owner || "—", "درجه اهمیت": b.criticality, "وضعیت": b.status,
    "کنترل بحرانی": b.isCriticalControl ? "بله" : "خیر", "تاریخ آخرین راستی‌آزمایی": toJalaliSafe(b.verificationDate) || "—",
  })));
  const wsEscalation = XLSX.utils.json_to_sheet([
    ...allFactors.map((f) => ({ "BowTie": f.bowtieTitle, "نوع": "عامل تشدیدکننده", "عنوان": f.label, "مسئول/وضعیت": "—" })),
    ...allControls.map((c) => ({ "BowTie": c.bowtieTitle, "نوع": "کنترل تشدید", "عنوان": c.label, "مسئول/وضعیت": `${c.owner || "—"} / ${c.status || "—"}` })),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMain, "BowTie");
  XLSX.utils.book_append_sheet(wb, wsThreats, "تهدیدها");
  XLSX.utils.book_append_sheet(wb, wsCons, "پیامدها");
  XLSX.utils.book_append_sheet(wb, wsBarriers, "موانع");
  XLSX.utils.book_append_sheet(wb, wsEscalation, "عوامل و کنترل تشدید");
  const stamp = jalaliFileTimestamp();
  const excelFileName = `BowTie_Archive_${stamp}.xlsx`;
  setProgress("در حال ساخت فایل ZIP آرشیو...");
  await buildArchiveZip({ workbook: wb, excelFileName, attachments, zipFileName: `BowTie_Archive_${stamp}.zip` });

  const fileCount = bowties.filter((b) => diagramUrls[b.id]).length;
  await logArchiveOperation({ module: "bowtie", performedBy, recordCount: bowties.length, fileCount, totalSizeMb: +(totalBytes / 1024 / 1024).toFixed(2) });

  return { recordIds: bowties.map((b) => b.id) };
}

async function deleteBowtieArchive(archived, setProgress) {
  for (const id of archived.recordIds) {
    setProgress("در حال حذف BowTie و اجزای آن...");
    const barrierRows = await sb(`bowtie_barriers?bowtie_id=eq.${id}&select=id`);
    const barrierIds = (sbOk(barrierRows) ? barrierRows : []).map((r) => r.id);
    if (barrierIds.length > 0) {
      const factorRows = await sb(`bowtie_escalation_factors?barrier_id=in.(${barrierIds.join(",")})&select=id`);
      const factorIds = (sbOk(factorRows) ? factorRows : []).map((r) => r.id);
      if (factorIds.length > 0) {
        await sb(`bowtie_escalation_controls?escalation_factor_id=in.(${factorIds.join(",")})`, { method: "DELETE", prefer: "return=minimal" });
      }
      await sb(`bowtie_escalation_factors?barrier_id=in.(${barrierIds.join(",")})`, { method: "DELETE", prefer: "return=minimal" });
    }
    await sb(`bowtie_barriers?bowtie_id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    await sb(`bowtie_threats?bowtie_id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    await sb(`bowtie_consequences?bowtie_id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    await sb(`bowties?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

// ================= ماشین‌آلات =================
// فقط ماشین‌آلات «تأییدشده» آرشیو می‌شوند — مطابق همان قانون تأیید قبل از
// آرشیو که برای بقیه‌ی ماژول‌ها اعمال کردیم.

const MACHINERY_ARCHIVABLE_STATUS = "approved";

async function loadArchivableMachinery(currentUser) {
  const companyFilter = getCurrentCompanyId() ? `&company_id=eq.${getCurrentCompanyId()}` : "";
  const contractorFilter = currentUser?.role === "CONTRACTOR" ? `&contractor_name=eq.${encodeURIComponent(currentUser.name)}` : "";
  const rows = await sb(`machinery?approval_status=eq.${MACHINERY_ARCHIVABLE_STATUS}&select=*&order=updated_at.asc${companyFilter}${contractorFilter}`);
  return sbOk(rows) ? rows : [];
}
async function loadDocsForMachinery(machineryIds) {
  if (machineryIds.length === 0) return [];
  const rows = await sb(`machinery_documents?machinery_id=in.(${machineryIds.join(",")})&select=*`);
  return sbOk(rows) ? rows : [];
}

async function buildMachineryArchive(setProgress, performedBy, currentUser) {
  const machinery = await loadArchivableMachinery(currentUser);
  const docs = await loadDocsForMachinery(machinery.map((m) => m.id));
  const docsByMachine = {};
  docs.forEach((d) => {
    if (!docsByMachine[d.machinery_id]) docsByMachine[d.machinery_id] = {};
    docsByMachine[d.machinery_id][d.doc_type] = d;
  });

  const docRelativePaths = {};
  const attachments = [];
  let totalBytes = 0;

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    setProgress(`آماده‌سازی مدارک ماشین‌آلات (${i + 1}/${docs.length})...`);
    let url = d.file_data;
    if (isLegacyBase64(d.file_data)) {
      try {
        const ext = extFromMime(d.mime_type);
        url = await uploadBase64ToStorage("machinery-documents", `${d.id}.${ext}`, d.file_data, d.mime_type || "image/jpeg");
        await sb(`machinery_documents?id=eq.${d.id}`, { method: "PATCH", body: JSON.stringify({ file_data: url }), prefer: "return=minimal" });
      } catch { url = null; }
    }
    if (url) {
      const bytes = await fetchAttachmentBytes(url);
      if (bytes) {
        const machine = machinery.find((m) => m.id === d.machinery_id);
        const docLabel = MACHINERY_DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type;
        const ext = extFromMime(d.mime_type);
        const relPath = `files/${safeFileName(machine?.plate_number || machine?.machine_name || d.machinery_id)}-${safeFileName(docLabel)}-${d.id.slice(-6)}.${ext}`;
        attachments.push({ relativePath: relPath, content: bytes });
        docRelativePaths[d.id] = relPath;
        totalBytes += bytes.byteLength || 0;
      }
    }
  }

  setProgress("در حال ساخت فایل اکسل ماشین‌آلات...");

  // ستون‌های ۱ تا ۱۳ دقیقاً مطابق فایل Master List HSE پروژه (ترتیب و عناوین
  // بدون تغییر)؛ ستون‌های بعدی (نوع ماشین، جانشین راننده، تأیید، مدارک) طبق
  // درخواست، بدون به‌هم‌زدن ساختار اصلی، به انتهای فایل اضافه شده‌اند.
  const headers = [
    "ردیف", "پروژه/ شرکت", "نام ماشین آلات", "شماره پلاک-شاسی(کارت ماشین)", "سال ساخت",
    "وضعیت مالکیت", "تاریخ بیمه نامه", "تاریخ معاینه فنی یا اخذ سرتیفیکیت", "نام راننده",
    "نوع گواهینامه(ویژه/پایه یک)", "کد دستگاه", "وضعیت تردد", "رفتار ناایمن",
    "نوع ماشین‌آلات", "جانشین راننده", "وضعیت تأیید کارفرما", "یادداشت کارفرما",
    ...MACHINERY_DOC_TYPES.map((t) => t.label),
    "ثبت‌کننده", "تاریخ ایجاد", "تاریخ آخرین تغییر",
  ];

  const docsStartCol = 17; // ۰-ایندکس ستون اول مدارک (بعد از ۱۷ ستون قبلی)

  const aoa = [headers, ...machinery.map((m, idx) => [
    idx + 1, m.project, m.machine_name,
    `${m.plate_number || "—"} - ${m.chassis_number || "—"}`,
    m.manufacture_year, OWNERSHIP_STATUSES.find((s) => s.value === m.ownership_status)?.label || m.ownership_status,
    toJalaliSafe(m.insurance_expiry) || "—", toJalaliSafe(m.inspection_expiry) || "—",
    m.driver_name, LICENSE_TYPES.find((t) => t.value === m.driver_license_type)?.label || m.driver_license_type,
    m.device_code, TRAFFIC_STATUSES.find((s) => s.value === m.traffic_status)?.label || m.traffic_status,
    m.unsafe_behavior || "—",
    MACHINE_TYPES.find((t) => t.value === m.machine_type)?.label || m.machine_type,
    m.backup_driver_name || "—", "تأیید شده", m.review_note || "—",
    ...MACHINERY_DOC_TYPES.map((t) => {
      const d = docsByMachine[m.id]?.[t.value];
      return d && docRelativePaths[d.id] ? "مشاهده مدرک" : "—";
    }),
    m.created_by || "—", toJalaliDateTime(m.created_at) || "—", toJalaliDateTime(m.updated_at) || "—",
  ])];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  machinery.forEach((m, rowIdx) => {
    MACHINERY_DOC_TYPES.forEach((t, colOffset) => {
      const d = docsByMachine[m.id]?.[t.value];
      const relPath = d ? docRelativePaths[d.id] : null;
      if (relPath) {
        const cellRef = `${XLSX.utils.encode_col(docsStartCol + colOffset)}${rowIdx + 2}`;
        if (ws[cellRef]) ws[cellRef].l = { Target: relPath };
      }
    });
  });
  ws["!cols"] = headers.map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ماشین‌آلات");
  const stamp = jalaliFileTimestamp();
  const excelFileName = `Machinery_Archive_${stamp}.xlsx`;
  setProgress("در حال ساخت فایل ZIP آرشیو...");
  await buildArchiveZip({ workbook: wb, excelFileName, attachments, zipFileName: `Machinery_Archive_${stamp}.zip` });

  const fileCount = attachments.length;
  await logArchiveOperation({ module: "machinery", performedBy, recordCount: machinery.length, fileCount, totalSizeMb: +(totalBytes / 1024 / 1024).toFixed(2) });

  return { recordIds: machinery.map((m) => m.id), docIds: docs.map((d) => d.id) };
}

async function deleteMachineryArchive(archived, setProgress) {
  for (const id of archived.docIds) {
    setProgress("در حال حذف مدارک ماشین‌آلات...");
    const docRows = await sb(`machinery_documents?id=eq.${id}&select=file_data`);
    const url = sbOk(docRows) && docRows[0] ? docRows[0].file_data : null;
    const parsed = url ? parseStorageUrl(url) : null;
    if (parsed) { try { await deleteFromStorage(parsed.bucket, parsed.path); } catch { /* ادامه بده */ } }
    await sb(`machinery_documents?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
  for (const id of archived.recordIds) {
    setProgress("در حال حذف ماشین‌آلات...");
    await sb(`machinery?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

// ================= داربست =================
// فقط تگ‌هایی که حداقل یک‌بار واقعاً صادر شده‌اند (issueDate دارند) آرشیو
// می‌شوند — چه هنوز فعال باشند چه برچیده شده باشند — دقیقاً مطابق سبک فایل
// «آمار تگ داربست» که هر دو حالت را با هم در یک لیست پیوسته نگه می‌داشت.

async function loadArchivableScaffoldTags(currentUser) {
  const companyFilter = getCurrentCompanyId() ? `&company_id=eq.${getCurrentCompanyId()}` : "";
  const contractorFilter = currentUser?.role === "CONTRACTOR" ? `&contractor_name=eq.${encodeURIComponent(currentUser.name)}` : "";
  const rows = await sb(`scaffold_tags?issue_date=not.is.null&select=*&order=created_at.asc${companyFilter}${contractorFilter}`);
  return sbOk(rows) ? rows : [];
}
async function loadPhotosForScaffoldTags(tagIds) {
  if (tagIds.length === 0) return [];
  const rows = await sb(`scaffold_tag_photos?scaffold_tag_id=in.(${tagIds.join(",")})&select=*`);
  return sbOk(rows) ? rows : [];
}

async function buildScaffoldArchive(setProgress, performedBy, currentUser) {
  const tags = await loadArchivableScaffoldTags(currentUser);
  const photos = await loadPhotosForScaffoldTags(tags.map((t) => t.id));
  const photosByTag = {};
  photos.forEach((p) => {
    if (!photosByTag[p.scaffold_tag_id]) photosByTag[p.scaffold_tag_id] = [];
    photosByTag[p.scaffold_tag_id].push(p);
  });

  const photoRelativePaths = {};
  const attachments = [];
  let totalBytes = 0;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    setProgress(`آماده‌سازی عکس‌های داربست (${i + 1}/${photos.length})...`);
    let url = p.file_data;
    if (isLegacyBase64(p.file_data)) {
      try {
        const ext = extFromMime(p.mime_type);
        url = await uploadBase64ToStorage("scaffold-photos", `${p.id}.${ext}`, p.file_data, p.mime_type || "image/jpeg");
        await sb(`scaffold_tag_photos?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ file_data: url }), prefer: "return=minimal" });
      } catch { url = null; }
    }
    if (url) {
      const bytes = await fetchAttachmentBytes(url);
      if (bytes) {
        const tag = tags.find((t) => t.id === p.scaffold_tag_id);
        const ext = extFromMime(p.mime_type);
        const relPath = `files/${safeFileName(tag?.tag_number || p.scaffold_tag_id)}-${p.stage}-${p.id.slice(-6)}.${ext}`;
        attachments.push({ relativePath: relPath, content: bytes });
        photoRelativePaths[p.id] = relPath;
        totalBytes += bytes.byteLength || 0;
      }
    }
  }

  setProgress("در حال ساخت فایل اکسل داربست...");

  // نام واقعی شرکت برای تیتر فایل — دقیقاً همان چیزی که در فایل نمونه
  // خواسته شده («لیست تگ داربست شرکت .....» → نام واقعی به‌جای نقطه‌چین‌ها)
  const companyId = getCurrentCompanyId();
  let companyName = "";
  if (companyId) {
    const companyRows = await sb(`companies?id=eq.${companyId}&select=name`);
    companyName = sbOk(companyRows) && companyRows.length > 0 ? companyRows[0].name : "";
  }

  // ستون‌ها دقیقاً مطابق فایل نمونه‌ی پیوستی — همان ترتیب قبلی، بدون تغییر محتوایی
  const headers = [
    "ردیف", "شماره تگ", "موقعیت", "نام شرکت", "تاریخ برپایی داربست", "OK/NOT OK", "تاریخ برچیدن داربست", "توضیحات",
    "وضعیت فعلی", "تاریخ تأیید اولیه", "شرح ایرادات (در صورت وجود)", "عکس‌های محل", "ثبت‌کننده", "تاریخ ایجاد", "تاریخ آخرین تغییر",
  ];
  // عرض هر ستون، برداشت‌شده از فایل نمونه — ستون I («وضعیت فعلی») در خودِ
  // فایل نمونه هم عمداً تقریباً صفر عرض دارد (جمع‌شده، نه حذف‌شده)
  const colWidths = [4.29, 25.86, 46.43, 14.43, 16.57, 16.86, 16.14, 26.43, 0.14, 15.57, 20, 18, 16, 18, 18];
  const photoStartCol = 12; // «عکس‌های محل»

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Scaff tag", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 2 }] });
  ws.columns = colWidths.map((w) => ({ width: w }));

  // ردیف ۱: عنوان با نام واقعی شرکت، پس‌زمینه‌ی خاکستری روشن
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `لیست تگ داربست شرکت ${companyName || "....."}`;
  titleCell.font = { name: "B Nazanin", bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  ws.getRow(1).height = 40;

  // ردیف ۲: هدر ستون‌ها — پس‌زمینه‌ی آبی روشن دقیقاً مطابق فایل نمونه
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "B Nazanin", bold: true, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
    cell.border = { top: { style: "medium" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  headerRow.height = 32;

  // ردیف‌های داده — از ردیف ۳ به بعد
  tags.forEach((t, idx) => {
    const ph = photosByTag[t.id] || [];
    const rowIdx = idx + 3;
    const values = [
      idx + 1, t.tag_number, t.location, t.contractor_name, toJalaliSafe(t.erection_date) || "—",
      "OK", toJalaliSafe(t.removal_date) || "—", t.purpose || "—",
      scaffoldStatusMeta(t.status).label, toJalaliDateTime(t.initial_approved_at) || "—", t.correction_note || "—",
    ];
    const row = ws.getRow(rowIdx);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v ?? "—";
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    const photoCell = row.getCell(photoStartCol);
    photoCell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    photoCell.alignment = { horizontal: "center", vertical: "middle" };
    if (ph.length > 0 && photoRelativePaths[ph[0].id]) {
      photoCell.value = { text: "مشاهده عکس", hyperlink: photoRelativePaths[ph[0].id] };
      photoCell.font = { color: { argb: "FF0563C1" }, underline: true };
    } else {
      photoCell.value = "—";
    }

    ["ثبت‌کننده", "تاریخ ایجاد", "تاریخ آخرین تغییر"].forEach((_, offset) => {
      const col = photoStartCol + 1 + offset;
      const cell = row.getCell(col);
      cell.value = [t.created_by || "—", toJalaliDateTime(t.created_at) || "—", toJalaliDateTime(t.updated_at) || "—"][offset];
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  });

  // فوتر — دقیقاً متن کنترل‌سندی فایل نمونه
  const footerStart = tags.length + 4;
  ws.mergeCells(footerStart, 1, footerStart, headers.length);
  ws.getCell(footerStart, 1).value = "تهیه کننده: سرپرست HSE";
  ws.getCell(footerStart, 1).font = { name: "B Nazanin", bold: true, size: 10 };
  ws.getCell(footerStart, 1).alignment = { horizontal: "right", readingOrder: "rtl" };

  ws.mergeCells(footerStart + 1, 1, footerStart + 1, headers.length);
  ws.getCell(footerStart + 1, 1).value = "توجه : این فرم تحت کنترل واحد QA می‌باشد و هرگونه تغییر در آن غیرمجاز بوده و منوط به اخذ مجوز از واحد QA می‌باشد.";
  ws.getCell(footerStart + 1, 1).font = { name: "B Nazanin", size: 9 };
  ws.getCell(footerStart + 1, 1).alignment = { horizontal: "right", readingOrder: "rtl" };

  const excelBuffer = await wb.xlsx.writeBuffer();
  const stamp = jalaliFileTimestamp();
  const excelFileName = `Scaffold_Archive_${stamp}.xlsx`;
  setProgress("در حال ساخت فایل ZIP آرشیو...");
  await buildArchiveZip({ excelBuffer, excelFileName, attachments, zipFileName: `Scaffold_Archive_${stamp}.zip` });

  const fileCount = attachments.length;
  await logArchiveOperation({ module: "scaffold", performedBy, recordCount: tags.length, fileCount, totalSizeMb: +(totalBytes / 1024 / 1024).toFixed(2) });

  return { recordIds: tags.map((t) => t.id), photoIds: photos.map((p) => p.id) };
}

async function deleteScaffoldArchive(archived, setProgress) {
  for (const id of archived.photoIds) {
    setProgress("در حال حذف عکس‌های داربست...");
    const photoRows = await sb(`scaffold_tag_photos?id=eq.${id}&select=file_data`);
    const url = sbOk(photoRows) && photoRows[0] ? photoRows[0].file_data : null;
    const parsed = url ? parseStorageUrl(url) : null;
    if (parsed) { try { await deleteFromStorage(parsed.bucket, parsed.path); } catch { /* ادامه بده */ } }
    await sb(`scaffold_tag_photos?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
  for (const id of archived.recordIds) {
    setProgress("در حال حذف تگ‌های داربست...");
    await sb(`scaffold_tags?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

// ================= HCMS (ارزیابی ریسک) =================
// فقط ارزیابی‌های «تأییدشده» (status = active) آرشیو می‌شوند — همان قانون
// تأیید قبل از آرشیو که برای بقیه‌ی ماژول‌ها هم اعمال شده. HCMS فایل
// پیوست ندارد، پس این آرشیو فقط اکسل است، بدون ZIP.

const HCMS_ARCHIVABLE_STATUS = "active";

async function loadArchivableHcms() {
  const companyFilter = getCurrentCompanyId() ? `&company_id=eq.${getCurrentCompanyId()}` : "";
  const rows = await sb(`hcms_risk_assessments?status=eq.${HCMS_ARCHIVABLE_STATUS}&select=*&order=updated_at.asc${companyFilter}`);
  return sbOk(rows) ? rows : [];
}

async function buildHcmsArchive(setProgress, performedBy) {
  const records = await loadArchivableHcms();
  setProgress("در حال ساخت فایل اکسل ارزیابی ریسک...");

  const headers = [
    "ردیف", "فرآیند", "فعالیت", "واحد", "تجهیز", "خطر", "جنبه‌های زیست‌محیطی", "علت", "پیامد",
    "کنترل‌های موجود", "الزام قانونی",
    "RPN اولیه - انسان", "RPN اولیه - تجهیزات", "RPN اولیه - محیط‌زیست", "RPN اولیه - اعتبار",
    "سطح ریسک اولیه (کلی)",
    "Permit to Work", "کنترل‌های پیشنهادی", "برنامه بازیابی", "مسئول اجرا",
    "RPN باقیمانده - انسان", "RPN باقیمانده - تجهیزات", "RPN باقیمانده - محیط‌زیست", "RPN باقیمانده - اعتبار",
    "سطح ریسک باقیمانده (کلی)",
    "شرایط اضطرار", "Critical Element", "ثبت‌کننده", "تاریخ ایجاد", "تاریخ آخرین تغییر",
  ];

  const aoa = [headers, ...records.map((r, idx) => [
    idx + 1, r.process || "—", r.activity || "—", r.unit || "—", r.equipment || "—",
    r.hazard || "—", r.environmental_aspect || "—", r.cause || "—", r.consequence || "—",
    r.existing_controls || "—", r.legal_requirement || "—",
    r.initial_rpn_human || "—", r.initial_rpn_equipment || "—", r.initial_rpn_environment || "—", r.initial_rpn_reputation || "—",
    r.initial_level_overall || "—",
    r.permit_to_work || "—", r.proposed_controls || "—", r.recovery_plan || "—", r.responsible_person || "—",
    r.residual_rpn_human || "—", r.residual_rpn_equipment || "—", r.residual_rpn_environment || "—", r.residual_rpn_reputation || "—",
    r.residual_level_overall || "—",
    r.emergency_condition || "—", r.critical_element || "—",
    r.created_by || "—", toJalaliDateTime(r.created_at) || "—", toJalaliDateTime(r.updated_at) || "—",
  ])];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ارزیابی ریسک HCMS");
  const stamp = jalaliFileTimestamp();
  const excelFileName = `HCMS_Archive_${stamp}.xlsx`;
  setProgress("در حال ساخت فایل ZIP آرشیو...");
  await buildArchiveZip({ workbook: wb, excelFileName, attachments: [], zipFileName: `HCMS_Archive_${stamp}.zip` });

  await logArchiveOperation({ module: "hcms", performedBy, recordCount: records.length, fileCount: 0, totalSizeMb: 0 });

  return { recordIds: records.map((r) => r.id) };
}

async function deleteHcmsArchive(archived, setProgress) {
  for (const id of archived.recordIds) {
    setProgress("در حال حذف ارزیابی‌های ریسک...");
    await sb(`hcms_risk_assessments?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

// ================= UI =================

const TABS = [
  { key: "personnel", label: "پرسنل", icon: Users },
  { key: "anomaly", label: "آنومالی", icon: AlertTriangle },
  { key: "bowtie", label: "BowTie", icon: GitBranch },
  { key: "machinery", label: "ماشین‌آلات", icon: Truck },
  { key: "scaffold", label: "داربست", icon: Tag },
  { key: "hcms", label: "HCMS", icon: ShieldAlert },
];

export default function ArchiveManager({ onBack, currentUser }) {
  const isAdmin = currentUser?.role === "ADMIN";
  const [tab, setTab] = useState("personnel");
  const [counts, setCounts] = useState({ personnel: 0, anomaly: 0, bowtie: 0, machinery: 0, scaffold: 0, hcms: 0 });
  const [storageMb, setStorageMb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [exported, setExported] = useState(null);
  const [diagramUrls, setDiagramUrls] = useState({});
  const [lastLogs, setLastLogs] = useState([]);

  const load = async () => {
    setLoading(true);
    const [p, a, b, m, s, h, mb, logs] = await Promise.all([
      loadArchivablePersonnel(), loadArchivableAnomalies(), loadArchivableBowties(), loadArchivableMachinery(), loadArchivableScaffoldTags(), loadArchivableHcms(), fetchStorageSizeMB(), loadLastArchiveLogs(),
    ]);
    setCounts({ personnel: p.length, anomaly: a.length, bowtie: b.length, machinery: m.length, scaffold: s.length, hcms: h.length });
    setStorageMb(mb);
    setLastLogs(logs);
    setExported(null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const performedByLabel = currentUser?.name || currentUser?.username || "نامشخص";

  const attachDiagram = async (bowtieId, file) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const url = await uploadBase64ToStorage("anomaly-photos", `bowtie-diagram-${bowtieId}.pdf`, base64, "application/pdf");
      setDiagramUrls((prev) => ({ ...prev, [bowtieId]: url }));
    } catch {
      alert("آپلود فایل دیاگرام ناموفق بود.");
    }
  };

  const runBuild = async () => {
    setProcessing(true);
    setExported(null);
    try {
      let result;
      if (tab === "personnel") result = await buildPersonnelArchive(setProgressText, performedByLabel, currentUser);
      else if (tab === "anomaly") result = await buildAnomalyArchive(setProgressText, performedByLabel, currentUser);
      else if (tab === "bowtie") result = await buildBowtieArchive(setProgressText, diagramUrls, performedByLabel);
      else if (tab === "machinery") result = await buildMachineryArchive(setProgressText, performedByLabel, currentUser);
      else if (tab === "scaffold") result = await buildScaffoldArchive(setProgressText, performedByLabel, currentUser);
      else result = await buildHcmsArchive(setProgressText, performedByLabel);
      setExported({ module: tab, ...result });
      setLastLogs(await loadLastArchiveLogs());
    } catch (e) {
      alert(`خطا در ساخت آرشیو: ${e?.message || "نامشخص"}`);
    }
    setProcessing(false);
    setProgressText("");
    setStorageMb(await fetchStorageSizeMB());
  };

  const runDelete = async () => {
    if (!isAdmin) { alert("حذف رکوردهای آرشیوشده فقط توسط ادمین قابل‌انجام است."); return; }
    if (!exported) return;
    const n = (exported.recordIds || []).length;
    if (!confirm(`${n} رکورد به‌همراه فایل‌های مرتبط از سرور حذف شود؟ لطفاً مطمئن شوید فایل اکسل را ذخیره کرده‌اید — این عمل قابل بازگشت نیست.`)) return;
    setProcessing(true);
    try {
      if (exported.module === "personnel") await deletePersonnelArchive(exported, setProgressText);
      else if (exported.module === "anomaly") await deleteAnomalyArchive(exported, setProgressText);
      else if (exported.module === "bowtie") await deleteBowtieArchive(exported, setProgressText);
      else if (exported.module === "machinery") await deleteMachineryArchive(exported, setProgressText);
      else if (exported.module === "scaffold") await deleteScaffoldArchive(exported, setProgressText);
      else await deleteHcmsArchive(exported, setProgressText);
    } catch (e) {
      alert(`خطا در حذف: ${e?.message || "نامشخص"}`);
    }
    setProcessing(false);
    setProgressText("");
    await load();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  const currentCount = counts[tab];
  const lastForTab = lastLogs.find((l) => l.module === tab);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Archive size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>آرشیو حرفه‌ای</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 14, lineHeight: 1.8 }}>
        فقط رکوردهای با تأیید نهایی وارد آرشیو می‌شوند (پرسنل: وضعیت «فعال»؛ آنومالی: وضعیت «بسته‌شده»؛ BowTie: «تأییدشده»/«بایگانی»).
        کلیک روی هر لینک، همان فایل را دانلود می‌کند. {isAdmin ? "حذف از سرور فقط بعد از دانلود موفق اکسل و تأیید شما انجام می‌شود." : "خروجی‌گیری برای همه در دسترس است؛ حذف رکوردها از سرور فقط توسط ادمین انجام می‌شود."}
        {storageMb !== null && <> فضای فعلی Storage: <b style={{ color: THEME.text2 }}>{storageMb} مگابایت</b>.</>}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setExported(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 6, flex: "1 1 auto", minWidth: 108, justifyContent: "center",
              background: tab === t.key ? THEME.teal : "#fff", color: tab === t.key ? "#fff" : THEME.text2,
              border: `1.5px solid ${tab === t.key ? THEME.teal : THEME.border}`, borderRadius: 9,
              padding: "9px 8px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font, whiteSpace: "nowrap",
            }}
          >
            <t.icon size={14} /> {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {lastForTab && (
        <div style={{ ...styles.card, width: "auto", marginBottom: 12, background: THEME.tealSoft, border: `1px solid ${THEME.teal}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <History size={14} color={THEME.tealDeep} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.tealDeep }}>آخرین آرشیو انجام‌شده ({MODULE_LABELS[tab]})</span>
          </div>
          <div style={{ fontSize: 11.5, color: THEME.text2, lineHeight: 2 }}>
            <div>تاریخ و ساعت: <b>{toJalaliDateTime(lastForTab.created_at)}</b></div>
            <div>کاربر انجام‌دهنده: <b>{lastForTab.performed_by || "—"}</b></div>
            <div>تعداد رکورد آرشیوشده: <b>{lastForTab.record_count}</b> · تعداد فایل: <b>{lastForTab.file_count}</b></div>
            <div>حجم فایل‌های آرشیوشده: <b>{lastForTab.total_size_mb} مگابایت</b></div>
          </div>
        </div>
      )}

      {tab === "bowtie" && counts.bowtie > 0 && (
        <div style={{ ...styles.card, width: "auto", marginBottom: 12 }}>
          <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0, lineHeight: 1.8 }}>
            دیاگرام BowTie یک کامپوننت تعاملیه که نمی‌تونیم خودکار به PDF تبدیلش کنیم. اگه می‌خوای لینک دیاگرام هم توی اکسل باشه،
            اول از داخل خودِ BowTie (دکمه‌ی «خروجی PDF» که از قبل هست) دیاگرامش رو دستی export کن، بعد اینجا ضمیمه‌ش کن:
          </p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: THEME.teal, cursor: "pointer" }}>
            انتخاب PDF دیاگرام برای یک BowTie خاص (با شناسه‌ی آن در اکسل مطابقت می‌دهیم)
            <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => {
              const bowtieId = prompt("شناسه یا عنوان دقیق BowTie را وارد کنید (باید با ردیف اکسل مطابقت داشته باشد):");
              if (bowtieId) attachDiagram(bowtieId, e.target.files[0]);
            }} />
          </label>
        </div>
      )}

      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ fontSize: 13, color: THEME.text2, marginBottom: 12 }}>
          <b>{currentCount}</b> رکورد آماده‌ی آرشیو در این ماژول موجود است.
        </div>

        <button
          type="button"
          style={{ ...styles.button, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={runBuild}
          disabled={processing || currentCount === 0}
        >
          <FileSpreadsheet size={15} /> {processing && !exported ? progressText : "ساخت و دانلود فایل اکسل آرشیو"}
        </button>

        {isAdmin && exported && exported.module === tab && (
          <button
            type="button"
            style={{ ...styles.button, background: THEME.danger, marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onClick={runDelete}
            disabled={processing}
          >
            <Trash2 size={15} /> {processing ? progressText : `حذف موارد آرشیوشده از سرور (${(exported.recordIds || []).length})`}
          </button>
        )}
        {!isAdmin && exported && exported.module === tab && (
          <p style={{ fontSize: 11.5, color: THEME.text3, marginTop: 10, lineHeight: 1.8 }}>
            فایل با موفقیت دانلود شد. حذف رکوردهای آرشیوشده از سرور فقط توسط ادمین انجام می‌شود.
          </p>
        )}
      </div>

      {currentCount === 0 && (
        <p style={{ color: THEME.text3, marginTop: 14, fontSize: 12.5 }}>
          هیچ رکورد تأییدشده‌ی نهایی در این ماژول برای آرشیو موجود نیست.
        </p>
      )}
    </div>
  );
}
