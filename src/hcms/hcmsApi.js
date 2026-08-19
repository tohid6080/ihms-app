import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

/**
 * HCMS (سیستم مدیریت و کنترل خطرات) — پیاده‌سازی دقیق ساختار فایل مرجع
 * HCMS2.xlsx: ستون‌ها، گروه‌بندی ۴ دسته (انسان/تجهیزات/محیط‌زیست/اعتبار)
 * برای ریسک اولیه و ریسک باقیمانده، و منطق محاسبه‌ی خودکار سطح ریسک از
 * روی کد RPN («۴C» یعنی شدت=۴، احتمال=C).
 *
 * نکته‌ی مهم درباره‌ی ماتریس سطح ریسک: طبق تأیید کاربر، ماتریس واقعی سه
 * سطح دارد — زرد=کم (Low)، نارنجی=متوسط (Medium)، قرمز=زیاد (High) — نه
 * بیشتر. حد دقیق عددی هر باند (که دقیقاً کدام RPN عددی مرز بین دو رنگ است)
 * از استخراج متنی PDF قابل تشخیص نبود، پس یک فرمول استاندارد صنعتی سه‌بخشی
 * (شدت × شماره‌ی احتمال) به کار رفته — و این قابل‌تنظیم است: هر خانه‌ای که
 * ادمین در جدول hcms_risk_matrix به‌صورت دستی override کند، به همان مقدار
 * احترام گذاشته می‌شود؛ فقط خانه‌های تعریف‌نشده از فرمول پیش‌فرض استفاده
 * می‌کنند.
 */

const PROBABILITY_INDEX = { A: 1, B: 2, C: 3, D: 4, E: 5 };

// یک کد RPN مثل "4C" را به {severity, letter} تجزیه می‌کند؛ اگر نامعتبر
// بود null برمی‌گرداند (نه اینکه بی‌صدا محاسبه‌ی غلط انجام دهد)
export function parseRpnCode(code) {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  const match = /^([0-5])([A-E])$/.exec(trimmed);
  if (!match) return null;
  return { severity: Number(match[1]), letter: match[2] };
}

function formulaLevel(severity, letter) {
  if (severity === 0) return "Low";
  const idx = PROBABILITY_INDEX[letter];
  if (!idx) return null;
  const rpn = severity * idx;
  // سه سطح مطابق ماتریس واقعی: زرد=کم، نارنجی=متوسط، قرمز=زیاد (حداکثر RPN = 5×5 = 25)
  if (rpn <= 8) return "Low";
  if (rpn <= 15) return "Medium";
  return "High";
}

export const RISK_LEVEL_META = {
  Low: { label: "کم (Low)", color: "#92400e", bg: "#fef9c3" },        // زرد
  Medium: { label: "متوسط (Medium)", color: "#9a3412", bg: "#fed7aa" }, // نارنجی
  High: { label: "زیاد (High)", color: "#991b1b", bg: "#fecaca" },      // قرمز
};

let _matrixCache = null;
async function loadMatrixOverrides() {
  if (_matrixCache) return _matrixCache;
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`hcms_risk_matrix?select=*${filter}`);
  _matrixCache = sbOk(rows) ? rows : [];
  return _matrixCache;
}
export function invalidateMatrixCache() { _matrixCache = null; }

// ---------- مدیریت کامل ماتریس (برای صفحه‌ی ادمین) ----------
// شش سطح شدت (۰ تا ۵) در پنج سطح احتمال (A تا E) = ۳۰ خانه‌ی واقعی، دقیقاً
// مطابق فایل مرجع. برای هرکدام، سطح فعلی (override دستی اگر بود، وگرنه
// فرمول پیش‌فرض) را برمی‌گرداند تا در یک جدول قابل‌کلیک نمایش داده شود.
export const SEVERITY_CODES = [0, 1, 2, 3, 4, 5];
export const PROBABILITY_LETTERS = ["A", "B", "C", "D", "E"];

export async function loadFullMatrix() {
  const overrides = await loadMatrixOverrides();
  const grid = [];
  for (const severity of SEVERITY_CODES) {
    for (const letter of PROBABILITY_LETTERS) {
      const override = overrides.find((r) => r.severity_code === severity && r.probability_letter === letter);
      grid.push({
        severity, letter,
        level: override ? override.risk_level : formulaLevel(severity, letter),
        isOverride: !!override,
      });
    }
  }
  return grid;
}

export async function setMatrixCell(severity, letter, level) {
  const companyId = getCurrentCompanyId();
  const existing = await sb(`hcms_risk_matrix?severity_code=eq.${severity}&probability_letter=eq.${letter}${companyId ? `&company_id=eq.${companyId}` : "&company_id=is.null"}&select=id`);
  if (sbOk(existing) && existing.length > 0) {
    const result = await sb(`hcms_risk_matrix?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify({ risk_level: level }) });
    invalidateMatrixCache();
    if (!sbOk(result)) return { __error: true, message: "خطا در ذخیره‌سازی" };
    return { ok: true };
  }
  const result = await sb("hcms_risk_matrix", { method: "POST", body: JSON.stringify([{ severity_code: severity, probability_letter: letter, risk_level: level, company_id: companyId }]) });
  invalidateMatrixCache();
  if (!sbOk(result)) return { __error: true, message: "خطا در ذخیره‌سازی" };
  return { ok: true };
}

// سطح ریسک یک کد RPN را برمی‌گرداند — اول override دستی ادمین را چک
// می‌کند، بعد فرمول پیش‌فرض. اگر کد نامعتبر بود، null (نه یک حدس اشتباه)
export async function computeRiskLevel(rpnCode) {
  const parsed = parseRpnCode(rpnCode);
  if (!parsed) return null;
  const overrides = await loadMatrixOverrides();
  const override = overrides.find((r) => r.severity_code === parsed.severity && r.probability_letter === parsed.letter);
  if (override) return override.risk_level;
  return formulaLevel(parsed.severity, parsed.letter);
}

// بدترین (بالاترین) سطح از میان چند سطح — برای «سطح کلی» از بین ۴ دسته
const LEVEL_RANK = { Low: 1, Medium: 2, High: 3 };
export function worstLevel(levels) {
  const valid = levels.filter(Boolean);
  if (valid.length === 0) return null;
  return valid.reduce((worst, l) => (LEVEL_RANK[l] > LEVEL_RANK[worst] ? l : worst));
}

// ---------- نگاشت رکورد ----------

function rowFromDb(r) {
  return {
    id: r.id,
    rowNumber: r.row_number,
    process: r.process || "",
    activity: r.activity || "",
    activityType: r.activity_type || "",
    unit: r.unit || "",
    equipment: r.equipment || "",
    hazard: r.hazard || "",
    environmentalAspect: r.environmental_aspect || "",
    riskOrOpportunity: r.risk_or_opportunity || "",
    cause: r.cause || "",
    consequence: r.consequence || "",
    existingControls: r.existing_controls || "",
    defensiveBarriers: r.defensive_barriers || "",
    legalRequirement: r.legal_requirement || "",

    initialRpn: { human: r.initial_rpn_human || "", equipment: r.initial_rpn_equipment || "", environment: r.initial_rpn_environment || "", reputation: r.initial_rpn_reputation || "" },
    initialLevel: { human: r.initial_level_human || "", equipment: r.initial_level_equipment || "", environment: r.initial_level_environment || "", reputation: r.initial_level_reputation || "" },
    initialLevelOverall: r.initial_level_overall || "",

    permitToWork: r.permit_to_work || "",
    proposedControls: r.proposed_controls || "",
    recoveryPlan: r.recovery_plan || "",
    responsiblePerson: r.responsible_person || "",
    targetDate: r.target_date || "",
    proposedControlsResult: r.proposed_controls_result || "",

    residualRpn: { human: r.residual_rpn_human || "", equipment: r.residual_rpn_equipment || "", environment: r.residual_rpn_environment || "", reputation: r.residual_rpn_reputation || "" },
    residualLevel: { human: r.residual_level_human || "", equipment: r.residual_level_equipment || "", environment: r.residual_level_environment || "", reputation: r.residual_level_reputation || "" },
    residualLevelOverall: r.residual_level_overall || "",

    emergencyCondition: r.emergency_condition || "",
    criticalElement: r.critical_element || "",
    linkedAnomalyId: r.linked_anomaly_id || "",
    status: r.status || "active",
    createdBy: r.created_by || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// چهار دسته را می‌گیرد، برای هرکدام سطح را محاسبه می‌کند و «سطح کلی» (بدترین) را هم برمی‌گرداند
async function computeFourCategoryLevels(rpn) {
  const [human, equipment, environment, reputation] = await Promise.all([
    computeRiskLevel(rpn.human), computeRiskLevel(rpn.equipment), computeRiskLevel(rpn.environment), computeRiskLevel(rpn.reputation),
  ]);
  return { levels: { human, equipment, environment, reputation }, overall: worstLevel([human, equipment, environment, reputation]) };
}

function toDbPayload(rec) {
  return {
    row_number: rec.rowNumber || null,
    process: rec.process || "",
    activity: rec.activity || "",
    activity_type: rec.activityType || "",
    unit: rec.unit || "",
    equipment: rec.equipment || "",
    hazard: rec.hazard || "",
    environmental_aspect: rec.environmentalAspect || "",
    risk_or_opportunity: rec.riskOrOpportunity || "",
    cause: rec.cause || "",
    consequence: rec.consequence || "",
    existing_controls: rec.existingControls || "",
    defensive_barriers: rec.defensiveBarriers || "",
    legal_requirement: rec.legalRequirement || "",

    initial_rpn_human: rec.initialRpn?.human || "",
    initial_rpn_equipment: rec.initialRpn?.equipment || "",
    initial_rpn_environment: rec.initialRpn?.environment || "",
    initial_rpn_reputation: rec.initialRpn?.reputation || "",

    permit_to_work: rec.permitToWork || "",
    proposed_controls: rec.proposedControls || "",
    recovery_plan: rec.recoveryPlan || "",
    responsible_person: rec.responsiblePerson || "",
    target_date: rec.targetDate || "",
    proposed_controls_result: rec.proposedControlsResult || "",

    residual_rpn_human: rec.residualRpn?.human || "",
    residual_rpn_equipment: rec.residualRpn?.equipment || "",
    residual_rpn_environment: rec.residualRpn?.environment || "",
    residual_rpn_reputation: rec.residualRpn?.reputation || "",

    emergency_condition: rec.emergencyCondition || "",
    critical_element: rec.criticalElement || "",
    linked_anomaly_id: rec.linkedAnomalyId || null,
    status: rec.status || "active",
  };
}

// ---------- CRUD ----------

export async function loadHcmsAssessments() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`hcms_risk_assessments?select=*&order=created_at.desc${filter}`);
  return (sbOk(rows) ? rows : []).map(rowFromDb);
}

export async function loadHcmsByAnomaly(anomalyId) {
  const rows = await sb(`hcms_risk_assessments?linked_anomaly_id=eq.${encodeURIComponent(anomalyId)}&select=*`);
  return (sbOk(rows) ? rows : []).map(rowFromDb);
}

// رکورد را ذخیره می‌کند و بلافاصله سطح‌های محاسبه‌شده (اولیه و باقیمانده) را
// هم روی همان رکورد PATCH می‌کند — یعنی کاربر فقط RPN را وارد می‌کند، همه‌ی
// فیلدهای وابسته (سطح هر دسته + سطح کلی) خودکار پر می‌شوند.
export async function saveHcmsAssessment(rec) {
  const payload = toDbPayload(rec);
  const initial = await computeFourCategoryLevels(rec.initialRpn || {});
  const residual = await computeFourCategoryLevels(rec.residualRpn || {});
  Object.assign(payload, {
    initial_level_human: initial.levels.human, initial_level_equipment: initial.levels.equipment,
    initial_level_environment: initial.levels.environment, initial_level_reputation: initial.levels.reputation,
    initial_level_overall: initial.overall,
    residual_level_human: residual.levels.human, residual_level_equipment: residual.levels.equipment,
    residual_level_environment: residual.levels.environment, residual_level_reputation: residual.levels.reputation,
    residual_level_overall: residual.overall,
  });

  if (rec.id) {
    const rows = await sb(`hcms_risk_assessments?id=eq.${rec.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی: " + (rows?.message || "نامشخص") };
    return rowFromDb(rows[0]);
  }
  // id عمداً اینجا ست نمی‌شود — ستون id در جدول از نوع uuid است و خودش با
  // gen_random_uuid() مقداردهی می‌شود؛ فرستادن یک رشته‌ی سفارشی مثل
  // «hcms-...» روی آن، دقیقاً همان خطای «invalid input syntax for type
  // uuid» را می‌داد که باعث می‌شد ساخت خودکار HCMS از روی آنومالی شکست بخورد.
  payload.created_by = rec.createdBy || "";
  payload.company_id = getCurrentCompanyId();
  const rows = await sb("hcms_risk_assessments", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت: " + (rows?.message || "نامشخص") };
  return rowFromDb(rows[0]);
}

export async function deleteHcmsAssessment(id) {
  const result = await sb(`hcms_risk_assessments?id=eq.${id}`, { method: "DELETE" });
  if (!sbOk(result)) return { __error: true, message: "خطا در حذف: " + (result?.message || "نامشخص") };
  return { ok: true };
}

// ---------- پیشنهاد خودکار ارزیابی ریسک از روی آنومالی ----------
// این «هوش مصنوعی» به معنای فراخوانی یک مدل زبانی نیست — یک منطق قانون‌محور
// و قابل‌توضیح است، که برای یک ارزیابی ایمنی که روی آن تصمیم‌گیری واقعی
// انجام می‌شود، عمداً انتخاب شده (تا نتیجه همیشه یکسان، قابل‌ردیابی و
// قابل‌اعتماد باشد، نه یک حدس احتمالاتی). خروجی همیشه با وضعیت
// «در انتظار بررسی» ذخیره می‌شود و تا وقتی کارفرما صریحاً تأیید نکند،
// نهایی محسوب نمی‌شود.
const SEVERITY_BY_RISK_LEVEL = { High: 4, Med: 2, Low: 1 };

export async function createSuggestedHcmsFromAnomaly(anomaly, hazardText, createdBy) {
  const existing = await loadHcmsByAnomaly(anomaly.id);
  if (existing.length > 0) return existing[0];

  const suggestedSeverity = SEVERITY_BY_RISK_LEVEL[anomaly.riskLevel] ?? 2;

  // احتمال پیشنهادی: هرچه همین دسته‌بندی آنومالی در ۹۰ روز اخیر بیشتر تکرار
  // شده باشد، احتمال وقوع بالاتری پیشنهاد داده می‌شود
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentRows = await sb(`anomalies?category=eq.${encodeURIComponent(anomaly.category || "")}&date=gte.${since}&select=id${filter}`);
  const recentCount = sbOk(recentRows) ? recentRows.length : 0;
  const suggestedLetter = recentCount >= 5 ? "E" : recentCount >= 3 ? "D" : recentCount >= 1 ? "C" : "B";
  const suggestedRpn = `${suggestedSeverity}${suggestedLetter}`;

  const isEnvironment = anomaly.category === "Environment";
  const draft = {
    activity: anomaly.category || "",
    hazard: isEnvironment ? "" : hazardText,
    environmentalAspect: isEnvironment ? hazardText : "",
    consequence: `پیشنهاد سیستم بر اساس دسته‌بندی «${anomaly.category || "—"}» و سطح ریسک «${anomaly.riskLevel || "—"}» ثبت‌شده در آنومالی — پیش از تأیید نهایی بررسی و در صورت نیاز اصلاح شود.`,
    cause: anomaly.description || "",
    linkedAnomalyId: anomaly.id,
    createdBy: createdBy || "",
    status: "pending_review",
    initialRpn: { human: isEnvironment ? "" : suggestedRpn, equipment: "", environment: isEnvironment ? suggestedRpn : "", reputation: "" },
    residualRpn: {},
  };
  return saveHcmsAssessment(draft);
}

export async function approveHcmsAssessment(id) {
  const rows = await sb(`hcms_risk_assessments?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در تأیید نهایی" };
  return rowFromDb(rows[0]);
}

// ---------- یکپارچگی با آنومالی (ساخت دستی توسط ادمین/کارفرما از داخل HCMS) ----------
// اگر برای این آنومالی از قبل ارزیابی HCMS ساخته شده، همان را برمی‌گرداند؛
// وگرنه یک پیش‌نویس جدید می‌سازد و شرح آنومالی را — بر اساس دسته‌بندی‌اش —
// در ستون «خطر» (ایمنی/بهداشت) یا «جنبه‌های زیست‌محیطی» (Environment) پر
// می‌کند.
export async function getOrCreateHcmsForAnomaly(anomaly, createdBy) {
  const existing = await loadHcmsByAnomaly(anomaly.id);
  if (existing.length > 0) return existing[0];

  const isEnvironment = anomaly.category === "Environment";
  const draft = {
    activity: anomaly.category || "",
    hazard: isEnvironment ? "" : anomaly.description || "",
    environmentalAspect: isEnvironment ? anomaly.description || "" : "",
    consequence: "",
    linkedAnomalyId: anomaly.id,
    createdBy: createdBy || "",
    initialRpn: {}, residualRpn: {},
  };
  return saveHcmsAssessment(draft);
}
