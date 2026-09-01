import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

/**
 * DBEE — Weight های قابل‌تنظیم. مقیاس هر وزن ۰ تا ۲ (۱=خنثی). این
 * تضمین می‌کند «امتیاز محاسباتی دستی قابل‌تغییر نباشد» — Admin هر شرکت
 * فقط وزن عامل‌ها را برای همان شرکت عوض می‌کند، هرگز عدد نهایی هیچ
 * Barrier ای را مستقیم. هر شرکت وزن‌دهی مستقل خودش را دارد (نه یک
 * تنظیم سراسری سوپرادمین) — طبق خواسته‌ی صریح.
 */

export const FACTOR_LABELS = {
  frequency: "فراوانی (Frequency)", severity: "شدت (Severity)", recurrence: "تکرار (Recurrence)",
  criticality: "بحرانی‌بودن (Criticality)", recency: "تازگی (Recency)",
  source_anomaly: "منبع: Anomaly", source_capa: "منبع: CAPA", source_incident: "منبع: Incident",
  source_tripod: "منبع: Tripod Beta / RCA", source_sbs: "منبع: SBS",
  source_hse_climate: "منبع: HSE Climate", source_accident_proneness: "منبع: استعداد حادثه‌پذیری",
};

// خروجی: { factor_key: weight } — فقط برای شرکت جاری. اگر هنوز seed
// نشده باشد (حالت نظری، چون Trigger/seed اولیه این را پوشش می‌دهد)،
// map خالی برمی‌گردد و موتور محاسبه از پیش‌فرض ۱٫۰ استفاده می‌کند.
export async function loadWeights() {
  const companyId = getCurrentCompanyId();
  if (!companyId) return {};
  const rows = await sb(`dbee_weights?company_id=eq.${companyId}&select=factor_key,weight`);
  if (!sbOk(rows)) return {};
  const map = {};
  rows.forEach((r) => { map[r.factor_key] = Number(r.weight); });
  return map;
}

// نسخه‌ی کامل (با id/updatedBy) برای UI مدیریت — فقط ردیف‌های همین شرکت
export async function loadCompanyWeights() {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  const rows = await sb(`dbee_weights?company_id=eq.${companyId}&select=*&order=factor_key.asc`);
  return sbOk(rows) ? rows.map((r) => ({ id: r.id, factorKey: r.factor_key, weight: Number(r.weight), updatedBy: r.updated_by || "", updatedAt: r.updated_at })) : [];
}

// نوشتن — RLS خودش تضمین می‌کند فقط Admin همین شرکت اجازه دارد (نگاه
// کنید به policy "company admin update" در SQL). طبق یک باگ واقعی که
// پیدا شد: اگر RLS این UPDATE را بی‌صدا مسدود کند (رفتار استاندارد
// PostgREST — درخواست HTTP موفق برمی‌گردد ولی نتیجه [] است، یعنی صفر
// ردیف واقعاً تغییر کرد)، این را صریحاً به‌عنوان خطا تشخیص می‌دهیم —
// نه یک «موفقیت» ساختگی که فقط باعث می‌شود کاربر فکر کند ذخیره شد.
export async function saveCompanyWeight(id, weight, updatedBy) {
  if (weight < 0 || weight > 2) return { __error: true, message: "وزن باید بین ۰ تا ۲ باشد" };
  const rows = await sb(`dbee_weights?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ weight, updated_by: updatedBy || "", updated_at: new Date().toISOString() }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی وزن — فقط ادمین همین شرکت مجاز است" };
  if (rows.length === 0) return { __error: true, message: "ذخیره انجام نشد: دسترسی شما برای تغییر وزن‌دهی این شرکت تأیید نشد. لطفاً مطمئن شوید با نقش کارفرما یا ادمین شرکت وارد شده‌اید." };
  return { ok: true };
}
