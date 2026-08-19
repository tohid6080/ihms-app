import { sb, sbOk, uid, getCurrentCompanyId } from "../shared.js";

/**
 * ماژول مدیریت حوادث — لایه‌ی داده‌ی واقعی (نه جدول استاب زیرماژول).
 * فیلدها دقیقاً همان قرارداد بخش ۲ TRIPOD_BETA_INTEGRATION.md هستند تا
 * آداپتور tripodBetaApi.js بدون هیچ نگاشت اضافه‌ای مستقیم از این جدول
 * بخواند.
 */

export const INCIDENT_TYPES = [
  { value: "fatality", label: "فوتی" },
  { value: "disabling", label: "ناتوان‌کننده" },
  { value: "medical_treatment", label: "درمان پزشکی" },
  { value: "first_aid", label: "کمک‌های اولیه" },
  { value: "near_miss", label: "شبه‌حادثه" },
  { value: "property_damage", label: "خسارت مالی/تجهیزات" },
];

function incidentFromRow(r) {
  return {
    id: r.id,
    incidentNo: r.incident_no,
    occurredAt: r.occurred_at,
    location: r.location || "",
    incidentType: r.incident_type || "",
    isDisabling: !!r.is_disabling,
    injuredPersonName: r.injured_person_name || "",
    lostDays: r.lost_days || 0,
    financialCost: r.financial_cost != null ? Number(r.financial_cost) : null,
    description: r.description || "",
    employerOrg: r.employer_org || "",
    contractorOrg: r.contractor_org || "",
    createdBy: r.created_by || "",
    createdAt: r.created_at,
  };
}

function incidentToDb(rec) {
  return {
    incident_no: rec.incidentNo,
    occurred_at: rec.occurredAt,
    location: rec.location || null,
    incident_type: rec.incidentType || null,
    is_disabling: !!rec.isDisabling,
    injured_person_name: rec.injuredPersonName || null,
    lost_days: Number(rec.lostDays) || 0,
    financial_cost: rec.financialCost !== "" && rec.financialCost != null ? Number(rec.financialCost) : null,
    description: rec.description || null,
    employer_org: rec.employerOrg || null,
    contractor_org: rec.contractorOrg || null,
  };
}

export async function loadIncidents() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`incidents?select=*&order=occurred_at.desc${filter}`);
  return sbOk(rows) ? rows.map(incidentFromRow) : [];
}

export async function loadIncidentById(id) {
  const rows = await sb(`incidents?id=eq.${id}&select=*`);
  return sbOk(rows) && rows.length > 0 ? incidentFromRow(rows[0]) : null;
}

export async function createIncident(rec, createdBy) {
  if (!rec.incidentNo?.trim() || !rec.occurredAt) {
    return { __error: true, message: "شماره حادثه و تاریخ وقوع الزامی است" };
  }
  const payload = { ...incidentToDb(rec), id: uid("inc"), company_id: getCurrentCompanyId(), created_by: createdBy || "" };
  const rows = await sb("incidents", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت حادثه — شاید این شماره‌ی حادثه قبلاً استفاده شده باشد" };
  return incidentFromRow(rows[0]);
}

export async function updateIncident(id, rec) {
  const payload = { ...incidentToDb(rec), updated_at: new Date().toISOString() };
  const rows = await sb(`incidents?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی" };
  return incidentFromRow(rows[0]);
}

export async function deleteIncident(id) {
  const rows = await sb(`incidents?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  if (!sbOk(rows)) return { __error: true, message: "خطا در حذف حادثه" };
  return { ok: true };
}
