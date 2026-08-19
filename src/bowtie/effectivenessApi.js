import { sb, sbOk, getCurrentCompanyId } from "../shared.js";
import { loadAnomalyLinksForBarrier } from "./anomalyBarrierLinksApi.js";
import { EFFECTIVENESS_STATUS } from "./bowtieApi.js";
import { createAutoCorrectiveActionForBarrier } from "../correctiveActions/correctiveActionsApi.js";

/**
 * موتور محاسبه‌ی اثربخشی Barrier (فاز ۳ از نقشه‌ی «Living BowTie»).
 *
 * ورودی‌ها دقیقاً همان‌هایی هستند که در طرح اصلی خواسته شده بود:
 *   - تعداد Anomalyهای مرتبط (از anomaly_barrier_links، فاز ۲)
 *   - شدت هر Anomaly (riskLevel: High/Med/Low)
 *   - تکرار/تازگی Anomaly (شواهد اخیر وزن بیشتری دارند)
 *   - وضعیت اقدامات اصلاحی مرتبط (اگر هنوز باز است، امتیاز بیشتر کم می‌شود)
 *   - بحرانی‌بودن خودِ Barrier (isCriticalControl → ضریب سخت‌گیرانه‌تر)
 *
 * خروجی یک عدد ۰ تا ۱۰۰ است که با Threshold های قابل‌تنظیم (از دیتابیس)
 * به یکی از ۵ وضعیت رنگی نگاشت می‌شود. اگر هیچ Anomaly ای مرتبط نباشد،
 * وضعیت «ارزیابی نشده» (⚪) می‌ماند — عمداً محاسبه نمی‌شود، چون نبودِ
 * شواهد به‌معنای «مؤثر» نیست، به‌معنای «هنوز چیزی برای قضاوت نداریم» است.
 *
 * فاز ۴ (این افزوده): بلافاصله بعد از هر محاسبه‌ی نهایی، اگر امتیاز از
 * AUTO_CA_THRESHOLD کمتر بیاید، یک اقدام اصلاحی خودکار برای همان Barrier
 * ساخته می‌شود — مگر اینکه از قبل یک اقدام «باز» برایش وجود داشته باشد
 * (بدون تکرار). وقتی امتیاز دوباره بالا برود، هیچ اقدامی حذف نمی‌شود —
 * تاریخچه دست‌نخورده می‌ماند.
 */

const DEFAULT_THRESHOLDS = { effectiveMin: 85, reducingMin: 65, weakMin: 40 };
const AUTO_CA_THRESHOLD = 60; // طبق بخش «منطق» درخواست: Score < 60 → اقدام خودکار

// ---------- Threshold های قابل‌تنظیم ----------

export async function loadThresholds() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`bowtie_effectiveness_thresholds?select=*${filter}&limit=1`);
  if (!sbOk(rows) || rows.length === 0) return { ...DEFAULT_THRESHOLDS, id: null };
  const r = rows[0];
  return {
    id: r.id,
    effectiveMin: r.effective_min,
    reducingMin: r.reducing_min,
    weakMin: r.weak_min,
  };
}

export async function saveThresholds(thresholds, updatedBy) {
  const companyId = getCurrentCompanyId();
  const payload = {
    effective_min: thresholds.effectiveMin,
    reducing_min: thresholds.reducingMin,
    weak_min: thresholds.weakMin,
    company_id: companyId,
    updated_by: updatedBy || "",
    updated_at: new Date().toISOString(),
  };
  if (thresholds.id) {
    const rows = await sb(`bowtie_effectiveness_thresholds?id=eq.${thresholds.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی تنظیمات" };
    return { ok: true };
  }
  const rows = await sb("bowtie_effectiveness_thresholds", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی تنظیمات" };
  return { ok: true };
}

function statusFromScore(score, thresholds) {
  if (score >= thresholds.effectiveMin) return "effective";
  if (score >= thresholds.reducingMin) return "reducing";
  if (score >= thresholds.weakMin) return "weak";
  return "failed";
}

// ---------- هسته‌ی محاسبه ----------

const SEVERITY_PENALTY = { High: 15, Med: 8, Low: 3 };
const RECENT_WINDOW_DAYS = 90;

function daysAgo(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

// امتیاز خام (بدون گرد‌کردن) را از روی لیست آنومالی‌های شاهد و بریر محاسبه می‌کند
function computeScore(anomalies, correctiveActionsOpenCount, isCriticalControl) {
  let score = 100;

  anomalies.forEach((a) => {
    const basePenalty = SEVERITY_PENALTY[a.riskLevel] ?? SEVERITY_PENALTY.Med;
    const recencyWeight = daysAgo(a.createdAt) <= RECENT_WINDOW_DAYS ? 1.4 : 0.6;
    score -= basePenalty * recencyWeight;
  });

  // تکرار: چند شاهد در بازه‌ی اخیر، خودش یک سیگنال جداست (نه فقط جمع تک‌تک جریمه‌ها)
  const recentCount = anomalies.filter((a) => daysAgo(a.createdAt) <= RECENT_WINDOW_DAYS).length;
  if (recentCount >= 5) score -= 20;
  else if (recentCount >= 3) score -= 10;

  // اقدامات اصلاحی هنوز باز روی همین شواهد — یعنی مشکل هنوز رفع نشده
  if (correctiveActionsOpenCount > 0) score -= 10 + Math.min(correctiveActionsOpenCount - 1, 3) * 5;

  // بریرهای بحرانی، برای همان شواهد باید سخت‌گیرانه‌تر ارزیابی شوند
  if (isCriticalControl) {
    const totalPenalty = 100 - score;
    score = 100 - totalPenalty * 1.3;
  }

  return Math.max(0, Math.min(100, score));
}

// آنومالی‌های شاهد یک بریر را با جزئیات لازم (شدت، تاریخ) بار می‌کند
async function loadEvidenceAnomalies(barrierId) {
  const links = await loadAnomalyLinksForBarrier(barrierId);
  if (links.length === 0) return [];
  const ids = links.map((l) => l.anomalyId);
  // چون شناسه‌ی آنومالی رشته‌ای (uid()) است، نه UUID، از in.() با لیست رشته‌ای استفاده می‌کنیم
  const idList = ids.map((id) => `"${id}"`).join(",");
  const rows = await sb(`anomalies?id=in.(${idList})&select=id,risk_level,status,created_at`);
  if (!sbOk(rows)) return [];
  return rows.map((r) => ({ id: r.id, riskLevel: r.risk_level || "Med", status: r.status, createdAt: r.created_at }));
}

// اقدامات اصلاحی «باز» (هر وضعیتی جز بسته‌شده) که به این Barrier مرتبط‌اند —
// از دو مسیر: (۱) مستقیماً به خودِ Barrier وصل شده‌اند (linked_barrier_id،
// دقیقاً همان چیزی که اقدام خودکار ست می‌کند) و (۲) به یکی از آنومالی‌های
// شاهدش وصل شده‌اند (linked_anomaly_id). قبلاً فقط مسیر دوم چک می‌شد، پس
// بسته‌شدن اقدام خودکار (که فقط از مسیر اول قابل‌مشاهده است) هیچ اثری روی
// امتیاز نداشت — این همان باگی بود که باعث می‌شد «بسته‌کردن اقدام، اثربخشی
// را تغییر ندهد».
async function countOpenCorrectiveActions(barrierId, anomalyIds) {
  const openIds = new Set();

  const byBarrier = await sb(`corrective_actions?linked_barrier_id=eq.${barrierId}&status=neq.closed&select=id`);
  if (sbOk(byBarrier)) byBarrier.forEach((r) => openIds.add(r.id));

  if (anomalyIds.length > 0) {
    const idList = anomalyIds.map((id) => `"${id}"`).join(",");
    const byAnomaly = await sb(`corrective_actions?linked_anomaly_id=in.(${idList})&status=neq.closed&select=id`);
    if (sbOk(byAnomaly)) byAnomaly.forEach((r) => openIds.add(r.id));
  }

  return openIds.size;
}

// اقدام اصلاحی خودکار را فقط وقتی می‌سازد که واقعاً لازم باشد — بررسی
// «آیا از قبل یک اقدام باز برای همین Barrier هست؟» داخل خودِ
// createAutoCorrectiveActionForBarrier انجام می‌شود (جلوگیری از تکرار).
// company_id را عمداً از خودِ ردیف BowTie می‌خوانیم، نه از session فعلی —
// چون طبق خواسته‌ی صریح «company_id حتماً رعایت شود»، اقدام باید همیشه به
// شرکتِ واقعیِ صاحبِ همان BowTie متصل شود، مستقل از اینکه این بازمحاسبه
// از کدام نشست/کاربر اجرا شده است.
async function maybeCreateAutoCorrectiveAction({ barrierId, barrierLabel, bowtieId, score }) {
  const bowtieRows = await sb(`bowties?id=eq.${bowtieId}&select=title,company_id`);
  const bowtieRow = sbOk(bowtieRows) && bowtieRows.length > 0 ? bowtieRows[0] : null;
  const bowtieTitle = bowtieRow?.title || "";
  const bowtieCompanyId = bowtieRow?.company_id || null;
  return createAutoCorrectiveActionForBarrier({ barrierId, barrierLabel, bowtieId, bowtieTitle, score, companyId: bowtieCompanyId });
}

// ---------- محاسبه + ذخیره برای یک بریر ----------
// ورودی حالا یک شیء کامل است (نه فقط id/isCriticalControl) چون برای
// ساخت اقدام اصلاحی خودکار، عنوان بریر و شناسه‌ی BowTie هم لازم است.
export async function recalculateBarrierEffectiveness(barrier) {
  const { id: barrierId, label: barrierLabel, bowtieId, isCriticalControl } = barrier;
  const anomalies = await loadEvidenceAnomalies(barrierId);
  if (anomalies.length === 0) {
    // بدون شاهد — عمداً «ارزیابی‌نشده» می‌ماند، نه خودکار «مؤثر»
    await sb(`bowtie_barriers?id=eq.${barrierId}`, {
      method: "PATCH",
      body: JSON.stringify({ effectiveness_score: null, effectiveness_status: "not_assessed", effectiveness_calculated_at: new Date().toISOString() }),
    });
    return { score: null, status: "not_assessed", evidenceCount: 0 };
  }

  const openCorrectiveCount = await countOpenCorrectiveActions(barrierId, anomalies.map((a) => a.id));
  const thresholds = await loadThresholds();
  const rawScore = computeScore(anomalies, openCorrectiveCount, !!isCriticalControl);
  const score = Math.round(rawScore * 10) / 10;
  const status = statusFromScore(score, thresholds);

  await sb(`bowtie_barriers?id=eq.${barrierId}`, {
    method: "PATCH",
    body: JSON.stringify({
      effectiveness_score: score,
      effectiveness_status: status,
      effectiveness_calculated_at: new Date().toISOString(),
    }),
  });

  // Trigger اقدام اصلاحی خودکار — دقیقاً همین‌جا، بعد از محاسبه‌ی نهایی و
  // ذخیره‌ی امتیاز، طبق خواسته‌ی صریح. اگر این مرحله با خطا مواجه شود،
  // نباید کل بازمحاسبه‌ی اثربخشی (که همین الان با موفقیت انجام شد) را
  // خراب کند — به همین دلیل خطای احتمالی‌اش بی‌سروصدا نادیده گرفته می‌شود.
  if (score < AUTO_CA_THRESHOLD && bowtieId) {
    await maybeCreateAutoCorrectiveAction({ barrierId, barrierLabel, bowtieId, score }).catch(() => {});
  }

  return { score, status, evidenceCount: anomalies.length };
}

// همه‌ی بریرهای یک BowTie را یکجا بازمحاسبه می‌کند — برای دکمه‌ی «بازمحاسبه‌ی همه» در کانواس
export async function recalculateAllBarriersForBowtie(bowtieId) {
  const rows = await sb(`bowtie_barriers?bowtie_id=eq.${bowtieId}&select=id,label,bowtie_id,is_critical_control`);
  if (!sbOk(rows)) return { __error: true, message: "خطا در بارگذاری بریرها" };
  const results = [];
  for (const r of rows) {
    const result = await recalculateBarrierEffectiveness({ id: r.id, label: r.label, bowtieId: r.bowtie_id, isCriticalControl: r.is_critical_control });
    results.push({ barrierId: r.id, ...result });
  }
  return { ok: true, count: results.length, results };
}

// هروقت یک آنومالی جدید به چند بریر وصل می‌شود (فاز ۲)، بلافاصله برای همان
// بریرهای مشخص بازمحاسبه انجام می‌شود — تا اثربخشی همیشه به‌روز بماند
export async function recalculateForLinkedBarriers(barrierIds) {
  if (!barrierIds || barrierIds.length === 0) return;
  const idList = barrierIds.map((id) => `"${id}"`).join(",");
  const rows = await sb(`bowtie_barriers?id=in.(${idList})&select=id,label,bowtie_id,is_critical_control`);
  if (!sbOk(rows)) return;
  for (const r of rows) {
    await recalculateBarrierEffectiveness({ id: r.id, label: r.label, bowtieId: r.bowtie_id, isCriticalControl: r.is_critical_control }).catch(() => {});
  }
}

export { EFFECTIVENESS_STATUS };

// ---------- فاز ۴: هشدار کاهش اثربخشی برای زنگوله‌ی اعلان ----------
// طبق طرح اصلی، سه سطح هشدار با همان متن‌های نمونه‌ی داده‌شده:
//   🟡 reducing → «اثربخشی Barrier در حال کاهش است.»
//   🟠 weak     → «Barrier نیازمند اقدام اصلاحی است.»
//   🔴 failed   → «Barrier حیاتی اثربخشی خود را از دست داده است.»
// چیزی جایی ذخیره نمی‌شود — دقیقاً مثل بقیه‌ی smartItems موجود در اپ، هر
// بار زنگوله باز می‌شود از روی effectiveness_status فعلی بریرها زنده
// محاسبه می‌شود؛ یعنی وقتی وضعیت درست شود، هشدار خودش ناپدید می‌شود.

const ALERT_TEMPLATES = {
  reducing: { emoji: "🟡", text: (label) => `اثربخشی Barrier «${label}» در حال کاهش است.` },
  weak: { emoji: "🟠", text: (label) => `Barrier «${label}» نیازمند اقدام اصلاحی است.` },
  failed: { emoji: "🔴", text: (label) => `Barrier «${label}» حیاتی اثربخشی خود را از دست داده است.` },
};

// scopeContractorName: اگر داده شود، فقط بریرهایی نمایش داده می‌شوند که
// حداقل یک Anomaly شاهدشان متعلق به همین پیمانکار باشد («پیمانکار مرتبط»)
export async function loadDegradedBarrierAlerts(scopeContractorName) {
  const companyId = getCurrentCompanyId();
  // نکته‌ی مهم: جدول bowtie_barriers خودش ستون company_id ندارد — فقط
  // bowties (والدش) این ستون را دارد. پس اول باید بوتای‌های همین شرکت را
  // پیدا کرد، بعد بریرها را بر اساس bowtie_id فیلتر کرد؛ فیلتر مستقیمِ
  // company_id روی bowtie_barriers از اول همیشه با خطا مواجه می‌شد و
  // بی‌سروصدا نتیجه‌ی خالی برمی‌گرداند.
  let bowtieScopeFilter = "";
  if (companyId) {
    const myBowties = await sb(`bowties?company_id=eq.${companyId}&select=id`);
    if (!sbOk(myBowties) || myBowties.length === 0) return [];
    bowtieScopeFilter = `&bowtie_id=in.(${myBowties.map((b) => b.id).join(",")})`;
  }

  const barriers = await sb(`bowtie_barriers?effectiveness_status=in.(reducing,weak,failed)&select=id,label,bowtie_id,effectiveness_status,effectiveness_score${bowtieScopeFilter}`);
  if (!sbOk(barriers) || barriers.length === 0) return [];

  const bowtieIds = [...new Set(barriers.map((b) => b.bowtie_id).filter(Boolean))];
  const bowtieRows = bowtieIds.length > 0 ? await sb(`bowties?id=in.(${bowtieIds.join(",")})&select=id,title`) : [];
  const titleMap = {};
  if (sbOk(bowtieRows)) bowtieRows.forEach((bt) => { titleMap[bt.id] = bt.title; });

  const items = [];
  for (const b of barriers) {
    if (scopeContractorName) {
      const links = await loadAnomalyLinksForBarrier(b.id);
      if (links.length === 0) continue;
      const idList = links.map((l) => `"${l.anomalyId}"`).join(",");
      const anomalyRows = await sb(`anomalies?id=in.(${idList})&select=contractor`);
      const belongsToContractor = sbOk(anomalyRows) && anomalyRows.some((a) => (a.contractor || "").trim() === scopeContractorName.trim());
      if (!belongsToContractor) continue;
    }
    const tmpl = ALERT_TEMPLATES[b.effectiveness_status];
    if (!tmpl) continue;
    items.push({
      key: `barrier-eff-${b.id}`,
      label: `${tmpl.emoji} ${tmpl.text(b.label)} (${titleMap[b.bowtie_id] || "BowTie"} — ${b.effectiveness_score}٪)`,
      target: { module: "bowtie", bowtieId: b.bowtie_id },
    });
  }
  return items;
}
