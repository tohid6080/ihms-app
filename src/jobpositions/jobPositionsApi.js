import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

/**
 * Job Positions — extensible list, fully managed via DB + Admin UI (no code
 * changes needed to add/edit/deactivate a position). Deactivated positions
 * stay in the table (existing accounts keep their label) but are excluded
 * from the "active" list used when creating new accounts.
 *
 * Sorted by order_index (organizational hierarchy), not alphabetically.
 * New positions added via the admin UI are appended to the end.
 */

function rowFromDb(r) {
  return { id: r.id, title: r.title, isActive: r.is_active !== false, orderIndex: r.order_index || 0 };
}

export async function loadActiveJobPositions() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`job_positions?is_active=eq.true&select=id,title,is_active,order_index&order=order_index.asc${filter}`);
  return (sbOk(rows) ? rows : []).map(rowFromDb);
}

export async function loadAllJobPositions() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`job_positions?select=id,title,is_active,order_index&order=order_index.asc${filter}`);
  return (sbOk(rows) ? rows : []).map(rowFromDb);
}

export async function insertJobPosition(title) {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const existing = await sb(`job_positions?select=order_index&order=order_index.desc&limit=1${filter}`);
  const nextOrder = sbOk(existing) && existing.length > 0 ? (existing[0].order_index || 0) + 1 : 1;
  const rows = await sb("job_positions", { method: "POST", body: JSON.stringify([{ title, order_index: nextOrder, company_id: companyId }]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت (شاید این عنوان قبلاً وجود دارد)" };
  return rowFromDb(rows[0]);
}

export async function updateJobPosition(id, patch) {
  const dbPatch = {};
  if ("title" in patch) dbPatch.title = patch.title;
  if ("isActive" in patch) dbPatch.is_active = patch.isActive;
  if ("orderIndex" in patch) dbPatch.order_index = patch.orderIndex;
  const rows = await sb(`job_positions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در به‌روزرسانی" };
  return rowFromDb(rows[0]);
}

// برای نمایش سریع عنوان یک شغل بر اساس id (پروفایل، لیست حساب‌ها)
export async function loadJobPositionTitle(id) {
  if (!id) return "";
  const rows = await sb(`job_positions?id=eq.${id}&select=title`);
  return sbOk(rows) && rows[0] ? rows[0].title : "";
}
