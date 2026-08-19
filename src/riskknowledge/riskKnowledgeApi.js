import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

/**
 * موتور دانش ارزیابی ریسک — قانون‌محور (Rule-Based)، بدون هیچ سرویس هوش
 * مصنوعی. منبع اصلی، بانک اطلاعاتی داخل دیتابیس است که با هر ارزیابیِ
 * تأییدشده‌ی جدید، خودش را کامل‌تر می‌کند (append-only — اطلاعات قبلی
 * هرگز حذف یا جایگزین نمی‌شود).
 *
 * معماری عمداً به‌گونه‌ای است که افزودن یک منبع پیشنهاد دیگر (مثلاً یک
 * سرویس هوش مصنوعی) در آینده، فقط به‌معنای افزودن یک تابع «پیشنهاددهنده»
 * جدید در کنار searchKnowledgeBase است — نه جایگزینی آن.
 */

// ---------- نگاشت رکورد ----------

function kbFromRow(r) {
  return {
    id: r.id,
    activity: r.activity || "",
    hazard: r.hazard || "",
    environmentalAspect: r.environmental_aspect || "",
    cause: r.cause || "",
    consequence: r.consequence || "",
    existingControls: r.existing_controls || "",
    recommendedControls: r.recommended_controls || "",
    severityDefault: r.severity_default,
    probabilityDefault: r.probability_default || "",
    detectionDefault: r.detection_default || "",
    initialRpn: r.initial_rpn || "",
    residualRpn: r.residual_rpn || "",
    approved: r.approved !== false,
    source: r.source || "manual",
    createdBy: r.created_by || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function kbToDb(rec) {
  return {
    activity: rec.activity || null,
    hazard: rec.hazard || "",
    environmental_aspect: rec.environmentalAspect || null,
    cause: rec.cause || null,
    consequence: rec.consequence || null,
    existing_controls: rec.existingControls || null,
    recommended_controls: rec.recommendedControls || null,
    severity_default: rec.severityDefault ?? null,
    probability_default: rec.probabilityDefault || null,
    detection_default: rec.detectionDefault || null,
    initial_rpn: rec.initialRpn || null,
    residual_rpn: rec.residualRpn || null,
    approved: rec.approved !== false,
    source: rec.source || "manual",
  };
}

// ---------- متن‌های چندگزینه‌ای («1-الف\n2-ب» یا «الف | ب») ----------

// یک فیلد متنی که چند مورد را با شماره یا خط جدید/| از هم جدا کرده به یک
// آرایه از گزینه‌های تمیز تبدیل می‌کند — برای نمایش هرکدام به‌عنوان یک
// گزینه‌ی مستقل در منوی پیشنهادها
export function splitSuggestionItems(text) {
  if (!text) return [];
  return text
    .split(/\n|\|/)
    .map((s) => s.replace(/^\s*\d+[-_.)]\s*/, "").trim())
    .filter(Boolean);
}

// ---------- امتیاز شباهت ----------

function normalizeText(s) {
  return (s || "")
    .trim()
    .replace(/[\u200c]/g, " ")
    .replace(/[.,;:!؟?«»"'()\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function tokenSimilarity(a, b) {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  const tokensA = new Set(normA.split(" ").filter(Boolean));
  const tokensB = new Set(normB.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  tokensA.forEach((t) => { if (tokensB.has(t)) overlap++; });
  const jaccard = overlap / (tokensA.size + tokensB.size - overlap);
  const substrBonus = normA.includes(normB) || normB.includes(normA) ? 0.15 : 0;
  return Math.min(1, jaccard + substrBonus);
}

// وزن‌دهی طبق مشخصات: فعالیت ۴۰٪، خطر ۴۰٪، جنبه‌ی زیست‌محیطی ۲۰٪
export function computeMatchScore(query, record) {
  const activityScore = tokenSimilarity(query.activity, record.activity) * 0.4;
  const hazardScore = tokenSimilarity(query.hazard, record.hazard) * 0.4;
  const envScore = tokenSimilarity(query.environmentalAspect, record.environmentalAspect) * 0.2;
  return activityScore + hazardScore + envScore;
}

// ---------- جستجو ----------

let _kbCache = null;
async function loadAllActive() {
  if (_kbCache) return _kbCache;
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`risk_knowledge_base?approved=eq.true&select=*${filter}`);
  _kbCache = (sbOk(rows) ? rows : []).map(kbFromRow);
  return _kbCache;
}
export function invalidateKnowledgeCache() { _kbCache = null; }

// چند رکورد مرتبط را برمی‌گرداند (به‌ترتیب امتیاز)، برای نمایش «سناریوهای
// مشابه» وقتی تطابق کامل وجود ندارد
export async function searchKnowledgeBase(query, limit = 5) {
  if (!query.hazard?.trim() && !query.activity?.trim() && !query.environmentalAspect?.trim()) return [];
  const all = await loadAllActive();
  const scored = all
    .map((rec) => ({ record: rec, score: computeMatchScore(query, rec) }))
    .filter((s) => s.score > 0.05)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// همه‌ی گزینه‌های ممکن برای یک فیلد خاص (علت/پیامد/کنترل موجود/کنترل
// پیشنهادی)، جمع‌شده از تمام رکوردهای مرتبط با جستجوی فعلی — تکراری‌ها حذف می‌شوند
export async function loadFieldSuggestions(query, fieldKey, limit = 8) {
  const matches = await searchKnowledgeBase(query, 10);
  const seen = new Set();
  const options = [];
  matches.forEach(({ record }) => {
    splitSuggestionItems(record[fieldKey]).forEach((item) => {
      const key = item.toLowerCase();
      if (!seen.has(key)) { seen.add(key); options.push(item); }
    });
  });
  return options.slice(0, limit);
}

// ---------- CRUD (برای صفحه‌ی مدیریت بانک اطلاعاتی) ----------

export async function loadAllKnowledgeRecords(includeInactive = true) {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const activeFilter = includeInactive ? "" : "&approved=eq.true";
  const rows = await sb(`risk_knowledge_base?select=*&order=created_at.desc${filter}${activeFilter}`);
  return (sbOk(rows) ? rows : []).map(kbFromRow);
}

export async function createKnowledgeRecord(rec, createdBy) {
  const payload = { ...kbToDb(rec), created_by: createdBy || "", company_id: getCurrentCompanyId() };
  const rows = await sb("risk_knowledge_base", { method: "POST", body: JSON.stringify([payload]) });
  invalidateKnowledgeCache();
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت: " + (rows?.message || "نامشخص") };
  return kbFromRow(rows[0]);
}

export async function updateKnowledgeRecord(id, rec) {
  const payload = kbToDb(rec);
  payload.updated_at = new Date().toISOString();
  const rows = await sb(`risk_knowledge_base?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  invalidateKnowledgeCache();
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی: " + (rows?.message || "نامشخص") };
  return kbFromRow(rows[0]);
}

export async function setKnowledgeRecordActive(id, approved) {
  const rows = await sb(`risk_knowledge_base?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ approved }) });
  invalidateKnowledgeCache();
  if (!sbOk(rows)) return { __error: true, message: "خطا در تغییر وضعیت" };
  return kbFromRow(rows[0]);
}

// حذف واقعی و کامل (برخلاف «غیرفعال کردن» که فقط approved را false می‌کند)
export async function deleteKnowledgeRecord(id) {
  const result = await sb(`risk_knowledge_base?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  invalidateKnowledgeCache();
  if (!sbOk(result)) return { __error: true, message: "خطا در حذف رکورد" };
  return { ok: true };
}

// حذف گروهی — برای وقتی چند رکورد هم‌زمان انتخاب و حذف می‌شوند
export async function bulkDeleteKnowledgeRecords(ids) {
  if (!ids || ids.length === 0) return { ok: true, count: 0 };
  const idList = ids.map((id) => `"${id}"`).join(",");
  const result = await sb(`risk_knowledge_base?id=in.(${idList})`, { method: "DELETE", prefer: "return=minimal" });
  invalidateKnowledgeCache();
  if (!sbOk(result)) return { __error: true, message: "خطا در حذف گروهی" };
  return { ok: true, count: ids.length };
}

// دو رکورد را ادغام می‌کند: متن فیلدهای رکورد دوم که در رکورد اول خالی‌اند
// یا با آن یکی نیستند، به رکورد اول اضافه می‌شوند (با خط جدید)، بعد رکورد
// دوم غیرفعال می‌شود — چیزی واقعاً حذف نمی‌شود
export async function mergeKnowledgeRecords(keepId, mergeId) {
  const [keepRows, mergeRows] = await Promise.all([
    sb(`risk_knowledge_base?id=eq.${keepId}&select=*`),
    sb(`risk_knowledge_base?id=eq.${mergeId}&select=*`),
  ]);
  if (!sbOk(keepRows) || !sbOk(mergeRows) || keepRows.length === 0 || mergeRows.length === 0) {
    return { __error: true, message: "رکورد یافت نشد" };
  }
  const keep = kbFromRow(keepRows[0]);
  const merge = kbFromRow(mergeRows[0]);
  const mergeField = (a, b) => {
    if (!b) return a;
    if (!a) return b;
    if (a.includes(b)) return a;
    return `${a}\n${b}`;
  };
  const merged = {
    ...keep,
    cause: mergeField(keep.cause, merge.cause),
    consequence: mergeField(keep.consequence, merge.consequence),
    existingControls: mergeField(keep.existingControls, merge.existingControls),
    recommendedControls: mergeField(keep.recommendedControls, merge.recommendedControls),
  };
  const updateResult = await updateKnowledgeRecord(keepId, merged);
  if (updateResult?.__error) return updateResult;
  await setKnowledgeRecordActive(mergeId, false);
  return { ok: true };
}

// ---------- یادگیری خودکار ----------

// بعد از تأیید نهایی یک ارزیابی HCMS فراخوانی می‌شود. یک رکورد در تاریخچه
// ثبت می‌کند، و اگر محتوای علت/پیامد/کنترل موجود/کنترل پیشنهادی واقعاً با
// نزدیک‌ترین رکورد موجود بانک اطلاعاتی «به‌طور قابل‌توجهی» متفاوت باشد، آن
// را به‌عنوان یک رکورد کاملاً جدید اضافه می‌کند — رکوردهای قبلی هرگز
// دستکاری یا جایگزین نمی‌شوند.
export async function learnFromApprovedAssessment(assessment, createdBy) {
  const query = { activity: assessment.activity, hazard: assessment.hazard || assessment.environmentalAspect, environmentalAspect: assessment.environmentalAspect };
  const matches = await searchKnowledgeBase(query, 1);
  const best = matches[0];

  await sb("risk_assessment_history", {
    method: "POST",
    body: JSON.stringify([{
      hcms_assessment_id: assessment.id || null,
      activity: assessment.activity || null,
      hazard: assessment.hazard || null,
      environmental_aspect: assessment.environmentalAspect || null,
      cause: assessment.cause || null,
      consequence: assessment.consequence || null,
      existing_controls: assessment.existingControls || null,
      recommended_controls: assessment.proposedControls || null,
      initial_rpn: assessment.initialRpn || null,
      residual_rpn: assessment.residualRpn || null,
      matched_kb_id: best?.record?.id || null,
      match_score: best?.score ?? null,
      company_id: getCurrentCompanyId(),
      created_by: createdBy || "",
    }]),
    prefer: "return=minimal",
  });

  // اگر تطابق نزدیک (حداقل ۷۰٪) پیدا نشد، یعنی این واقعاً یک سناریوی جدید
  // است — به بانک اطلاعاتی اضافه شود
  if (!best || best.score < 0.7) {
    await createKnowledgeRecord({
      activity: assessment.activity, hazard: assessment.hazard, environmentalAspect: assessment.environmentalAspect,
      cause: assessment.cause, consequence: assessment.consequence,
      existingControls: assessment.existingControls, recommendedControls: assessment.proposedControls,
      initialRpn: assessment.initialRpn, residualRpn: assessment.residualRpn,
      approved: true, source: "user_approved",
    }, createdBy);
    return { learned: true };
  }
  return { learned: false };
}

// ---------- ورود/خروج اکسل ----------

// ستون‌های مورد انتظار (نام‌های رایج فارسی/انگلیسی که پذیرفته می‌شوند)
const COLUMN_ALIASES = {
  activity: ["فعالیت", "activity"],
  hazard: ["خطر", "hazard"],
  environmentalAspect: ["جنبه زیست محیطی", "جنبه‌های زیست‌محیطی", "environmental_aspect", "environmental aspect"],
  cause: ["علت", "cause"],
  consequence: ["پیامد", "consequence"],
  existingControls: ["کنترلهای جاری", "کنترل‌های موجود", "existing_controls", "existing controls"],
  recommendedControls: ["اقدامات کنترلی", "اقدامات کنترلی پیشنهادی", "کنترل‌های پیشنهادی", "recommended_controls", "recommended controls"],
};

function findColumnKey(headerRow, aliases) {
  for (let i = 0; i < headerRow.length; i++) {
    const h = (headerRow[i] || "").toString().trim();
    if (aliases.some((a) => h === a || h.includes(a))) return i;
  }
  return -1;
}

function cleanCell(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// یک شیت پارس‌شده (آرایه‌ی آرایه، خروجی XLSX.utils.sheet_to_json با
// header:1) را می‌گیرد و رکوردهای بانک اطلاعاتی آماده برای درج برمی‌گرداند
export function parseKnowledgeBaseSheet(rows) {
  if (!rows || rows.length < 2) return { records: [], skippedDuplicates: 0 };
  const header = rows[0];
  const colIdx = {};
  Object.entries(COLUMN_ALIASES).forEach(([key, aliases]) => { colIdx[key] = findColumnKey(header, aliases); });
  if (colIdx.hazard === -1) return { records: [], error: "ستون «خطر» در فایل پیدا نشد" };

  const records = [];
  const seenHazards = new Set();
  let skippedDuplicates = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const hazard = cleanCell(colIdx.hazard >= 0 ? row[colIdx.hazard] : "");
    if (!hazard) continue;
    const dedupeKey = hazard.toLowerCase();
    if (seenHazards.has(dedupeKey)) { skippedDuplicates++; continue; }
    seenHazards.add(dedupeKey);

    records.push({
      activity: colIdx.activity >= 0 ? cleanCell(row[colIdx.activity]) : "",
      hazard,
      environmentalAspect: colIdx.environmentalAspect >= 0 ? cleanCell(row[colIdx.environmentalAspect]) : "",
      cause: colIdx.cause >= 0 ? cleanCell(row[colIdx.cause]) : "",
      consequence: colIdx.consequence >= 0 ? cleanCell(row[colIdx.consequence]) : "",
      existingControls: colIdx.existingControls >= 0 ? cleanCell(row[colIdx.existingControls]) : "",
      recommendedControls: colIdx.recommendedControls >= 0 ? cleanCell(row[colIdx.recommendedControls]) : "",
      approved: true,
      source: "excel_import",
    });
  }
  return { records, skippedDuplicates };
}

export async function bulkImportKnowledgeRecords(records, createdBy) {
  const companyId = getCurrentCompanyId();
  const payload = records.map((r) => ({ ...kbToDb(r), created_by: createdBy || "", company_id: companyId }));
  const rows = await sb("risk_knowledge_base", { method: "POST", body: JSON.stringify(payload) });
  invalidateKnowledgeCache();
  if (!sbOk(rows)) return { __error: true, message: "خطا در ورود گروهی: " + (rows?.message || "نامشخص") };
  return { ok: true, count: rows.length };
}

export function knowledgeRecordsToSheetRows(records) {
  const header = ["فعالیت", "خطر", "جنبه زیست محیطی", "علت", "پیامد", "کنترلهای جاری", "اقدامات کنترلی پیشنهادی", "فعال"];
  const rows = records.map((r) => [
    r.activity, r.hazard, r.environmentalAspect, r.cause, r.consequence, r.existingControls, r.recommendedControls, r.approved ? "بله" : "خیر",
  ]);
  return [header, ...rows];
}
