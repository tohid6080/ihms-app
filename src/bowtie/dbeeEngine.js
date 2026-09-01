import { sb, sbOk, uid, getCurrentCompanyId } from "../shared.js";
import { loadAnomalyLinksForBarrier } from "./anomalyBarrierLinksApi.js";
import { loadMappingsForBarrier } from "./dbeeMappingApi.js";
import { loadWeights } from "./dbeeWeightsApi.js";
import { EFFECTIVENESS_STATUS } from "./bowtieApi.js";
import { createAutoCorrectiveActionForBarrier } from "../correctiveActions/correctiveActionsApi.js";

/**
 * DBEE — Dynamic Barrier Effectiveness Engine (موتور هوشمند اثربخشی
 * Barrierها). این فایل جایگزین effectivenessApi.js نیست — effectivenessApi.js
 * («Living BowTie» فاز ۳، فقط Anomaly+CAPA) دست‌نخورده و همچنان فعال
 * می‌ماند (نگاه کنید به توضیح در بالای همان فایل). DBEE یک موتور
 * جدید و کامل‌تر است که همان دو ستون خروجی (bowtie_barriers.effectiveness_score/
 * status) را به‌روزرسانی می‌کند، ولی از ۸ منبع شواهد تغذیه می‌شود.
 *
 * طراحی Modular: هر منبع یک «Evidence Loader» جدا دارد که خروجی یکسانی
 * می‌دهد: { items: [...], penalty: number, breakdown: {...} }. افزودن یک
 * منبع جدید در آینده فقط یعنی یک Loader جدید + یک ردیف در
 * SOURCE_LOADERS — بدون تغییر در هسته‌ی جمع‌بندی/ذخیره‌سازی.
 */

const RECENT_WINDOW_DAYS = 90;
const AUTO_CA_THRESHOLD = 60; // همان آستانه‌ی effectivenessApi.js — برای اقدام اصلاحی خودکار

function daysAgo(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}
function recencyMultiplier(iso) {
  return daysAgo(iso) <= RECENT_WINDOW_DAYS ? 1.4 : 0.6;
}

// ---------- Evidence Loaders — هر منبع، یک تابع مستقل ----------
// هر Loader ورودی‌اش barrier کامل است (id, bowtieId, criticality)، و
// خروجی‌اش { penalty, evidenceCount, detail } — penalty خام (قبل از
// اعمال وزن سطح منبع) است.

// ۱. Anomaly — از anomaly_barrier_links موجود (بدون تغییر منطق قبلی)
async function loadAnomalyEvidence(barrierId) {
  const links = await loadAnomalyLinksForBarrier(barrierId);
  if (links.length === 0) return { penalty: 0, evidenceCount: 0, detail: null };
  const ids = links.map((l) => l.anomalyId);
  const idList = ids.map((id) => `"${id}"`).join(",");
  const rows = await sb(`anomalies?id=in.(${idList})&select=id,risk_level,status,created_at`);
  const anomalies = sbOk(rows) ? rows.map((r) => ({ riskLevel: r.risk_level || "Med", createdAt: r.created_at })) : [];
  const SEVERITY_PENALTY = { High: 15, Med: 8, Low: 3 };
  let penalty = 0;
  anomalies.forEach((a) => { penalty += (SEVERITY_PENALTY[a.riskLevel] ?? 8) * recencyMultiplier(a.createdAt); });
  const recentCount = anomalies.filter((a) => daysAgo(a.createdAt) <= RECENT_WINDOW_DAYS).length;
  if (recentCount >= 5) penalty += 20;
  else if (recentCount >= 3) penalty += 10;
  return { penalty, evidenceCount: anomalies.length, detail: { recentCount } };
}

// ۲. CAPA — اقدامات اصلاحی عمومی (corrective_actions) مستقیم وصل به این Barrier
async function loadCapaEvidence(barrierId) {
  const rows = await sb(`corrective_actions?linked_barrier_id=eq.${barrierId}&select=status`);
  const actions = sbOk(rows) ? rows : [];
  if (actions.length === 0) return { penalty: 0, evidenceCount: 0, detail: null };
  const openCount = actions.filter((a) => a.status !== "closed").length;
  const expiredCount = actions.filter((a) => a.status === "expired").length; // CAPA ناموفق واقعی
  let penalty = 0;
  if (openCount > 0) penalty += 10 + Math.min(openCount - 1, 3) * 5;
  penalty += expiredCount * 15; // طبق خواسته‌ی صریح: CAPA ناموفق وزن بیشتر
  return { penalty, evidenceCount: actions.length, detail: { openCount, expiredCount } };
}

// ۳. Incident — فقط از طریق dbee_source_barrier_map (Mapping صریح کاربر HSE)
async function loadIncidentEvidence(barrierId) {
  const maps = await loadMappingsForBarrier(barrierId);
  const incidentMaps = maps.filter((m) => m.sourceType === "incident");
  if (incidentMaps.length === 0) return { penalty: 0, evidenceCount: 0, detail: null };
  const ids = incidentMaps.map((m) => `"${m.sourceId}"`).join(",");
  const rows = await sb(`incidents?id=in.(${ids})&select=id,is_disabling,lost_days,occurred_at`);
  const incidents = sbOk(rows) ? rows : [];
  const RELEVANCE_MULT = { low: 0.5, medium: 1, high: 1.6 };
  let penalty = 0;
  incidents.forEach((inc) => {
    const mapping = incidentMaps.find((m) => m.sourceId === inc.id);
    const relMult = RELEVANCE_MULT[mapping?.relevance || "medium"];
    const severityBase = inc.is_disabling ? 25 : 12;
    const lostDaysBonus = Math.min(Number(inc.lost_days) || 0, 30) * 0.5; // طبق خواسته: شکست در حادثه‌ی شدید وزن بیشتر
    penalty += (severityBase + lostDaysBonus) * relMult * recencyMultiplier(inc.occurred_at);
  });
  return { penalty, evidenceCount: incidents.length, detail: { incidentIds: incidents.map((i) => i.id) } };
}

// ۴. Tripod Beta / RCA — فقط از طریق Mapping صریح؛ وضعیت REJECTED یعنی
// تحلیل ریشه‌ای رد شده (سیگنال قوی ضعف بریر مرتبط)
async function loadTripodEvidence(barrierId) {
  const maps = await loadMappingsForBarrier(barrierId);
  const tripodMaps = maps.filter((m) => m.sourceType === "tripod_rca");
  if (tripodMaps.length === 0) return { penalty: 0, evidenceCount: 0, detail: null };
  const ids = tripodMaps.map((m) => `"${m.sourceId}"`).join(",");
  const rows = await sb(`tripod_analyses?id=in.(${ids})&select=id,status,created_at`);
  const analyses = sbOk(rows) ? rows : [];
  const RELEVANCE_MULT = { low: 0.5, medium: 1, high: 1.6 };
  let penalty = 0;
  analyses.forEach((a) => {
    const mapping = tripodMaps.find((m) => m.sourceId === a.id);
    const relMult = RELEVANCE_MULT[mapping?.relevance || "medium"];
    const base = a.status === "FINAL" || a.status === "APPROVED" ? 18 : a.status === "REJECTED" ? 22 : 10;
    penalty += base * relMult * recencyMultiplier(a.created_at);
  });
  return { penalty, evidenceCount: analyses.length, detail: { count: analyses.length } };
}

// ۵. SBS — از dbee_source_barrier_map نوع sbs_category (Mapping نوع‌به‌نوع)
// + شمارش واقعی مشاهدات ناایمن همان دسته در ۹۰ روز اخیر (سازمانی، نه فردی)
async function loadSbsEvidence(barrierId, companyId) {
  const maps = await loadMappingsForBarrier(barrierId);
  const sbsMaps = maps.filter((m) => m.sourceType === "sbs_category");
  if (sbsMaps.length === 0) return { penalty: 0, evidenceCount: 0, detail: null };
  const categoryCodes = [...new Set(sbsMaps.map((m) => m.sourceId))];
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const RELEVANCE_MULT = { low: 0.5, medium: 1, high: 1.6 };
  let penalty = 0;
  let totalCount = 0;
  const perCategory = await Promise.all(categoryCodes.map((code) =>
    sb(`sbs_observations?status=eq.unsafe&category_code=eq.${code}${filter}&select=observation_date`)
  ));
  categoryCodes.forEach((code, i) => {
    const obs = sbOk(perCategory[i]) ? perCategory[i] : [];
    const mapping = sbsMaps.find((m) => m.sourceId === code);
    const relMult = RELEVANCE_MULT[mapping?.relevance || "medium"];
    obs.forEach((o) => { penalty += 4 * relMult * recencyMultiplier(o.observation_date); });
    totalCount += obs.length;
  });
  return { penalty, evidenceCount: totalCount, detail: { categoryCodes } };
}

// ۶. HSE Climate — از dbee_source_barrier_map نوع hse_climate_dimension؛
// نیاز به میانگین واقعی همان بُعد برای شرکت (از تابع دیتابیسی موجود)
async function loadHseClimateEvidence(barrierId, companyId) {
  const maps = await loadMappingsForBarrier(barrierId);
  const climateMaps = maps.filter((m) => m.sourceType === "hse_climate_dimension");
  if (climateMaps.length === 0 || !companyId) return { penalty: 0, evidenceCount: 0, detail: null };
  const aggRows = await sb("rpc/get_hse_climate_aggregate", { method: "POST", body: JSON.stringify({ p_company_id: companyId }) });
  if (!sbOk(aggRows) || aggRows.length === 0) return { penalty: 0, evidenceCount: 0, detail: null };
  const dims = aggRows[0].dimension_averages || [];
  const RELEVANCE_MULT = { low: 0.5, medium: 1, high: 1.6 };
  let penalty = 0;
  let matchedCount = 0;
  climateMaps.forEach((m) => {
    const dim = dims.find((d) => d.id === m.sourceId);
    if (!dim) return;
    matchedCount++;
    const relMult = RELEVANCE_MULT[m.relevance || "medium"];
    // امتیاز هر بُعد ۰ تا ۱۰ است؛ هرچه پایین‌تر، جریمه بیشتر (حداکثر جریمه‌ی پایه ۱۵)
    const dimPenalty = Math.max(0, (7 - Number(dim.score)) / 7) * 15 * relMult;
    penalty += dimPenalty;
  });
  return { penalty, evidenceCount: matchedCount, detail: { dimensions: dims.length } };
}

// ۷. استعداد حادثه‌پذیری — از dbee_source_barrier_map نوع accident_proneness_job؛
// شغل بحرانیِ مپ‌شده، فقط اگر ارزیابی واقعی با سطح «بالا»/«بسیار بالا» ثبت شده باشد
async function loadAccidentPronenessEvidence(barrierId, companyId) {
  const maps = await loadMappingsForBarrier(barrierId);
  const jobMaps = maps.filter((m) => m.sourceType === "accident_proneness_job");
  if (jobMaps.length === 0) return { penalty: 0, evidenceCount: 0, detail: null };
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const RELEVANCE_MULT = { low: 0.5, medium: 1, high: 1.6 };
  let penalty = 0;
  let matchedCount = 0;
  const perJob = await Promise.all(jobMaps.map((m) => {
    const jobTitle = m.sourceId.replace(/^job:/, "");
    return sb(`proactive_indicator_assessments?indicator_key=eq.accident_proneness&job_title_snapshot=eq.${encodeURIComponent(jobTitle)}${filter}&select=final_score,assessment_date&order=assessment_date.desc&limit=20`);
  }));
  jobMaps.forEach((m, i) => {
    const assessments = sbOk(perJob[i]) ? perJob[i] : [];
    const relMult = RELEVANCE_MULT[m.relevance || "medium"];
    assessments.forEach((a) => {
      const score = Number(a.final_score) || 0;
      if (score < 118) return; // فقط سطح «بالا» (۱۱۸+) و «بسیار بالا» شاهد محسوب می‌شود
      const base = score >= 157 ? 12 : 7;
      penalty += base * relMult * recencyMultiplier(a.assessment_date);
      matchedCount++;
    });
  });
  return { penalty, evidenceCount: matchedCount, detail: { jobCount: jobMaps.length } };
}

// ۸. خودِ BowTie — بحرانی‌بودن Barrier و شکست‌های ثبت‌شده‌ی دستی (status='red')
function bowtieOwnEvidence(barrier) {
  const isRedNow = barrier.status === "red";
  const penalty = isRedNow ? 20 : 0;
  return { penalty, evidenceCount: isRedNow ? 1 : 0, detail: { statusRed: isRedNow } };
}

const SOURCE_LOADERS = {
  source_anomaly: (b) => loadAnomalyEvidence(b.id),
  source_capa: (b) => loadCapaEvidence(b.id),
  source_incident: (b) => loadIncidentEvidence(b.id),
  source_tripod: (b) => loadTripodEvidence(b.id),
  source_sbs: (b, companyId) => loadSbsEvidence(b.id, companyId),
  source_hse_climate: (b, companyId) => loadHseClimateEvidence(b.id, companyId),
  source_accident_proneness: (b, companyId) => loadAccidentPronenessEvidence(b.id, companyId),
};

// ---------- Threshold (همان bowtie_effectiveness_thresholds موجود — دست‌نخورده) ----------

const DEFAULT_THRESHOLDS = { effectiveMin: 85, reducingMin: 65, weakMin: 40 };

async function loadThresholds() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`bowtie_effectiveness_thresholds?select=*${filter}&limit=1`);
  if (!sbOk(rows) || rows.length === 0) return DEFAULT_THRESHOLDS;
  return { effectiveMin: rows[0].effective_min, reducingMin: rows[0].reducing_min, weakMin: rows[0].weak_min };
}
function statusFromScore(score, thresholds) {
  if (score >= thresholds.effectiveMin) return "effective";
  if (score >= thresholds.reducingMin) return "reducing";
  if (score >= thresholds.weakMin) return "weak";
  return "failed";
}

// ---------- هسته‌ی محاسبه ----------

export async function calculateBarrierScore(barrier, weights, thresholds) {
  const companyId = getCurrentCompanyId();
  // اگر weights/thresholds از بیرون پاس داده نشده باشند (فراخوانی مستقل
  // یک‌بریری)، همینجا بارگذاری می‌شوند — برای سازگاری کامل با فراخوانی‌های
  // قبلی. وقتی از recalculateAllBarriersDbee صدا زده می‌شود، این دو یک‌بار
  // برای کل BowTie بارگذاری و برای همه‌ی بریرها به اشتراک گذاشته می‌شوند
  // (نه یک‌بار به‌ازای هر بریر) — همینجا بخش مهمی از کندی رفع شده است.
  if (!weights) weights = await loadWeights();
  if (!thresholds) thresholds = await loadThresholds();
  const w = (key) => (weights[key] != null ? weights[key] : 1.0);

  // ۷ منبع شواهد کاملاً مستقل از هم هستند (هرکدام فقط بر اساس barrier.id
  // فیلتر می‌کنند) — قبلاً پی‌درپی (for...await) اجرا می‌شدند که یعنی
  // برای هر بریر ۷+ رفت‌وبرگشت شبکه‌ی متوالی؛ الان هم‌زمان اجرا می‌شوند.
  const entries = Object.entries(SOURCE_LOADERS);
  const loaderResults = await Promise.all(entries.map(([, loader]) => loader(barrier, companyId)));
  const results = {};
  let totalEvidenceCount = 0;
  entries.forEach(([key], i) => {
    const r = loaderResults[i];
    results[key] = { ...r, weightedPenalty: r.penalty * w(key) };
    totalEvidenceCount += r.evidenceCount;
  });
  const ownEvidence = bowtieOwnEvidence(barrier);
  results.bowtie_own = { ...ownEvidence, weightedPenalty: ownEvidence.penalty };
  totalEvidenceCount += ownEvidence.evidenceCount;

  // بدون هیچ شاهدی از هیچ منبعی — طبق الزام صریح «Insufficient Data»،
  // نه امتیاز ساختگی. عمداً همان رفتار effectivenessApi.js حفظ شده.
  if (totalEvidenceCount === 0) {
    return { score: null, status: "not_assessed", evidenceCount: 0, breakdown: results };
  }

  let totalPenalty = Object.values(results).reduce((sum, r) => sum + r.weightedPenalty, 0);

  // Criticality — ضریب سخت‌گیرانه روی کل جریمه (نه یک منبع خاص)، دقیقاً
  // مثل منطق isCriticalControl در effectivenessApi.js موجود، ولی حالا
  // از فیلد criticality (low/medium/high) که در خودِ BowTie از قبل هست استفاده می‌کند
  const criticalityMult = { high: 1.3, medium: 1.0, low: 0.85 };
  totalPenalty *= (criticalityMult[barrier.criticality] || 1.0) * w("criticality");

  const rawScore = Math.max(0, Math.min(100, 100 - totalPenalty));
  const score = Math.round(rawScore * 10) / 10;
  const status = statusFromScore(score, thresholds);

  return { score, status, evidenceCount: totalEvidenceCount, breakdown: results };
}

// ---------- محاسبه + ذخیره (تاریخچه + به‌روزرسانی bowtie_barriers) ----------

async function maybeCreateAutoCorrectiveAction({ barrierId, barrierLabel, bowtieId, score }) {
  const bowtieRows = await sb(`bowties?id=eq.${bowtieId}&select=title,company_id`);
  const bowtieRow = sbOk(bowtieRows) && bowtieRows.length > 0 ? bowtieRows[0] : null;
  return createAutoCorrectiveActionForBarrier({
    barrierId, barrierLabel, bowtieId, bowtieTitle: bowtieRow?.title || "", score, companyId: bowtieRow?.company_id || null,
  });
}

export async function recalculateBarrierDbee(barrier, sharedWeights, sharedThresholds) {
  const { id: barrierId, label: barrierLabel, bowtieId } = barrier;
  const companyId = getCurrentCompanyId();
  const result = await calculateBarrierScore(barrier, sharedWeights, sharedThresholds);

  await sb(`bowtie_barriers?id=eq.${barrierId}`, {
    method: "PATCH",
    body: JSON.stringify({
      effectiveness_score: result.score, effectiveness_status: result.status,
      effectiveness_calculated_at: new Date().toISOString(),
    }),
  });

  if (companyId && bowtieId) {
    await sb("dbee_score_history", {
      method: "POST",
      body: JSON.stringify([{
        id: uid("dbeehist"), company_id: companyId, barrier_id: barrierId, bowtie_id: bowtieId,
        score: result.score, status: result.status, evidence_count: result.evidenceCount,
        breakdown: result.breakdown,
      }]),
      prefer: "return=minimal",
    });
  }

  if (result.score != null && result.score < AUTO_CA_THRESHOLD && bowtieId) {
    await maybeCreateAutoCorrectiveAction({ barrierId, barrierLabel, bowtieId, score: result.score }).catch(() => {});
  }

  return result;
}

export async function recalculateAllBarriersDbee(bowtieId) {
  const rows = await sb(`bowtie_barriers?bowtie_id=eq.${bowtieId}&select=id,label,bowtie_id,criticality,status`);
  if (!sbOk(rows)) return { __error: true, message: "خطا در بارگذاری بریرها" };
  // weights و thresholds برای کل شرکت یکسان‌اند — قبلاً به‌ازای هر بریر
  // جدا بارگذاری می‌شدند؛ الان فقط یک‌بار و بین همه‌ی بریرهای این BowTie
  // به اشتراک گذاشته می‌شوند.
  const [weights, thresholds] = await Promise.all([loadWeights(), loadThresholds()]);
  // بریرها کاملاً مستقل از هم محاسبه می‌شوند — قبلاً پی‌درپی (for...await)
  // بودند که برای یک BowTie با ۱۰ بریر یعنی ده‌ها رفت‌وبرگشت شبکه‌ی
  // متوالی؛ الان همه هم‌زمان اجرا می‌شوند.
  const results = await Promise.all(
    rows.map(async (r) => {
      const result = await recalculateBarrierDbee(
        { id: r.id, label: r.label, bowtieId: r.bowtie_id, criticality: r.criticality, status: r.status },
        weights, thresholds
      );
      return { barrierId: r.id, ...result };
    })
  );
  return { ok: true, count: results.length, results };
}

export { EFFECTIVENESS_STATUS };

// ---------- بارگذاری داده برای Barrier Effectiveness Dashboard ----------

// همه‌ی BowTie های شرکت + بریرهایشان، با آخرین امتیاز محاسبه‌شده (از
// همان دو ستون bowtie_barriers.effectiveness_score/status که این موتور
// به‌روزرسانی می‌کند) — برای فیلتر BowTie→Barrier و کارت‌های KPI.
export async function loadDashboardData() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const bowties = await sb(`bowties?select=id,title,site,department&order=title.asc${filter}`);
  if (!sbOk(bowties) || bowties.length === 0) return { bowties: [], barriers: [] };

  const bowtieIds = bowties.map((b) => b.id);
  const idList = bowtieIds.map((id) => `"${id}"`).join(",");
  const barrierRows = await sb(`bowtie_barriers?bowtie_id=in.(${idList})&select=id,bowtie_id,label,side,criticality,status,effectiveness_score,effectiveness_status,effectiveness_calculated_at&order=label.asc`);
  const barriers = sbOk(barrierRows) ? barrierRows.map((r) => ({
    id: r.id, bowtieId: r.bowtie_id, label: r.label, side: r.side, criticality: r.criticality,
    manualStatus: r.status, score: r.effectiveness_score != null ? Number(r.effectiveness_score) : null,
    status: r.effectiveness_status || "not_assessed", calculatedAt: r.effectiveness_calculated_at,
  })) : [];

  return {
    bowties: bowties.map((b) => ({ id: b.id, title: b.title, site: b.site || "", department: b.department || "" })),
    barriers,
  };
}

// تاریخچه‌ی کامل یک Barrier — برای Trend (Previous→Current) و «علت
// افزایش/کاهش» (از breakdown ذخیره‌شده در هر ردیف)
export async function loadBarrierHistory(barrierId) {
  const rows = await sb(`dbee_score_history?barrier_id=eq.${barrierId}&select=*&order=calculated_at.desc&limit=10`);
  return sbOk(rows) ? rows.map((r) => ({
    id: r.id, score: r.score != null ? Number(r.score) : null, status: r.status,
    evidenceCount: r.evidence_count, breakdown: r.breakdown, calculatedAt: r.calculated_at,
  })) : [];
}

// همه‌ی شواهد خام مرتبط با یک Barrier — برای صفحه‌ی جزئیات (بخش
// «اطلاعات هر Barrier» طرح اصلی: Related Anomalies/Incidents/Tripod/CAPA)
export async function loadBarrierEvidence(barrierId) {
  const companyId = getCurrentCompanyId();
  const [anomalyLinks, capaRows, maps] = await Promise.all([
    loadAnomalyLinksForBarrier(barrierId),
    sb(`corrective_actions?linked_barrier_id=eq.${barrierId}&select=*&order=created_at.desc`),
    loadMappingsForBarrier(barrierId),
  ]);

  const incidentMaps = maps.filter((m) => m.sourceType === "incident");
  const tripodMaps = maps.filter((m) => m.sourceType === "tripod_rca");
  const incidentIds = incidentMaps.map((m) => `"${m.sourceId}"`).join(",");
  const tripodIds = tripodMaps.map((m) => `"${m.sourceId}"`).join(",");

  const [incidentRows, tripodRows] = await Promise.all([
    incidentMaps.length > 0 ? sb(`incidents?id=in.(${incidentIds})&select=id,incident_no,occurred_at,is_disabling`) : Promise.resolve([]),
    tripodMaps.length > 0 ? sb(`tripod_analyses?id=in.(${tripodIds})&select=id,status,created_at`) : Promise.resolve([]),
  ]);

  return {
    anomalies: anomalyLinks.map((l) => ({ id: l.anomalyId, createdAt: l.createdAt })),
    capa: sbOk(capaRows) ? capaRows.map((r) => ({ id: r.id, actionNumber: r.action_number, status: r.status, description: r.action_description })) : [],
    incidents: sbOk(incidentRows) ? incidentRows.map((r) => ({ id: r.id, incidentNo: r.incident_no, occurredAt: r.occurred_at, isDisabling: r.is_disabling })) : [],
    tripod: sbOk(tripodRows) ? tripodRows.map((r) => ({ id: r.id, status: r.status, createdAt: r.created_at })) : [],
  };
}
