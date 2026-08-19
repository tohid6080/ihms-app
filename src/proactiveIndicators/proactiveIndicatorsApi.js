import { sb, sbOk, getCurrentCompanyId, loadCurrentCompanyPlanFeatures, isModuleInPlan } from "../shared.js";
import { scoreHseClimate, isCompleteHseClimate } from "./hseClimateScoring.js";

/**
 * ماژول شاخص‌های Proactive HSE — طراحی Dynamic:
 * هر شاخص (indicator) یک key دارد و بانک سؤالات مخصوص خودش را در
 * proactive_indicator_questions دارد. افزودن یک شاخص جدید (مثل HSE
 * Climate) در آینده فقط با درج یک ردیف تعریف + سؤالاتش انجام می‌شود —
 * فرمول محاسبه‌ی امتیاز هم عمومی است (جمع پاسخ خام، یا ۶ منهای پاسخ خام
 * برای سؤالات reverse) و به هیچ شاخص خاصی وابسته نیست.
 *
 * HSE Climate یک شاخص «بعدی» (dimension-based) است — بر خلاف استعداد
 * حادثه‌پذیری که فقط یک امتیاز خام دارد، اینجا هر بعد جدا به ۰..۱۰
 * نرمال می‌شود و امتیاز نهایی جمع ۹ بعد (۰..۹۰) است. محاسبه‌ی دقیق آن
 * مستقیماً از scoreHseClimate در hseClimateScoring.js (فایل مرجع
 * ارائه‌شده) انجام می‌شود، نه با بازنویسی فرمول.
 */

// مشاغلی که ورودشان به سایت مستلزم ارزیابی استعداد حادثه‌پذیری است —
// دقیقاً طبق فهرست درخواستی؛ جدا از SPECIAL_JOB_TITLES موجود (که برای
// «فرم تأیید صلاحیت» است، نه این شاخص) تا آن منطق دست‌نخورده بماند.
export const ACCIDENT_PRONENESS_CRITICAL_JOBS = [
  "نصاب", "برقکار", "داربست‌بند", "راننده ماشین‌آلات سبک", "راننده ماشین‌آلات سنگین",
  "تنش‌زدا", "اپراتور جرثقیل", "ریگر",
];

export function needsAccidentPronenessAssessment(jobTitle) {
  return ACCIDENT_PRONENESS_CRITICAL_JOBS.includes((jobTitle || "").trim());
}

// پلکان دقیق سطح‌بندی امتیاز — طبق مقادیر صریح اعلام‌شده (بازه‌ی کل ۳۹..۱۹۵):
// ۳۹-۷۸ پایین (سبز)، ۷۹-۱۱۷ متوسط (آبی)، ۱۱۸-۱۵۶ بالا (نارنجی)، ۱۵۷-۱۹۵ بسیار بالا (قرمز)
export function accidentPronenessLevel(score) {
  if (score >= 157) return { level: "بسیار بالا", color: "#dc2626", bg: "#fee2e2" };
  if (score >= 118) return { level: "بالا", color: "#ea580c", bg: "#ffedd5" };
  if (score >= 79) return { level: "متوسط", color: "#2563eb", bg: "#dbeafe" };
  return { level: "پایین", color: "#16a34a", bg: "#dcfce7" };
}

// بررسی جداگانه‌ی فعال‌بودن شاخص برای شرکت — چون needsAccidentPronenessAssessment
// عمداً همگام (sync) باقی می‌ماند (در JSX مستقیم صدا زده می‌شود)، این تابع
// جدا و async است تا PersonnelDetail هر دو شرط (شغل بحرانی + فعال‌بودن
// شاخص برای شرکت) را با هم بررسی کند.
export async function isAccidentPronenessEnabledForCompany() {
  const features = await loadCurrentCompanyPlanFeatures();
  return isModuleInPlan(features, "accidentProneness");
}

// ---------- تعریف شاخص‌ها — فقط آن‌هایی که «زیرماژول فعال» پلنِ همین شرکت‌اند ----------
// طبق خواسته‌ی صریح: کنترل فعال/غیرفعال هر شاخص دیگر از طریق یک سوییچ
// جداگانه‌ی هر شرکت نیست؛ فقط از طریق ماژول‌ها/زیرماژول‌های فعال همان پلنی
// که برای شرکت تخصیص داده شده انجام می‌شود (نگاه کنید به PLAN_FEATURES در
// superAdminApi.js: کلید accidentProneness و hseClimate زیر proactiveIndicators).

export async function loadActiveIndicators() {
  const [rows, planFeatures] = await Promise.all([
    sb("proactive_indicator_definitions?is_active=eq.true&select=*&order=name.asc"),
    loadCurrentCompanyPlanFeatures(),
  ]);
  const all = sbOk(rows) ? rows.map((r) => ({ key: r.key, name: r.name, description: r.description || "", scaleMin: r.scale_min, scaleMax: r.scale_max })) : [];
  return all.filter((ind) => {
    if (ind.key === "accident_proneness") return isModuleInPlan(planFeatures, "accidentProneness");
    if (ind.key === "hse_climate") return isModuleInPlan(planFeatures, "hseClimate");
    return isModuleInPlan(planFeatures, ind.key); // شاخص‌های آینده هم همین قاعده را دنبال می‌کنند
  });
}

// ---------- بانک سؤالات یک شاخص ----------

export async function loadIndicatorQuestions(indicatorKey) {
  const rows = await sb(`proactive_indicator_questions?indicator_key=eq.${indicatorKey}&select=*&order=order_index.asc`);
  return sbOk(rows) ? rows.map((r) => ({
    id: r.id, number: r.question_number, text: r.question_text, reverse: r.reverse_scored,
    dimensionKey: r.dimension_key || null, dimensionTitle: r.dimension_title || null,
  })) : [];
}

// ---------- محاسبه‌ی امتیاز — عمومی، برای هر شاخصی با سؤالات ۱ تا ۵ و پرچم reverse ----------
// طبق خواسته‌ی صریح، این فرمول از فایل اکسل مرجع استخراج و با نمونه‌ی
// محاسبه‌شده‌ی همان فایل صحت‌سنجی شده: هر سؤال reverse → (۶ - پاسخ خام)،
// در غیر این صورت خودِ پاسخ خام؛ جمع کل روی همه‌ی سؤالات.
export function computeIndicatorScore(questions, answersByQuestionId) {
  let total = 0;
  for (const q of questions) {
    const raw = Number(answersByQuestionId[q.id]);
    if (!raw) continue;
    total += q.reverse ? 6 - raw : raw;
  }
  return total;
}

// ---------- ثبت یک ارزیابی جدید ----------

export async function submitAssessment(indicatorKey, personnelId, jobTitle, assessorName, questions, answersByQuestionId, createdBy) {
  const companyId = getCurrentCompanyId();
  const finalScore = computeIndicatorScore(questions, answersByQuestionId);

  const assessmentPayload = {
    indicator_key: indicatorKey, personnel_id: personnelId, company_id: companyId,
    job_title_snapshot: jobTitle || "", assessor_name: assessorName,
    status: "completed", final_score: finalScore, created_by: createdBy || "",
  };
  const assessmentRows = await sb("proactive_indicator_assessments", { method: "POST", body: JSON.stringify([assessmentPayload]) });
  if (!sbOk(assessmentRows)) return { __error: true, message: "خطا در ثبت ارزیابی" };
  const assessment = assessmentRows[0];

  const answerPayload = questions.map((q) => ({
    assessment_id: assessment.id, question_id: q.id, raw_score: Number(answersByQuestionId[q.id]), company_id: companyId,
  }));
  const answerRows = await sb("proactive_indicator_answers", { method: "POST", body: JSON.stringify(answerPayload), prefer: "return=minimal" });
  if (!sbOk(answerRows)) return { __error: true, message: "ارزیابی ثبت شد اما ذخیره‌ی پاسخ‌ها با خطا مواجه شد" };

  return { ok: true, finalScore, assessmentId: assessment.id };
}

// ---------- ثبت ارزیابی HSE Climate — بر پایه‌ی ۹ بعد ----------
// answersByQuestionNumber باید دقیقاً به شکل {1: 5, 2: 3, ...} باشد (کلید =
// شماره‌ی سؤال، نه UUID) — همان قالبی که scoreHseClimate از فایل مرجع انتظار دارد.
export async function submitHseClimateAssessment(answersByQuestionNumber, assessorName, createdBy) {
  if (!isCompleteHseClimate(answersByQuestionNumber)) {
    return { __error: true, message: "همه‌ی ۴۳ سؤال باید پاسخ داده شوند" };
  }
  const companyId = getCurrentCompanyId();
  // محاسبه‌ی دقیق از موتور ارائه‌شده — نه بازنویسی
  const result = scoreHseClimate(answersByQuestionNumber);

  const assessmentPayload = {
    indicator_key: "hse_climate", personnel_id: null, company_id: companyId,
    job_title_snapshot: "", assessor_name: assessorName,
    status: "completed", final_score: result.totalScore, total_level: result.level,
    dimension_scores: result.dimensions, created_by: createdBy || "",
  };
  const assessmentRows = await sb("proactive_indicator_assessments", { method: "POST", body: JSON.stringify([assessmentPayload]) });
  if (!sbOk(assessmentRows)) return { __error: true, message: "خطا در ثبت ارزیابی" };
  const assessment = assessmentRows[0];

  // پاسخ‌های خام هم ذخیره می‌شوند (طبق questions هر کدام question_id UUID خودشان را دارند)
  const questions = await loadIndicatorQuestions("hse_climate");
  const answerPayload = questions.map((q) => ({
    assessment_id: assessment.id, question_id: q.id, raw_score: Number(answersByQuestionNumber[q.number]), company_id: companyId,
  }));
  await sb("proactive_indicator_answers", { method: "POST", body: JSON.stringify(answerPayload), prefer: "return=minimal" });

  return { ok: true, result, assessmentId: assessment.id };
}

export async function loadHseClimateHistory() {
  const rows = await sb(`proactive_indicator_assessments?indicator_key=eq.hse_climate&select=*&order=assessment_date.desc`);
  return sbOk(rows) ? rows.map((r) => ({
    id: r.id, assessmentDate: r.assessment_date, assessorName: r.assessor_name,
    totalScore: r.final_score != null ? Number(r.final_score) : null, totalLevel: r.total_level,
    dimensionScores: r.dimension_scores || [], createdAt: r.created_at,
  })) : [];
}

export async function loadAssessmentsForPersonnel(personnelId) {
  const rows = await sb(`proactive_indicator_assessments?personnel_id=eq.${personnelId}&select=*&order=assessment_date.desc`);
  return sbOk(rows) ? rows.map(assessmentFromRow) : [];
}

// آخرین ارزیابی «استعداد حادثه‌پذیری» یک پرسنل خاص — برای تشخیص اینکه آیا
// فرم قبلاً تکمیل شده (رفع باگ نمایش دوباره‌ی «ورود به فرم ارزیابی»)
export async function loadLatestAccidentPronenessAssessment(personnelId) {
  if (!personnelId) return null;
  const rows = await sb(`proactive_indicator_assessments?personnel_id=eq.${personnelId}&indicator_key=eq.accident_proneness&select=*&order=assessment_date.desc&limit=1`);
  return sbOk(rows) && rows.length > 0 ? assessmentFromRow(rows[0]) : null;
}

export async function loadAllAssessments(indicatorKey) {
  const filter = indicatorKey ? `&indicator_key=eq.${indicatorKey}` : "";
  const rows = await sb(`proactive_indicator_assessments?select=*,personnel(name,job_title)&order=assessment_date.desc${filter}`);
  return sbOk(rows) ? rows.map(assessmentFromRow) : [];
}

function assessmentFromRow(r) {
  return {
    id: r.id,
    indicatorKey: r.indicator_key,
    personnelId: r.personnel_id,
    personnelName: r.personnel?.name || "",
    jobTitle: r.job_title_snapshot || r.personnel?.job_title || "",
    assessmentDate: r.assessment_date,
    assessorName: r.assessor_name,
    status: r.status,
    finalScore: r.final_score != null ? Number(r.final_score) : null,
    createdAt: r.created_at,
  };
}
