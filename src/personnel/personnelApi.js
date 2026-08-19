import { sb, sbOk, sbErrMsg, uid, todayISO, getCurrentCompanyId } from "../shared.js";
import { offlineWrite, offlineWriteFile } from "../offline/offlineWrite.js";
import { isOnline } from "../offline/networkStatus.js";
import { checkUploadAllowed } from "../offline/dbSizeMonitor.js";
import { getRecordsByModule, putRecord } from "../offline/offlineDb.js";

/**
 * Personnel Access Management — data access layer.
 * Files (documents) are stored as base64 in Postgres, matching the existing
 * anomaly_photos pattern in this project (no Supabase Storage bucket needed).
 * Deadline/expiry checks run client-side on dashboard load (no cron/Edge
 * Function in this stack) — see checkAndUpdateDeadlines().
 */

export const SPECIAL_JOB_TITLES = ["داربست‌بند", "اپراتور جرثقیل", "ریگر", "نصاب", "برقکار"];

export const DOC_TYPES = [
  { value: "start_work_form", label: "فرم شروع به کار" },
  { value: "general_safety_training", label: "فرم آموزش ایمنی عمومی" },
  { value: "specialized_safety_training", label: "فرم آموزش ایمنی تخصصی" },
  { value: "qualification_form", label: "فرم تأیید صلاحیت", specialOnly: true },
  { value: "health_certificate", label: "گواهی طب کار" },
  { value: "health_visit_receipt", label: "رسید مراجعه به طب کار" },
  { value: "health_final_result", label: "نتیجه نهایی طب کار" },
];

export const DOC_STATUS = [
  { value: "pending", label: "در انتظار بررسی", color: "#b45309", bg: "#fef3c7" },
  { value: "approved", label: "تأیید شده", color: "#166534", bg: "#dcfce7" },
  { value: "rejected", label: "رد شده", color: "#c92a2a", bg: "#fdecec" },
  { value: "needs_correction", label: "نیاز به اصلاح", color: "#b45309", bg: "#fef3c7" },
];

export const PERSONNEL_STATUS = [
  { value: "pending_documents", label: "در انتظار بارگذاری مدارک", color: "#b45309", bg: "#fef3c7" },
  { value: "pending_employer_review", label: "در حال بررسی کارفرما", color: "#1d4ed8", bg: "#dbeafe" },
  { value: "pending_qualification", label: "در انتظار تأیید صلاحیت", color: "#b45309", bg: "#fef3c7" },
  { value: "pending_health_visit", label: "در انتظار مراجعه به طب کار", color: "#b45309", bg: "#fef3c7" },
  { value: "pending_health_result", label: "در انتظار نتیجه طب کار", color: "#b45309", bg: "#fef3c7" },
  { value: "active", label: "فعال", color: "#166534", bg: "#dcfce7" },
  { value: "needs_correction", label: "نیاز به اصلاح", color: "#c92a2a", bg: "#fdecec" },
  { value: "rejected", label: "رد شده", color: "#c92a2a", bg: "#fdecec" },
  { value: "health_expired", label: "طب کار منقضی شده", color: "#c92a2a", bg: "#fdecec" },
];

export function personnelStatusMeta(status) {
  return PERSONNEL_STATUS.find((s) => s.value === status) || PERSONNEL_STATUS[0];
}

// وضعیت اشتغال — کاملاً مستقل از وضعیت گردش‌کار تأیید بالا (PERSONNEL_STATUS).
// آن وضعیت مربوط به مراحل تأیید مدارک/صلاحیت/طب‌کار است؛ این یکی فقط می‌گوید
// آیا فرد الان همکاری می‌کند یا ترک‌کار/تسویه‌حساب شده — با ثبت هیچ‌کدام از
// سوابق/مدارک/معاینات قبلی‌اش حذف نمی‌شود.
export const EMPLOYMENT_STATUS = [
  { value: "active", label: "فعال", color: "#166534", bg: "#dcfce7" },
  { value: "terminated", label: "ترک کار / تسویه حساب", color: "#5b6b7d", bg: "#eef1f5" },
];
export function employmentStatusMeta(value) {
  return EMPLOYMENT_STATUS.find((s) => s.value === value) || EMPLOYMENT_STATUS[0];
}

// ثبت ترک‌کار/تسویه‌حساب یا بازگرداندن به فعال — تاریخ فقط برای ترک‌کار الزامی است.
export async function setEmploymentStatus(id, employmentStatus, terminationDate, performedBy) {
  if (employmentStatus === "terminated" && !terminationDate) {
    return { __error: true, message: "تاریخ ترک کار / تسویه حساب الزامی است" };
  }
  const patch = { employmentStatus, terminationDate: employmentStatus === "terminated" ? terminationDate : "" };
  const result = await updatePersonnelDB(id, patch, performedBy);
  if (result?.__error) return result;
  if (performedBy) {
    insertAuditLog(id, employmentStatus === "terminated" ? "terminated" : "edited",
      employmentStatus === "terminated" ? `ثبت ترک کار / تسویه حساب (تاریخ: ${terminationDate})` : "بازگرداندن به وضعیت اشتغال فعال",
      performedBy);
  }
  return result;
}

export function docStatusMeta(status) {
  return DOC_STATUS.find((s) => s.value === status) || DOC_STATUS[0];
}
export function isSpecialJob(jobTitle) {
  return SPECIAL_JOB_TITLES.includes((jobTitle || "").trim());
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function addYears(isoDate, years) {
  const d = new Date(isoDate);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

// ---------- Personnel ----------
function personnelFromRow(r) {
  return {
    id: r.id,
    fullName: r.full_name || "",
    nationalCode: r.national_code || "",
    contractorId: r.contractor_id || "",
    contractorName: r.contractor_name || "",
    jobTitle: r.job_title || "",
    phone: r.phone || "",
    startDate: r.start_date || "",
    status: r.status || "pending_documents",
    qualificationRequired: !!r.qualification_required,
    qualificationStatus: r.qualification_status || "",
    qualificationNote: r.qualification_note || "",
    occHealthPath: r.occ_health_path || "",
    occHealthDate: r.occ_health_date || "",
    occHealthExpiry: r.occ_health_expiry || "",
    occHealthVisitDeadline: r.occ_health_visit_deadline || "",
    occHealthResultDeadline: r.occ_health_result_deadline || "",
    createdBy: r.created_by || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    syncStatus: r.__syncStatus || "synced",
    employmentStatus: r.employment_status || "active",
    terminationDate: r.termination_date || "",
    companyId: r.company_id || "",
  };
}

// لیست پیمانکاران برای منوی کشویی فرم ثبت پرسنل — فقط خواندن از جدول موجود contractors،
// بدون هیچ وابستگی به bowtieApi.js یا App.jsx (ماژول کاملاً مستقل می‌ماند)
export async function loadContractorOptions() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`contractors?select=id,name&order=name.asc${filter}`);
  return sbOk(rows) ? rows.map((r) => ({ id: r.id, name: r.name })) : [];
}

export async function loadPersonnelList() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`personnel?select=*&order=created_at.desc${filter}`);
  return (sbOk(rows) ? rows : []).map(personnelFromRow);
}

/**
 * Offline-first loader: online → fetch fresh + refresh the local cache;
 * offline → read purely from the local cache. Same pattern as anomalies.
 */
export async function loadPersonnelListOfflineFirst() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  if (isOnline()) {
    const rows = await sb(`personnel?select=*&order=created_at.desc${filter}`);
    if (sbOk(rows)) {
      for (const r of rows) await putRecord("personnel", r.id, r, "synced");
      const cached = await getRecordsByModule("personnel");
      const serverIds = new Set(rows.map((r) => r.id));
      const localOnly = cached.filter((c) => c.syncStatus !== "synced" && !serverIds.has(c.id) && !c.data?.deleted);
      return [
        ...localOnly.map((c) => personnelFromRow({ ...c.data, __syncStatus: c.syncStatus })),
        ...rows.map((r) => personnelFromRow({ ...r, __syncStatus: "synced" })),
      ];
    }
  }
  const cached = await getRecordsByModule("personnel");
  return cached.filter((c) => !c.data?.deleted).map((c) => personnelFromRow({ ...c.data, __syncStatus: c.syncStatus }));
}

export async function insertPersonnel(rec) {
  const id = uid("pers");
  const special = isSpecialJob(rec.jobTitle);
  const dbPayload = {
    full_name: rec.fullName,
    national_code: rec.nationalCode,
    contractor_id: rec.contractorId || null,
    contractor_name: rec.contractorName || "",
    job_title: rec.jobTitle,
    phone: rec.phone || "",
    start_date: rec.startDate || null,
    status: "pending_documents",
    qualification_required: special,
    qualification_status: special ? "pending" : null,
    created_by: rec.createdBy || "",
    company_id: getCurrentCompanyId(),
  };
  const result = await offlineWrite({ module: "personnel", table: "personnel", action: "insert", id, payload: dbPayload });
  if (!result.ok) return { __error: true, message: "خطا در ذخیره‌سازی" };
  insertAuditLog(id, "created", `ثبت پرسنل جدید: ${rec.fullName}`, rec.createdBy);
  return { ...personnelFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

export async function updatePersonnelDB(id, patch, performedBy) {
  const dbPatch = { updated_at: new Date().toISOString() };
  if ("fullName" in patch) dbPatch.full_name = patch.fullName;
  if ("nationalCode" in patch) dbPatch.national_code = patch.nationalCode;
  if ("jobTitle" in patch) dbPatch.job_title = patch.jobTitle;
  if ("phone" in patch) dbPatch.phone = patch.phone;
  if ("startDate" in patch) dbPatch.start_date = patch.startDate || null;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("qualificationRequired" in patch) dbPatch.qualification_required = patch.qualificationRequired;
  if ("qualificationStatus" in patch) dbPatch.qualification_status = patch.qualificationStatus;
  if ("qualificationNote" in patch) dbPatch.qualification_note = patch.qualificationNote;
  if ("occHealthPath" in patch) dbPatch.occ_health_path = patch.occHealthPath;
  if ("occHealthDate" in patch) dbPatch.occ_health_date = patch.occHealthDate || null;
  if ("occHealthExpiry" in patch) dbPatch.occ_health_expiry = patch.occHealthExpiry || null;
  if ("occHealthVisitDeadline" in patch) dbPatch.occ_health_visit_deadline = patch.occHealthVisitDeadline || null;
  if ("occHealthResultDeadline" in patch) dbPatch.occ_health_result_deadline = patch.occHealthResultDeadline || null;
  if ("employmentStatus" in patch) dbPatch.employment_status = patch.employmentStatus;
  if ("terminationDate" in patch) dbPatch.termination_date = patch.terminationDate || null;
  const result = await offlineWrite({ module: "personnel", table: "personnel", action: "update", id, payload: dbPatch });
  if (!result.ok) return { __error: true, message: "خطا در ذخیره‌سازی" };
  if (performedBy) insertAuditLog(id, "edited", `به‌روزرسانی: ${Object.keys(patch).join(", ")}`, performedBy);
  return { ...personnelFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

export async function deletePersonnelDB(id, performedBy) {
  await offlineWrite({ module: "personnel", table: "personnel", action: "delete", id, payload: {} });
  if (performedBy) insertAuditLog(id, "deleted", "حذف پرسنل", performedBy);
}

// ---------- Documents ----------
function documentFromRow(r) {
  return {
    id: r.id,
    personnelId: r.personnel_id,
    docType: r.doc_type,
    fileData: r.file_data || "",
    fileName: r.file_name || "",
    mimeType: r.mime_type || "",
    status: r.status || "pending",
    reviewNote: r.review_note || "",
    uploadedAt: r.uploaded_at,
    reviewedBy: r.reviewed_by || "",
    reviewedAt: r.reviewed_at || "",
  };
}

export async function loadPersonnelDocuments(personnelId) {
  const rows = await sb(`personnel_documents?personnel_id=eq.${personnelId}&select=*&order=uploaded_at.desc`);
  return (sbOk(rows) ? rows : []).map(documentFromRow);
}

// replaces any existing document of the same type for this person (upload = replace)
export async function upsertDocument(personnelId, docType, fileData, fileName, mimeType, performedBy) {
  if (isOnline()) {
    const { allowed, storageMb } = await checkUploadAllowed();
    if (!allowed) {
      return { __error: true, message: `فضای ذخیره‌سازی پر شده است (${storageMb} مگابایت). لطفاً ابتدا از بخش «آرشیو فایل‌ها» مدارک قدیمی را دانلود و حذف کنید، سپس دوباره تلاش کنید.` };
    }
  }
  const existing = await sb(`personnel_documents?personnel_id=eq.${personnelId}&doc_type=eq.${docType}&select=id`);
  if (sbOk(existing) && existing.length > 0) {
    for (const row of existing) {
      await offlineWrite({ module: "personnelDocuments", table: "personnel_documents", action: "delete", id: row.id, payload: {} });
    }
  }
  const id = uid("doc");
  const result = await offlineWriteFile({
    module: "personnelDocuments", table: "personnel_documents", bucket: "personnel-documents", id,
    base64Data: fileData, contentType: mimeType, fileFieldName: "file_data",
    extraFields: { personnel_id: personnelId, doc_type: docType, file_name: fileName, mime_type: mimeType, status: "pending" },
  });
  if (!result.ok) return { __error: true, message: "خطا در ذخیره‌سازی" };
  insertAuditLog(personnelId, "doc_uploaded", `بارگذاری مدرک: ${docType}`, performedBy);
  return { ...documentFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

export async function reviewDocumentDB(id, status, reviewNote, reviewedBy) {
  const dbPatch = { status, review_note: reviewNote || "", reviewed_by: reviewedBy || "", reviewed_at: new Date().toISOString() };
  const result = await offlineWrite({ module: "personnelDocuments", table: "personnel_documents", action: "update", id, payload: dbPatch });
  if (!result.ok) return { __error: true, message: "خطا در ذخیره‌سازی" };
  const doc = { ...documentFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
  insertAuditLog(doc.personnelId, status === "approved" ? "approved" : "rejected", `بررسی مدرک ${doc.docType}: ${status}`, reviewedBy);
  return doc;
}

export async function deleteDocumentDB(id) {
  await offlineWrite({ module: "personnelDocuments", table: "personnel_documents", action: "delete", id, payload: {} });
}

// ---------- Notifications ----------
export async function loadNotifications(recipientRole) {
  // not.is.true به‌جای eq.false: هر ردیفی که صراحتاً is_read=true نشده رو
  // برمی‌گردونه (چه false باشه چه NULL) — چون قبلاً insertNotification این
  // ستون رو صریح ست نمی‌کرد و همه‌ی اعلان‌های قدیمی با is_read=NULL ذخیره
  // شده بودن که با فیلتر eq.false اصلاً دیده نمی‌شدن.
  const rows = await sb(`personnel_notifications?is_read=not.is.true&select=*&order=created_at.desc&limit=50`);
  const list = sbOk(rows) ? rows : [];
  return list.filter((r) => r.recipient_role === recipientRole || r.recipient_role === "both");
}
export async function insertNotification(personnelId, type, message, recipientRole) {
  await sb("personnel_notifications", { method: "POST", body: JSON.stringify([{ personnel_id: personnelId, type, message, recipient_role: recipientRole, is_read: false, company_id: getCurrentCompanyId() }]), prefer: "return=minimal" });
}
// همون جدول اعلان‌ها، فقط برای رویدادهای مربوط به آنومالی (نه پرسنل) —
// anomaly_id به‌جای personnel_id پر می‌شود؛ زنگوله‌ی اعلان‌ها همان‌طور که
// هست کار می‌کند چون فقط به message نگاه می‌کند، نه به این‌که کدام ستون پر شده.
export async function insertAnomalyNotification(anomalyId, type, message, recipientRole) {
  await sb("personnel_notifications", { method: "POST", body: JSON.stringify([{ anomaly_id: anomalyId, type, message, recipient_role: recipientRole, is_read: false, company_id: getCurrentCompanyId() }]), prefer: "return=minimal" });
}
export async function markNotificationRead(id) {
  await sb(`personnel_notifications?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ is_read: true }), prefer: "return=minimal" });
}

// ---------- Audit log ----------
export async function insertAuditLog(personnelId, action, detail, performedBy) {
  await sb("personnel_audit_log", {
    method: "POST",
    body: JSON.stringify([{ personnel_id: personnelId, action, detail, performed_by: performedBy || "", company_id: getCurrentCompanyId() }]),
    prefer: "return=minimal",
  });
}
export async function loadAuditLog(personnelId) {
  const rows = await sb(`personnel_audit_log?personnel_id=eq.${personnelId}&select=*&order=created_at.desc`);
  return sbOk(rows) ? rows : [];
}

// ---------- Occupational health workflow helpers ----------
// Called once employer approves initial documents for a "no certificate" person.
// مهلت‌ها از تاریخ واقعی شروع به کار محاسبه می‌شوند، نه تاریخ ثبت توی سیستم —
// اگه یه پرسنل با تأخیر ثبت بشه (مثلاً امروز ۹ مرداده ولی از ۱ مرداد مشغول
// بوده)، مهلت باید بلافاصله «گذشته» حساب بشه، نه از همین لحظه دوباره شروع بشه.
export async function startHealthVisitDeadline(personnelId, startDate) {
  const base = startDate || todayISO();
  const deadline = addDays(base, 3);
  await updatePersonnelDB(personnelId, { status: "pending_health_visit", occHealthVisitDeadline: deadline });
}
// Called once contractor uploads the visit receipt.
export async function startHealthResultDeadline(personnelId, startDate) {
  const base = startDate || todayISO();
  const deadline = addDays(base, 7);
  await updatePersonnelDB(personnelId, { status: "pending_health_result", occHealthResultDeadline: deadline });
}
// Called once employer approves the final health result.
export async function finalizeHealthApproval(personnelId, healthDate) {
  const expiry = addYears(healthDate || todayISO(), 1);
  await updatePersonnelDB(personnelId, { status: "active", occHealthDate: healthDate || todayISO(), occHealthExpiry: expiry });
}

/**
 * Client-side deadline/expiry sweep — run on dashboard load since this stack
 * has no cron/Edge Function. Checks every person's stored deadline dates
 * against today; if passed, flips status and files an in-app notification
 * (idempotent-ish: only fires if the status hasn't already reflected it).
 */
export async function checkAndUpdateDeadlines(personnelList) {
  const today = todayISO();
  // اعلان‌های مهلت ۳/۷ روزه دیگر اینجا ثبت نمی‌شوند — این اطلاعات الان توی
  // خلاصه‌ی زنده‌ی زنگوله (computeSmartNotifications در App.jsx) نشون داده
  // می‌شود. فقط انتقال خودکار وضعیت «فعال» به «منقضی» بعد از پایان اعتبار
  // طب کار همچنان همین‌جا انجام می‌شود — چون این یک تغییر وضعیت واقعیه، نه
  // صرفاً یک اعلان.
  for (const p of personnelList) {
    if (p.status === "active" && p.occHealthExpiry && p.occHealthExpiry < today) {
      await updatePersonnelDB(p.id, { status: "health_expired" });
    }
  }
}

// ---------- گردش‌کار وضعیت (State machine) ----------
// این تابع خالص (pure) است: بر اساس مدارک فعلی، وضعیت صلاحیت و مسیر طب کار،
// وضعیت "درست" بعدی پرسنل را محاسبه می‌کند. بعد از هر تأیید/رد مدرک یا صلاحیت،
// UI این تابع را صدا می‌زند و نتیجه را با updatePersonnelDB ذخیره می‌کند.
const INITIAL_DOC_TYPES = ["start_work_form", "general_safety_training", "specialized_safety_training"];

export function computeNextStatus(personnel, documents) {
  const byType = (t) => documents.find((d) => d.docType === t);
  const anyNeedsAttention = documents.some((d) => d.status === "rejected" || d.status === "needs_correction");
  if (anyNeedsAttention) return "needs_correction";
  if (personnel.qualificationStatus === "rejected" || personnel.qualificationStatus === "needs_correction") return "needs_correction";

  const initialUploaded = INITIAL_DOC_TYPES.every((t) => byType(t));
  if (!initialUploaded) return "pending_documents";

  const initialApproved = INITIAL_DOC_TYPES.every((t) => byType(t)?.status === "approved");
  if (!initialApproved) return "pending_employer_review";

  if (personnel.qualificationRequired && personnel.qualificationStatus !== "approved") {
    return "pending_qualification";
  }

  if (personnel.occHealthPath === "has_certificate") {
    const cert = byType("health_certificate");
    if (!cert || cert.status !== "approved") return "pending_employer_review";
    return "active";
  }

  if (personnel.occHealthPath === "no_certificate") {
    if (!personnel.occHealthVisitDeadline) return "pending_health_visit";
    const receipt = byType("health_visit_receipt");
    if (!receipt) return "pending_health_visit";
    const result = byType("health_final_result");
    if (!result) return "pending_health_result";
    if (result.status !== "approved") return "pending_health_result";
    return "active";
  }

  return personnel.status;
}

// پس از هر تغییر مدرک/صلاحیت صدا زده می‌شود: وضعیت جدید را محاسبه، ذخیره و
// در صورت نیاز مهلت‌های طب کار را فعال می‌کند (اثرات جانبی گردش‌کار طب کار).
export async function progressPersonnelWorkflow(personnel, documents, performedBy) {
  const prevStatus = personnel.status;
  const nextStatus = computeNextStatus(personnel, documents);

  // ورود تازه به «در انتظار مراجعه به طب کار» → مهلت ۳ روزه را فعال کن
  if (nextStatus === "pending_health_visit" && !personnel.occHealthVisitDeadline) {
    await startHealthVisitDeadline(personnel.id, personnel.startDate);
    await insertAuditLog(personnel.id, "notification_sent", "شروع مهلت ۳ روزه مراجعه به طب کار", performedBy);
    return { ...personnel, status: "pending_health_visit" };
  }

  // رسید مراجعه بارگذاری شده ولی هنوز مهلت ۷ روزه شروع نشده → شروعش کن
  if (personnel.occHealthPath === "no_certificate" && documents.find((d) => d.docType === "health_visit_receipt") && !personnel.occHealthResultDeadline) {
    await startHealthResultDeadline(personnel.id, personnel.startDate);
    await insertAuditLog(personnel.id, "notification_sent", "شروع مهلت ۷ روزه بارگذاری نتیجه طب کار", performedBy);
    return { ...personnel, status: "pending_health_result", occHealthResultDeadline: todayISO() };
  }

  // نتیجه نهایی طب کار تأیید شد → فعال‌سازی و محاسبه‌ی انقضای یک‌ساله
  if (nextStatus === "active" && (personnel.occHealthPath === "no_certificate" || personnel.occHealthPath === "has_certificate") && prevStatus !== "active") {
    await finalizeHealthApproval(personnel.id, personnel.occHealthDate);
    return { ...personnel, status: "active" };
  }

  if (nextStatus !== prevStatus) {
    await updatePersonnelDB(personnel.id, { status: nextStatus }, performedBy);
  }
  return { ...personnel, status: nextStatus };
}
