import * as XLSX from "xlsx";
import { DOC_TYPES, personnelStatusMeta, docStatusMeta, loadPersonnelDocuments } from "./personnelApi.js";
import { isoToJalaliDisplay } from "./jalaliDate.jsx";
import { exportWorkbookNativeAware, exportHtmlReportNativeAware } from "../offline/nativeFile.js";

/**
 * Export helpers for the Personnel module.
 *
 * PDF: genuinely clickable document links work here — each link's href is
 * simply the document's base64 data URL, embedded as a normal HTML <a>,
 * rendered through the browser's print engine (same technique already used
 * for Anomaly Report / BowTie exports elsewhere in the app). Clicking it in
 * the resulting PDF opens the document directly.
 *
 * Excel: base64 data URLs for real photos/PDFs are typically tens of
 * thousands of characters long, and Excel's hyperlink target field has a
 * hard length limit (~255–2083 chars depending on version) — far short of
 * that. A "clickable link" to an embedded document is not reliably
 * achievable in .xlsx, so instead we list each document's name + review
 * status as readable text; opening the actual file still happens inside
 * the app (Personnel → detail → document preview).
 */

function escapeHtml(s) {
  return String(s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

async function fetchAllDocuments(personnelList) {
  const map = {};
  await Promise.all(
    personnelList.map(async (p) => {
      map[p.id] = await loadPersonnelDocuments(p.id);
    })
  );
  return map;
}

function docTypeLabel(docType) {
  return DOC_TYPES.find((t) => t.value === docType)?.label || docType;
}

function docsSummaryText(docs) {
  if (!docs || docs.length === 0) return "بدون مدرک بارگذاری‌شده";
  return docs.map((d) => `${docTypeLabel(d.docType)} (${docStatusMeta(d.status).label})`).join(" | ");
}

export async function exportPersonnelPdf(personnelList, title) {
  const documentsMap = await fetchAllDocuments(personnelList);

  const headers = ["ردیف", "نام و نام خانوادگی", "کد ملی", "پیمانکار", "عنوان شغلی", "تماس", "تاریخ شروع", "وضعیت", "صلاحیت", "انقضای طب کار", "مدارک"];

  const rows = personnelList
    .map((p, idx) => {
      const sm = personnelStatusMeta(p.status);
      const docs = documentsMap[p.id] || [];
      const docLinks =
        docs
          .map((d) => `<a href="${d.fileData}" target="_blank" rel="noopener">${escapeHtml(docTypeLabel(d.docType))}</a>`)
          .join("<br/>") || "—";
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(p.fullName)}</td>
        <td>${escapeHtml(p.nationalCode)}</td>
        <td>${escapeHtml(p.contractorName)}</td>
        <td>${escapeHtml(p.jobTitle)}</td>
        <td>${escapeHtml(p.phone)}</td>
        <td>${isoToJalaliDisplay(p.startDate)}</td>
        <td>${escapeHtml(sm.label)}</td>
        <td>${p.qualificationRequired ? escapeHtml(docStatusMeta(p.qualificationStatus || "pending").label) : "—"}</td>
        <td>${p.occHealthExpiry ? isoToJalaliDisplay(p.occHealthExpiry) : "—"}</td>
        <td>${docLinks}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; direction: rtl; padding: 16px; }
    h2 { text-align: center; margin-bottom: 4px; }
    p.meta { text-align: center; color: #666; font-size: 12px; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 14px; }
    th, td { border: 1px solid #ccc; padding: 5px; text-align: right; vertical-align: top; }
    th { background: #f1f5f9; }
    a { color: #0d8f8a; text-decoration: underline; }
    @media print { @page { size: landscape; margin: 10mm; } }
  </style></head>
  <body>
    <h2>${escapeHtml(title)}</h2>
    <p class="meta">مدیریت ورود و تردد پرسنل — Integrated HSE Management System — تعداد: ${personnelList.length}</p>
    <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;

  if (await exportHtmlReportNativeAware(html, title)) return;

  const win = window.open("", "_blank");
  if (!win) {
    alert("اجازه‌ی باز شدن پنجره‌ی جدید داده نشد؛ لطفاً popup blocker مرورگر را غیرفعال کنید.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export async function exportPersonnelExcel(personnelList, title) {
  const documentsMap = await fetchAllDocuments(personnelList);

  const rows = personnelList.map((p, idx) => ({
    "ردیف": idx + 1,
    "نام و نام خانوادگی": p.fullName,
    "کد ملی": p.nationalCode,
    "پیمانکار": p.contractorName,
    "عنوان شغلی": p.jobTitle,
    "شماره تماس": p.phone,
    "تاریخ شروع به کار": isoToJalaliDisplay(p.startDate),
    "وضعیت": personnelStatusMeta(p.status).label,
    "وضعیت صلاحیت": p.qualificationRequired ? docStatusMeta(p.qualificationStatus || "pending").label : "—",
    "تاریخ انجام طب کار": p.occHealthDate ? isoToJalaliDisplay(p.occHealthDate) : "—",
    "انقضای طب کار": p.occHealthExpiry ? isoToJalaliDisplay(p.occHealthExpiry) : "—",
    "مدارک بارگذاری‌شده": docsSummaryText(documentsMap[p.id]),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws, "Personnel");
  await exportWorkbookNativeAware(XLSX, wb, `${title}.xlsx`);
}
