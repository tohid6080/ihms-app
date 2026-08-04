import { sb, sbOk, uid, todayISO, getCurrentCompanyId } from "../shared.js";
import { offlineWrite, offlineWriteFile } from "../offline/offlineWrite.js";
import { isOnline } from "../offline/networkStatus.js";
import { getRecordsByModule, putRecord } from "../offline/offlineDb.js";
import { checkUploadAllowed } from "../offline/dbSizeMonitor.js";

/**
 * Scaffold Tag Management — tag numbering: Md1-XX-SC-01
 *   Md1  — fixed
 *   XX   — 2-letter contractor code (admin-assigned, per contractor)
 *   SC   — fixed
 *   01   — sequential, PER CONTRACTOR (each contractor's own counter),
 *          zero-padded to 2 digits and growing beyond that naturally
 *          (03 → ... → 99 → 100) if a contractor ever needs more than 99.
 */

export const SCAFFOLD_STATUSES = [
  { value: "pending_initial_approval", label: "در انتظار تأیید اولیه", color: "#b45309", bg: "#fef3c7" },
  { value: "pending_installation", label: "در انتظار نصب", color: "#1d4ed8", bg: "#dbeafe" },
  { value: "needs_correction", label: "نیاز به اصلاح", color: "#c92a2a", bg: "#fdecec" },
  { value: "tag_issued", label: "تگ صادر شد", color: "#166534", bg: "#dcfce7" },
  { value: "removal_requested", label: "درخواست برچیدن", color: "#7c3aed", bg: "#f3e8ff" },
  { value: "removed", label: "برچیده شد", color: "#5b6b7d", bg: "#eef1f5" },
];
export function scaffoldStatusMeta(v) {
  return SCAFFOLD_STATUSES.find((s) => s.value === v) || SCAFFOLD_STATUSES[0];
}

function scaffoldFromRow(r) {
  return {
    id: r.id,
    tagNumber: r.tag_number || "",
    contractorId: r.contractor_id || "",
    contractorName: r.contractor_name || "",
    location: r.location || "",
    erectionDate: r.erection_date || "",
    purpose: r.purpose || "",
    status: r.status || "pending_initial_approval",
    initialApprovedBy: r.initial_approved_by || "",
    initialApprovedAt: r.initial_approved_at || "",
    correctionNote: r.correction_note || "",
    correctionDeadline: r.correction_deadline || "",
    issueDate: r.issue_date || "",
    removalRequestDate: r.removal_request_date || "",
    removalDate: r.removal_date || "",
    reviewedBy: r.reviewed_by || "",
    createdBy: r.created_by || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    syncStatus: r.__syncStatus || "synced",
  };
}

export async function loadScaffoldTags() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`scaffold_tags?select=*&order=created_at.desc${filter}`);
  return (sbOk(rows) ? rows : []).map(scaffoldFromRow);
}

export async function loadScaffoldTagsOfflineFirst() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  if (isOnline()) {
    const rows = await sb(`scaffold_tags?select=*&order=created_at.desc${filter}`);
    if (sbOk(rows)) {
      for (const r of rows) await putRecord("scaffoldTags", r.id, r, "synced");
      const cached = await getRecordsByModule("scaffoldTags");
      const serverIds = new Set(rows.map((r) => r.id));
      const localOnly = cached.filter((c) => c.syncStatus !== "synced" && !serverIds.has(c.id) && !c.data?.deleted);
      return [
        ...localOnly.map((c) => scaffoldFromRow({ ...c.data, __syncStatus: c.syncStatus })),
        ...rows.map((r) => scaffoldFromRow({ ...r, __syncStatus: "synced" })),
      ];
    }
  }
  const cached = await getRecordsByModule("scaffoldTags");
  return cached.filter((c) => !c.data?.deleted).map((c) => scaffoldFromRow({ ...c.data, __syncStatus: c.syncStatus }));
}

// ---------- کدهای دوحرفی پیمانکاران (تعریف‌شده توسط ادمین) ----------

export async function loadContractorsWithScaffoldCode() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`contractors?select=id,name,scaffold_tag_code&order=name.asc${filter}`);
  return sbOk(rows) ? rows.map((r) => ({ id: r.id, name: r.name, scaffoldTagCode: r.scaffold_tag_code || "" })) : [];
}

export async function setContractorScaffoldCode(contractorId, code) {
  const clean = (code || "").trim().toUpperCase().slice(0, 2);
  const rows = await sb(`contractors?id=eq.${contractorId}`, { method: "PATCH", body: JSON.stringify({ scaffold_tag_code: clean }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی کد پیمانکار" };
  return { ok: true, code: clean };
}

// ---------- شماره‌گذاری خودکار تگ ----------

// شماره‌ی انتهایی یک شمارشگر سراسری مشترک بین همه‌ی پیمانکارهای همین شرکته
// (نه شمارشگر جداگانه به‌ازای هر پیمانکار، ولی هر شرکت شمارشگر خودش را
// دارد) — طبق داده‌ی واقعی فایل «آمار تگ داربست»: اولین تگ پیمانکار AG
// شماره‌ی ۱۷ گرفت (نه ۰۱)، دقیقاً چون پیمانکار NN از قبل شماره‌های ۰۱ تا ۱۶
// را مصرف کرده بود — این رفتار فقط باید داخل یک شرکت صادق باشد.
async function generateNextTagNumber(contractorId, contractorCode) {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`scaffold_tags?select=tag_number${filter}`);
  let maxSeq = 0;
  if (sbOk(rows)) {
    for (const r of rows) {
      const match = /-SC-(\d+)$/.exec(r.tag_number || "");
      if (match) {
        const seqNum = parseInt(match[1], 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
      }
    }
  }
  return `Md1-${contractorCode}-SC-${String(maxSeq + 1).padStart(2, "0")}`;
}

// ---------- درخواست تگ جدید (پیمانکار) ----------

export async function requestNewScaffoldTag(rec) {
  if (!rec.contractorCode) {
    return { __error: true, message: "کد دوحرفی پیمانکار شما هنوز توسط ادمین تعریف نشده است. لطفاً با ادمین سامانه هماهنگ کنید." };
  }
  const tagNumber = await generateNextTagNumber(rec.contractorId, rec.contractorCode);
  const id = uid("scaffold");
  const payload = {
    tag_number: tagNumber,
    contractor_id: rec.contractorId || null,
    contractor_name: rec.contractorName || "",
    location: rec.location || "",
    erection_date: rec.erectionDate || null,
    purpose: rec.purpose || "",
    status: "pending_initial_approval",
    created_by: rec.createdBy || "",
    company_id: getCurrentCompanyId(),
  };
  const result = await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "insert", id, payload });
  if (!result.ok) return { __error: true, message: result.error || "خطا در ثبت درخواست" };
  return { ...scaffoldFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

// ---------- تأیید اولیه کارفرما ----------

export async function approveInitialRequest(id, reviewedBy) {
  const payload = { status: "pending_installation", initial_approved_by: reviewedBy || "", initial_approved_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const result = await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "update", id, payload });
  if (!result.ok) return { __error: true, message: result.error || "خطا در ذخیره‌سازی" };
  return { ...scaffoldFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

// ---------- بازدید کارفرما و تصمیم (ایمن → صدور تگ / عدم انطباق → نیاز به اصلاح) ----------

export async function issueScaffoldTag(id, reviewedBy) {
  const payload = { status: "tag_issued", issue_date: todayISO(), reviewed_by: reviewedBy || "", correction_note: "", correction_deadline: null, updated_at: new Date().toISOString() };
  const result = await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "update", id, payload });
  if (!result.ok) return { __error: true, message: result.error || "خطا در ذخیره‌سازی" };
  return { ...scaffoldFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

export async function markNeedsCorrection(id, note, deadlineIso, reviewedBy) {
  if (!note || !note.trim()) return { __error: true, message: "ثبت شرح ایرادات الزامی است" };
  const payload = { status: "needs_correction", correction_note: note.trim(), correction_deadline: deadlineIso || null, reviewed_by: reviewedBy || "", updated_at: new Date().toISOString() };
  const result = await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "update", id, payload });
  if (!result.ok) return { __error: true, message: result.error || "خطا در ذخیره‌سازی" };
  return { ...scaffoldFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

// پیمانکار بعد از رفع ایرادات، دوباره درخواست بازدید می‌دهد
export async function resubmitForInspection(id) {
  const payload = { status: "pending_installation", updated_at: new Date().toISOString() };
  const result = await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "update", id, payload });
  if (!result.ok) return { __error: true, message: result.error || "خطا در ذخیره‌سازی" };
  return { ...scaffoldFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

// ---------- برچیدن داربست ----------

export async function requestScaffoldRemoval(id, removalRequestDate) {
  const payload = { status: "removal_requested", removal_request_date: removalRequestDate || todayISO(), updated_at: new Date().toISOString() };
  const result = await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "update", id, payload });
  if (!result.ok) return { __error: true, message: result.error || "خطا در ذخیره‌سازی" };
  return { ...scaffoldFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

export async function confirmScaffoldRemoved(id, reviewedBy) {
  const payload = { status: "removed", removal_date: todayISO(), reviewed_by: reviewedBy || "", updated_at: new Date().toISOString() };
  const result = await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "update", id, payload });
  if (!result.ok) return { __error: true, message: result.error || "خطا در ذخیره‌سازی" };
  return { ...scaffoldFromRow(result.record), syncStatus: result.offline ? "pending" : "synced" };
}

export async function deleteScaffoldTagDB(id) {
  await offlineWrite({ module: "scaffoldTags", table: "scaffold_tags", action: "delete", id, payload: {} });
}

// ---------- عکس‌ها (محل برپایی / برچیدن) ----------

function scaffoldPhotoFromRow(r) {
  return { id: r.id, scaffoldTagId: r.scaffold_tag_id, stage: r.stage, fileData: r.file_data, fileName: r.file_name || "", mimeType: r.mime_type || "", uploadedAt: r.uploaded_at };
}

export async function loadScaffoldPhotos(scaffoldTagId) {
  const rows = await sb(`scaffold_tag_photos?scaffold_tag_id=eq.${scaffoldTagId}&select=*`);
  return (sbOk(rows) ? rows : []).map(scaffoldPhotoFromRow);
}

export async function uploadScaffoldPhoto(scaffoldTagId, stage, fileData, fileName, mimeType) {
  if (isOnline()) {
    const { allowed, storageMb } = await checkUploadAllowed();
    if (!allowed) return { __error: true, message: `فضای ذخیره‌سازی پر شده است (${storageMb} مگابایت). لطفاً ابتدا آرشیو بگیرید.` };
  }
  const id = uid("sphoto");
  const result = await offlineWriteFile({
    module: "scaffoldPhotos", table: "scaffold_tag_photos", bucket: "scaffold-photos", id,
    base64Data: fileData, contentType: mimeType, fileFieldName: "file_data",
    extraFields: { scaffold_tag_id: scaffoldTagId, stage, file_name: fileName, mime_type: mimeType },
  });
  if (!result.ok) return { __error: true, message: result.error || "خطا در آپلود عکس" };
  return scaffoldPhotoFromRow(result.record);
}

export async function deleteScaffoldPhoto(id) {
  await offlineWrite({ module: "scaffoldPhotos", table: "scaffold_tag_photos", action: "delete", id, payload: {} });
}
