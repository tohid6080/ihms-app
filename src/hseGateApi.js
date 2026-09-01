import { sb, sbOk, uid, getCurrentCompanyId } from "./shared.js";

/**
 * لایه‌ی مشترک «تأیید قبل از ارسال به پیمانکار» + «واگذاری بین کارشناسا»
 * — طبق طرح تأییدشده: یک جدول عمومی (hse_gate_items) که به هر رکورد از
 * هر ماژول قابل‌اتصال است، نه یک ستون جدا در هر جدول. اولین ماژول واقعی
 * که این را استفاده می‌کند Anomaly Report است؛ بقیه‌ی ماژول‌ها بعداً به
 * همین لایه وصل می‌شوند.
 */

// فهرست کارشناسان کارفرما همان شرکت — برای دراپ‌داون «واگذاری به
// کارشناس» در صندوق ورودی سرپرست/مدیر HSE. customer scope عادی (نه
// super_admin) چون RLS خودش company isolation را روی employer_accounts
// تضمین می‌کند.
export async function loadCompanyStaffOptions() {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  const rows = await sb(`employer_accounts?company_id=eq.${companyId}&is_active=eq.true&select=username,name,role&order=name.asc`);
  return sbOk(rows) ? rows.map((r) => ({ username: r.username, name: r.name, role: r.role })) : [];
}

export const GATE_STATUS_LABELS = {
  pending_approval: "در انتظار تأیید سرپرست/مدیر HSE",
  assigned_review: "ارجاع‌شده برای بررسی کارشناس",
  reviewed: "بررسی‌شده — در انتظار تأیید نهایی",
  approved: "تأیید شده",
  assigned: "واگذارشده",
  rejected: "رد شده",
};

function gateItemFromRow(r) {
  return {
    id: r.id, companyId: r.company_id, moduleKey: r.module_key, recordId: r.record_id,
    recordLabel: r.record_label || "", direction: r.direction, status: r.status,
    submittedBy: r.submitted_by, assignedTo: r.assigned_to || "", reviewedBy: r.reviewed_by || "",
    reviewedAt: r.reviewed_at, reviewNote: r.review_note || "", reviewerComment: r.reviewer_comment || "", createdAt: r.created_at,
  };
}

// ---------- ایجاد یک مورد جدید در گیت (هر کاربر شرکت می‌تواند) ----------

export async function submitToGate({ moduleKey, recordId, recordLabel, direction }, submittedBy) {
  const payload = {
    id: uid("gate"), company_id: getCurrentCompanyId(), module_key: moduleKey, record_id: recordId,
    record_label: recordLabel || null, direction, status: "pending_approval", submitted_by: submittedBy || "",
  };
  const rows = await sb("hse_gate_items", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ارسال به گیت تأیید HSE" };
  return gateItemFromRow(rows[0]);
}

// ---------- خواندن ----------

// وضعیت گیت یک رکورد خاص (برای نمایش نشان «در انتظار تأیید» روی خودِ آیتم)
export async function loadGateStatusForRecord(moduleKey, recordId) {
  const rows = await sb(`hse_gate_items?module_key=eq.${moduleKey}&record_id=eq.${recordId}&select=*&order=created_at.desc&limit=1`);
  if (!sbOk(rows) || rows.length === 0) return null;
  return gateItemFromRow(rows[0]);
}

// صندوق ورودی سرپرست/مدیر HSE — هر موردی که نیاز به تصمیم او دارد: تازه
// ثبت‌شده (pending_approval) یا بررسی‌شده توسط کارشناس و منتظر تأیید
// نهایی (reviewed).
export async function loadPendingGateItems(moduleKey) {
  const filter = moduleKey ? `&module_key=eq.${moduleKey}` : "";
  const rows = await sb(`hse_gate_items?status=in.(pending_approval,reviewed)${filter}&select=*&order=created_at.asc`);
  return sbOk(rows) ? rows.map(gateItemFromRow) : [];
}

// موارد واگذارشده به یک کارشناس خاص — هم برای بررسی (assigned_review،
// گردش‌کار سه‌مرحله‌ای جدید) هم واگذاری مستقیم قدیمی (assigned، مثلاً
// موارد گزارش‌شده از پیمانکار)
export async function loadAssignedGateItems(username) {
  const rows = await sb(`hse_gate_items?assigned_to=eq.${encodeURIComponent(username)}&status=in.(assigned,assigned_review)&select=*&order=created_at.asc`);
  return sbOk(rows) ? rows.map(gateItemFromRow) : [];
}

// ---------- تصمیم‌گیری — فقط سرپرست/مدیر HSE یا ادمین (طبق RLS) ----------

// سرپرست/مدیر HSE یک مورد را برای بررسی به یک کارشناس ارجاع می‌دهد —
// طبق تصمیم تأییدشده، این جایگزین تأیید مستقیم نیست، یک گزینه‌ی موازی
// است (سرپرست همچنان می‌تواند مستقیم approveGateItem را هم صدا بزند).
export async function assignForReview(id, assignedTo, reviewedBy) {
  if (!assignedTo) return { __error: true, message: "انتخاب کارشناس مقصد الزامی است" };
  const rows = await sb(`hse_gate_items?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "assigned_review", assigned_to: assignedTo, reviewed_by: reviewedBy || "", reviewed_at: new Date().toISOString() }),
  });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ارجاع — فقط سرپرست/مدیر HSE یا ادمین مجاز است" };
  if (rows.length === 0) return { __error: true, message: "دسترسی شما برای ارجاع این مورد کافی نیست" };
  return { ok: true };
}

// کارشناس بعد از بررسی، نتیجه را (با نظر اختیاری) برای تأیید نهایی به
// سرپرست/مدیر HSE برمی‌گرداند. طبق تصمیم تأییدشده: نظر کارشناس اختیاری
// است، نه اجباری.
export async function submitReview(id, reviewerUsername, comment) {
  const rows = await sb(`hse_gate_items?id=eq.${id}&assigned_to=eq.${encodeURIComponent(reviewerUsername)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "reviewed", reviewer_comment: comment || null }),
  });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ارسال نتیجه‌ی بررسی" };
  if (rows.length === 0) return { __error: true, message: "این مورد به شما ارجاع نشده یا قبلاً بررسی شده است" };
  return { ok: true };
}

export async function approveGateItem(id, reviewedBy, reviewNote) {
  const rows = await sb(`hse_gate_items?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved", reviewed_by: reviewedBy || "", reviewed_at: new Date().toISOString(), review_note: reviewNote || null }),
  });
  if (!sbOk(rows)) return { __error: true, message: "خطا در تأیید — فقط سرپرست/مدیر HSE یا ادمین مجاز است" };
  if (rows.length === 0) return { __error: true, message: "دسترسی شما برای تأیید این مورد کافی نیست" };
  return { ok: true };
}

export async function rejectGateItem(id, reviewedBy, reviewNote) {
  if (!reviewNote || !reviewNote.trim()) return { __error: true, message: "برای رد یک مورد، ذکر دلیل الزامی است" };
  const rows = await sb(`hse_gate_items?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "rejected", reviewed_by: reviewedBy || "", reviewed_at: new Date().toISOString(), review_note: reviewNote }),
  });
  if (!sbOk(rows)) return { __error: true, message: "خطا در رد — فقط سرپرست/مدیر HSE یا ادمین مجاز است" };
  if (rows.length === 0) return { __error: true, message: "دسترسی شما برای رد این مورد کافی نیست" };
  return { ok: true };
}

export async function assignGateItem(id, assignedTo, reviewedBy) {
  if (!assignedTo) return { __error: true, message: "انتخاب کارشناس مقصد الزامی است" };
  const rows = await sb(`hse_gate_items?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "assigned", assigned_to: assignedTo, reviewed_by: reviewedBy || "", reviewed_at: new Date().toISOString() }),
  });
  if (!sbOk(rows)) return { __error: true, message: "خطا در واگذاری — فقط سرپرست/مدیر HSE یا ادمین مجاز است" };
  if (rows.length === 0) return { __error: true, message: "دسترسی شما برای واگذاری این مورد کافی نیست" };
  return { ok: true };
}
