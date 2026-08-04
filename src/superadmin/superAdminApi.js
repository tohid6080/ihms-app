import { sb, sbOk } from "../shared.js";

/**
 * Fully separate from the regular auth flow (SEED_USERS / employer_accounts
 * / contractors in App.jsx). Nothing in this file is reachable from any
 * customer-facing screen — the only way in is the hidden #super-admin
 * route checked once at the very top of App.jsx, before any of the normal
 * login/dashboard tree even mounts.
 */

export async function superAdminLogin(username, password) {
  const rows = await sb(`super_admins?username=eq.${encodeURIComponent(username.trim())}&select=*`);
  if (!sbOk(rows) || rows.length === 0) return { __error: true, message: "نام کاربری یا رمز عبور اشتباه است" };
  const match = rows[0];
  if (match.password !== password) return { __error: true, message: "نام کاربری یا رمز عبور اشتباه است" };
  return { id: match.id, username: match.username, fullName: match.full_name || match.username };
}

export const SUBSCRIPTION_TYPES = [
  { value: "trial", label: "آزمایشی" },
  { value: "monthly", label: "ماهانه" },
  { value: "yearly", label: "سالانه" },
  { value: "permanent", label: "دائمی" },
];
export const SUBSCRIPTION_STATUSES = [
  { value: "active", label: "فعال", color: "#166534", bg: "#dcfce7" },
  { value: "expired", label: "منقضی", color: "#c92a2a", bg: "#fdecec" },
  { value: "disabled", label: "غیرفعال", color: "#5b6b7d", bg: "#eef1f5" },
];
export function subscriptionStatusMeta(v) {
  return SUBSCRIPTION_STATUSES.find((s) => s.value === v) || SUBSCRIPTION_STATUSES[0];
}

function companyFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    registeredAt: r.registered_at,
    subscriptionType: r.subscription_type || "trial",
    subscriptionStatus: r.subscription_status || "active",
    subscriptionEndDate: r.subscription_end_date || "",
    storageQuotaMb: r.storage_quota_mb ?? 500,
    lastLoginAt: r.last_login_at || "",
    notes: r.notes || "",
  };
}

export async function loadCompanies() {
  const rows = await sb("companies?select=*&order=registered_at.desc");
  return (sbOk(rows) ? rows : []).map(companyFromRow);
}

export async function createCompany(rec) {
  const payload = {
    name: rec.name, subscription_type: rec.subscriptionType || "trial",
    subscription_status: "active", subscription_end_date: rec.subscriptionEndDate || null,
    storage_quota_mb: rec.storageQuotaMb || 500,
  };
  const rows = await sb("companies", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت شرکت" };
  return companyFromRow(rows[0]);
}

export async function updateCompany(id, patch) {
  const dbPatch = {};
  if ("subscriptionType" in patch) dbPatch.subscription_type = patch.subscriptionType;
  if ("subscriptionStatus" in patch) dbPatch.subscription_status = patch.subscriptionStatus;
  if ("subscriptionEndDate" in patch) dbPatch.subscription_end_date = patch.subscriptionEndDate || null;
  if ("storageQuotaMb" in patch) dbPatch.storage_quota_mb = patch.storageQuotaMb;
  if ("notes" in patch) dbPatch.notes = patch.notes;
  const rows = await sb(`companies?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی" };
  return companyFromRow(rows[0]);
}

export async function deleteCompany(id) {
  await sb(`companies?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function loadCompanyPayments(companyId) {
  const rows = await sb(`company_payments?company_id=eq.${companyId}&select=*&order=payment_date.desc`);
  return sbOk(rows) ? rows : [];
}
export async function addCompanyPayment(companyId, amount, planType, note) {
  const payload = { company_id: companyId, amount, plan_type: planType, note: note || "" };
  await sb("company_payments", { method: "POST", body: JSON.stringify([payload]), prefer: "return=minimal" });
}

export async function sendAnnouncement(companyId, message) {
  const payload = { company_id: companyId || null, message };
  await sb("system_announcements", { method: "POST", body: JSON.stringify([payload]), prefer: "return=minimal" });
}

// ---------- ایجاد اولین حساب کاربری برای یک شرکت ----------
// این تابع دقیقاً همان جدولی را می‌نویسد (employer_accounts) که صفحه‌ی ورود
// عادی سایت از آن می‌خواند — یعنی نتیجه‌اش بلافاصله قابل استفاده برای ورود
// به سایت اصلی است، نه پنل Super Admin.
export async function createCompanyUserAccount(companyId, { name, username, password, role }) {
  const clean = username.trim();
  const existing = await sb(`employer_accounts?username=eq.${encodeURIComponent(clean)}&select=id`);
  if (sbOk(existing) && existing.length > 0) {
    return { __error: true, message: "این نام کاربری قبلاً استفاده شده است" };
  }
  const payload = {
    name: name.trim(), username: clean, password, can_edit: true,
    role: role === "admin" ? "admin" : "employer", company_id: companyId,
  };
  const rows = await sb("employer_accounts", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت حساب" };
  return rows[0];
}

export async function loadCompanyUserAccounts(companyId) {
  const rows = await sb(`employer_accounts?company_id=eq.${companyId}&select=id,name,username,role&order=name.asc`);
  return sbOk(rows) ? rows : [];
}
