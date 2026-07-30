import { sb, sbOk } from "../shared.js";

/**
 * Role & Permission Management — data layer.
 *
 * Per account (employer or contractor) + module, a single tri-state value:
 *   "none" | "view" | "edit"
 * Stored in the same `permissions` table as before (can_view / can_edit):
 *   none → can_view=false
 *   view → can_view=true,  can_edit=false
 *   edit → can_view=true,  can_edit=true
 *
 * Backward compatibility: an EXISTING account with no row for a module
 * still defaults to "edit" (full access) — unchanged from before, so
 * nothing breaks for accounts created prior to this feature.
 *
 * NEW accounts (created via the enhanced Account Management flow) are
 * explicitly initialized to "none" for every module right after creation
 * (see initializeNoAccess) — matching "select job position, then assign
 * module permissions" and "users should only see modules assigned to
 * them" for anyone onboarded from now on.
 */

export const PERMISSION_MODULES = [
  { key: "anomalyReport", label: "مدیریت عدم انطباق‌ها (Anomaly Report)" },
  { key: "riskAssessment", label: "مدیریت ارزیابی ریسک (Risk Assessment)" },
  { key: "personnelAccess", label: "مدیریت ورود و تردد پرسنل" },
  { key: "managementDashboard", label: "داشبورد مدیریتی و گزارش‌های تحلیلی" },
];

function rowFromDb(r) {
  const access = r.can_view === false ? "none" : r.can_edit === false ? "view" : "edit";
  return { id: r.id, moduleKey: r.module_key, access };
}

export async function loadPermissionsMap(accountType, accountId) {
  if (!accountId) return {};
  const rows = await sb(`permissions?account_type=eq.${accountType}&account_id=eq.${accountId}&select=id,module_key,can_view,can_edit`);
  const map = {};
  (sbOk(rows) ? rows : []).forEach((r) => { map[r.module_key] = rowFromDb(r); });
  return map;
}

export async function saveModuleAccess(accountType, accountId, moduleKey, access) {
  const existing = await sb(`permissions?account_type=eq.${accountType}&account_id=eq.${accountId}&module_key=eq.${moduleKey}&select=id`);
  const body = { can_view: access !== "none", can_edit: access === "edit", updated_at: new Date().toISOString() };
  if (sbOk(existing) && existing.length > 0) {
    const rows = await sb(`permissions?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!sbOk(rows)) return { __error: true };
    return rowFromDb(rows[0]);
  }
  const rows = await sb("permissions", {
    method: "POST",
    body: JSON.stringify([{ account_type: accountType, account_id: accountId, module_key: moduleKey, ...body }]),
  });
  if (!sbOk(rows)) return { __error: true };
  return rowFromDb(rows[0]);
}

export async function resetAccountPermissions(accountType, accountId) {
  await sb(`permissions?account_type=eq.${accountType}&account_id=eq.${accountId}`, { method: "DELETE", prefer: "return=minimal" });
}

// برای حساب‌های تازه‌ساخته‌شده: همه ماژول‌ها را صراحتاً "بدون دسترسی" می‌کند
// تا ادمین دسترسی هر ماژول را آگاهانه تعیین کند.
export async function initializeNoAccess(accountType, accountId) {
  await Promise.all(PERMISSION_MODULES.map((m) => saveModuleAccess(accountType, accountId, m.key, "none")));
}

// حسابی که هنوز ردیفی برایش ثبت نشده (حساب‌های قدیمی‌تر) → دسترسی کامل، بدون تغییر رفتار قبلی
export function getModuleAccess(permissionsMap, moduleKey) {
  const row = permissionsMap?.[moduleKey];
  return row ? row.access : "edit";
}

export function isModuleVisible(permissionsMap, moduleKey) {
  return getModuleAccess(permissionsMap, moduleKey) !== "none";
}

export function getAccessLevel(permissionsMap, moduleKey) {
  const access = getModuleAccess(permissionsMap, moduleKey);
  return access === "edit" ? "edit" : "view";
}
