import { sb, sbOk, uid, getCurrentCompanyId } from "../shared.js";

/**
 * HCMS (سیستم مدیریت و کنترل خطرات) — پیاده‌سازی دقیق ساختار فایل مرجع
 * HCMS2.xlsx: ستون‌ها، گروه‌بندی ۴ دسته (انسان/تجهیزات/محیط‌زیست/اعتبار)
 * برای ریسک اولیه و ریسک باقیمانده، و منطق محاسبه‌ی خودکار سطح ریسک از
 * روی کد RPN («۴C» یعنی شدت=۴، احتمال=C).
 *
 * نکته‌ی صادقانه درباره‌ی ماتریس سطح ریسک: فایل PDF پیوست‌شده رنگ‌بندی/
 * بانددهی دقیق هر خانه را در استخراج متنی نشان نمی‌داد (فقط توضیح شدت و
 * احتمال). بنابراین اینجا از یک فرمول استاندارد صنعتی (شدت × شماره‌ی
 * احتمال) با باندهای معمول Low/Medium/High/VeryHigh استفاده شده — و این
 * قابل‌تنظیم است: هر خانه‌ای که ادمین در جدول hcms_risk_matrix به‌صورت
 * دستی override کند، به همان مقدار احترام گذاشته می‌شود؛ فقط خانه‌های
 * تعریف‌نشده از فرمول پیش‌فرض استفاده می‌کنند.
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
  if (rpn <= 4) return "Low";
  if (rpn <= 9) return "Medium";
  if (rpn <= 15) return "High";
  return "VeryHigh";
}

export const RISK_LEVEL_META = {
  Low: { label: "کم (Low)", color: "#166534", bg: "#dcfce7" },
  Medium: { label: "متوسط (Medium)", color: "#92400e", bg: "#fef3c7" },
  High: { label: "زیاد (High)", color: "#c2410c", bg: "#ffedd5" },
  VeryHigh: { label: "بحرانی (Very High)", color: "#991b1b", bg: "#fee2e2" },
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
const LEVEL_RANK = { Low: 1, Medium: 2, High: 3, VeryHigh: 4 };
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
  payload.id = uid("hcms");
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

// ---------- یکپارچگی با آنومالی ----------

// اگر برای این آنومالی از قبل ارزیابی HCMS ساخته شده، همان را برمی‌گرداند؛
// وگرنه یک پیش‌نویس جدید می‌سازد و شرح آنومالی را — بر اساس دسته‌بندی‌اش —
// در ستون «خطر» (ایمنی/بهداشت) یا «جنبه‌های زیست‌محیطی» (Environment) پر
// می‌کند.
export async function getOrCreateHcmsForAnomaly(anomaly, createdBy) {
  const existing = await loadHcmsByAnomaly(anomaly.id);
  if (existing.length > 0) return existing[0];

  const isEnvironment = anomaly.category === "Environment";
  const draft = {
    activity: anomaly.area || "",
    hazard: isEnvironment ? "" : anomaly.description || "",
    environmentalAspect: isEnvironment ? anomaly.description || "" : "",
    consequence: "",
    linkedAnomalyId: anomaly.id,
    createdBy: createdBy || "",
    initialRpn: {}, residualRpn: {},
  };
  return saveHcmsAssessment(draft);
}
