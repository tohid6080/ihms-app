import { sb, sbOk, uid, getCurrentCompanyId } from "../shared.js";
import { isoToJalali, JALALI_MONTHS } from "../personnel/jalaliDate.jsx";

/**
 * زیرماژول SBS (نمونه‌برداری از رفتارهای ایمنی) — پورت وفادار از
 * sbs-submodule.html: همان ۱۲ دسته/۳۲ کد مصداق (اکنون در دیتابیس،
 * seed‌شده مستقیم از همان فایل)، همان فیلدهای فرم، همان منطق فصلی.
 * جدول مرجع نمایشی (که کاربر گفت لازم نیست) اینجا ساخته نشده.
 */

const SEASON_OF_MONTH_INDEX = {
  1: "بهار", 2: "بهار", 3: "بهار",
  4: "تابستان", 5: "تابستان", 6: "تابستان",
  7: "پاییز", 8: "پاییز", 9: "پاییز",
  10: "زمستان", 11: "زمستان", 12: "زمستان",
};
export const SEASONS = ["بهار", "تابستان", "پاییز", "زمستان"];

// ماه/فصل هرگز جدا ذخیره نمی‌شود — همیشه از observation_date (تاریخ
// میلادی ذخیره‌شده) مشتق می‌شود، تا هیچ‌وقت این دو با هم ناهماهنگ نشوند.
export function jalaliMonthAndSeason(isoDate) {
  const parts = isoToJalali(isoDate);
  if (!parts) return { month: "", season: "" };
  const [, jm] = parts;
  return { month: JALALI_MONTHS[jm - 1], season: SEASON_OF_MONTH_INDEX[jm] };
}

// ---------- مرجع: دسته‌ها + کدهای مصداق ----------

export async function loadSbsCategories() {
  const [catsRes, subsRes] = await Promise.all([
    sb("sbs_ref_category?select=*&order=sort_order.asc"),
    sb("sbs_ref_subitem?select=*&order=sort_order.asc"),
  ]);
  const cats = sbOk(catsRes) ? catsRes : [];
  const subs = sbOk(subsRes) ? subsRes : [];
  return cats.map((c) => ({
    code: c.code, titleFa: c.title_fa,
    items: subs.filter((s) => s.category_code === c.code).map((s) => ({ id: s.id, textFa: s.text_fa })),
  }));
}

// ---------- CRUD مشاهدات ----------

function observationFromRow(r) {
  const { month, season } = jalaliMonthAndSeason(r.observation_date);
  return {
    id: r.id, project: r.project || "", contractorOrg: r.contractor_org || "", jobTitle: r.job_title || "",
    observationDate: r.observation_date, observationTime: r.observation_time || "",
    status: r.status, categoryCode: r.category_code || "", subitemId: r.subitem_id || "", note: r.note || "",
    observedBy: r.observed_by || "", createdAt: r.created_at, month, season,
  };
}

export async function loadSbsObservations() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`sbs_observations?select=*&order=observation_date.desc${filter}`);
  return sbOk(rows) ? rows.map(observationFromRow) : [];
}

export async function createSbsObservation(rec, observedBy) {
  if (!rec.observationDate) return { __error: true, message: "تاریخ مشاهده الزامی است" };
  if (!rec.status) return { __error: true, message: "وضعیت مشاهده (ایمن/ناایمن) الزامی است" };
  if (rec.status === "unsafe" && (!rec.categoryCode || !rec.subitemId)) {
    return { __error: true, message: "برای رفتار ناایمن، انتخاب دسته و کد مصداق الزامی است" };
  }
  const payload = {
    id: uid("sbs"), company_id: getCurrentCompanyId(),
    project: rec.project || null, contractor_org: rec.contractorOrg || null, job_title: rec.jobTitle || null,
    observation_date: rec.observationDate, observation_time: rec.observationTime || null,
    status: rec.status,
    category_code: rec.status === "unsafe" ? rec.categoryCode : null,
    subitem_id: rec.status === "unsafe" ? rec.subitemId : null,
    note: rec.note || null, observed_by: observedBy || "",
  };
  const rows = await sb("sbs_observations", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت مشاهده" };
  return observationFromRow(rows[0]);
}

export async function deleteSbsObservation(id) {
  const rows = await sb(`sbs_observations?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  if (!sbOk(rows)) return { __error: true, message: "خطا در حذف مشاهده" };
  return { ok: true };
}

// ---------- تحلیل — عیناً معادل تابع render() در فایل مرجع ----------

export function computeSbsAnalysis(observations, seasonFilter) {
  const filtered = seasonFilter && seasonFilter !== "all" ? observations.filter((o) => o.season === seasonFilter) : observations;

  const total = filtered.length;
  const safe = filtered.filter((o) => o.status === "safe").length;
  const unsafe = filtered.filter((o) => o.status === "unsafe").length;
  const unsafePct = total ? (unsafe / total) * 100 : 0;

  const catCounts = {};
  filtered.forEach((o) => {
    if (o.status === "unsafe" && o.categoryCode) catCounts[o.categoryCode] = (catCounts[o.categoryCode] || 0) + 1;
  });
  const categoryBars = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  // کارت‌های مقایسه‌ی فصلی همیشه روی کل داده (مستقل از فیلتر) محاسبه می‌شود
  const seasonSummary = SEASONS.map((s) => {
    const rows = observations.filter((o) => o.season === s);
    const sSafe = rows.filter((o) => o.status === "safe").length;
    const sUnsafe = rows.filter((o) => o.status === "unsafe").length;
    const sTotal = sSafe + sUnsafe;
    return { season: s, total: sTotal, unsafe: sUnsafe, unsafePct: sTotal ? (sUnsafe / sTotal) * 100 : null };
  });

  return { filtered, total, safe, unsafe, unsafePct, categoryBars, seasonSummary };
}

// ---------- واگذاری حجم نمونه به پیمانکار ----------
// طبق خواسته‌ی صریح: کارفرما/سرپرست HSE محاسبه می‌کند و برای پیمانکار
// ارسال می‌کند؛ پیمانکار همان هدف را می‌بیند و پیشرفت واقعی‌اش (از روی
// مشاهدات واقعاً ثبت‌شده در sbs_observations) محاسبه می‌شود — نه یک عدد جدا.

function assignmentFromRow(r) {
  return {
    id: r.id, contractorId: r.contractor_id || "", mode: r.mode,
    pilotTotal: r.pilot_total, pilotUnsafe: r.pilot_unsafe, precisionPct: r.precision_pct != null ? Number(r.precision_pct) : null,
    calculatedP: r.calculated_p != null ? Number(r.calculated_p) : null,
    totalSampleSize: r.total_sample_size, population: r.population, perPerson: r.per_person,
    workshopBreakdown: r.workshop_breakdown || null, note: r.note || "",
    status: r.status, createdBy: r.created_by || "", createdAt: r.created_at,
  };
}

// طرف کارفرما — همه‌ی هدف‌هایی که خودش (یا سرپرست HSE شرکتش) صادر کرده
export async function loadSbsAssignments() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`sbs_sample_size_assignments?select=*&order=created_at.desc${filter}`);
  return sbOk(rows) ? rows.map(assignmentFromRow) : [];
}

// طرف پیمانکار — فقط هدف‌هایی که برایش (یا برای همه‌ی پیمانکاران، یعنی
// contractor_id=null) صادر شده
export async function loadSbsAssignmentsForContractor(contractorId) {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`sbs_sample_size_assignments?select=*&order=created_at.desc${filter}&or=(contractor_id.is.null,contractor_id.eq.${contractorId})`);
  return sbOk(rows) ? rows.map(assignmentFromRow) : [];
}

export async function createSbsAssignment(rec, createdBy) {
  if (!rec.totalSampleSize || rec.totalSampleSize <= 0) return { __error: true, message: "حجم نمونه‌ی محاسبه‌شده نامعتبر است" };
  const payload = {
    id: uid("sbsassign"), company_id: getCurrentCompanyId(), contractor_id: rec.contractorId || null,
    mode: rec.mode, pilot_total: rec.pilotTotal || null, pilot_unsafe: rec.pilotUnsafe || null,
    precision_pct: rec.precisionPct || null, calculated_p: rec.calculatedP || null,
    total_sample_size: rec.totalSampleSize, population: rec.population || null, per_person: rec.perPerson || null,
    workshop_breakdown: rec.workshopBreakdown || null, note: rec.note || null, status: "sent", created_by: createdBy || "",
  };
  const rows = await sb("sbs_sample_size_assignments", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ارسال هدف نمونه‌برداری" };
  return assignmentFromRow(rows[0]);
}

export async function updateSbsAssignmentStatus(id, status) {
  const rows = await sb(`sbs_sample_size_assignments?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در به‌روزرسانی وضعیت" };
  return { ok: true };
}

export async function deleteSbsAssignment(id) {
  const rows = await sb(`sbs_sample_size_assignments?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  if (!sbOk(rows)) return { __error: true, message: "خطا در حذف" };
  return { ok: true };
}

// پیشرفت واقعی یک هدف — از شمارش مستقیم مشاهدات ثبت‌شده‌ی همان پیمانکار
// (بر اساس contractor_org آزاد فعلی مشاهدات، تطبیق با نام پیمانکار)
export function computeAssignmentProgress(assignment, observations, contractorName) {
  const relevant = assignment.contractorId
    ? observations.filter((o) => (o.contractorOrg || "").trim() === (contractorName || "").trim())
    : observations;
  const done = relevant.length;
  const target = assignment.totalSampleSize;
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return { done, target, pct };
}
