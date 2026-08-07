import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

function categoryFromRow(r) {
  return { id: r.id, name: r.name, isActive: r.is_active !== false, orderIndex: r.order_index || 0 };
}

export async function loadActiveAnomalyCategories() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`anomaly_categories?is_active=eq.true&select=*&order=order_index.asc${filter}`);
  return (sbOk(rows) ? rows : []).map(categoryFromRow);
}

export async function loadAllAnomalyCategories() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`anomaly_categories?select=*&order=order_index.asc${filter}`);
  return (sbOk(rows) ? rows : []).map(categoryFromRow);
}

export async function createAnomalyCategory(name) {
  const companyId = getCurrentCompanyId();
  const existing = await sb(`anomaly_categories?select=order_index&order=order_index.desc&limit=1${companyId ? `&company_id=eq.${companyId}` : ""}`);
  const nextOrder = sbOk(existing) && existing.length > 0 ? (existing[0].order_index || 0) + 1 : 1;
  const rows = await sb("anomaly_categories", { method: "POST", body: JSON.stringify([{ name: name.trim(), order_index: nextOrder, company_id: companyId }]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت: " + (rows?.message || "نامشخص") };
  return categoryFromRow(rows[0]);
}

export async function updateAnomalyCategory(id, name) {
  const rows = await sb(`anomaly_categories?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی: " + (rows?.message || "نامشخص") };
  return categoryFromRow(rows[0]);
}

export async function setAnomalyCategoryActive(id, isActive) {
  const rows = await sb(`anomaly_categories?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ is_active: isActive }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در تغییر وضعیت" };
  return categoryFromRow(rows[0]);
}
