import { sb, sbOk, uid, getCurrentCompanyId } from "../shared.js";
import { loadBowties } from "./bowtieApi.js";

/**
 * DBEE — لایه‌ی Mapping (بخش ۱ طرح تأییدشده).
 *
 * برای منابعی که رابطه‌ی مستقیم داده‌ای به Barrier ندارند (Incident،
 * Tripod RCA، SBS، HSE Climate، استعداد حادثه‌پذیری)، این تنها راه واقعی
 * اتصال است. هر ردیف همیشه محصول یک تصمیم انسانی صریح است —
 * createdBy همیشه الزامی است و هیچ تابعی در این فایل خودش تصمیم به
 * ساخت Mapping نمی‌گیرد.
 *
 * دو دسته‌ی متفاوت Mapping:
 *   ۱. «رکورد‌به‌رکورد» (incident, tripod_rca): sourceId شناسه‌ی یک
 *      رکورد واقعی و مشخص است (مثلاً همان incidentId).
 *   ۲. «نوع‌به‌نوع» (sbs_category, hse_climate_dimension,
 *      accident_proneness_job): sourceId خودش کد دسته/بعد/شغل است —
 *      یعنی یک قاعده‌ی کلی («هر SBS دسته‌ی ۳ به این بریر مرتبط است»)،
 *      نه یک رخداد خاص.
 */

export const SOURCE_TYPES = [
  { value: "incident", label: "حادثه (Incident)" },
  { value: "tripod_rca", label: "تحلیل Tripod Beta (RCA)" },
  { value: "sbs_category", label: "دسته‌ی SBS" },
  { value: "hse_climate_dimension", label: "بُعد HSE Climate" },
  { value: "accident_proneness_job", label: "شغل بحرانی (استعداد حادثه‌پذیری)" },
];

export const RELEVANCE_LEVELS = [
  { value: "low", label: "کم" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "زیاد" },
];

function mapFromRow(r) {
  return {
    id: r.id, sourceType: r.source_type, sourceId: r.source_id,
    bowtieId: r.bowtie_id, barrierId: r.barrier_id, relevance: r.relevance || "medium",
    note: r.note || "", createdBy: r.created_by || "", createdAt: r.created_at,
  };
}

// ---------- خواندن — طرف موتور محاسبه (بخش‌های بعدی) ----------

// همه‌ی Mapping های یک source_id مشخص (رکورد‌به‌رکورد: incident/tripod_rca)
export async function loadMappingsForSource(sourceType, sourceId) {
  const rows = await sb(`dbee_source_barrier_map?source_type=eq.${sourceType}&source_id=eq.${encodeURIComponent(sourceId)}&select=*`);
  return sbOk(rows) ? rows.map(mapFromRow) : [];
}

// همه‌ی Mapping های نوع‌به‌نوع یک source_type (sbs_category/hse_climate_dimension/accident_proneness_job)
export async function loadTypeMappings(sourceType) {
  const rows = await sb(`dbee_source_barrier_map?source_type=eq.${sourceType}&select=*&order=created_at.desc`);
  return sbOk(rows) ? rows.map(mapFromRow) : [];
}

// همه‌ی Mapping های مرتبط با یک Barrier خاص — ورودی اصلی موتور محاسبه
export async function loadMappingsForBarrier(barrierId) {
  const rows = await sb(`dbee_source_barrier_map?barrier_id=eq.${barrierId}&select=*`);
  return sbOk(rows) ? rows.map(mapFromRow) : [];
}

// ---------- نوشتن — همیشه با تأیید صریح کاربر HSE ----------

export async function createMapping(rec, createdBy) {
  if (!createdBy) return { __error: true, message: "ثبت‌کننده الزامی است" };
  if (!rec.sourceType || !rec.sourceId || !rec.barrierId || !rec.bowtieId) {
    return { __error: true, message: "نوع منبع، شناسه‌ی منبع، BowTie و Barrier همگی الزامی‌اند" };
  }
  const payload = {
    id: uid("dbeemap"), company_id: getCurrentCompanyId(),
    source_type: rec.sourceType, source_id: rec.sourceId,
    bowtie_id: rec.bowtieId, barrier_id: rec.barrierId,
    relevance: rec.relevance || "medium", note: rec.note || null, created_by: createdBy,
  };
  const rows = await sb("dbee_source_barrier_map", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت ارتباط" };
  return mapFromRow(rows[0]);
}

export async function deleteMapping(id) {
  const rows = await sb(`dbee_source_barrier_map?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  if (!sbOk(rows)) return { __error: true, message: "خطا در حذف ارتباط" };
  return { ok: true };
}

// ---------- کمکی برای UIهای انتخاب Barrier (فرم حادثه، فرم Tripod، مدیریت Mapping نوع‌به‌نوع) ----------

export async function loadAllBowtiesWithBarriers() {
  const bowties = await loadBowties();
  const result = [];
  for (const bt of bowties) {
    const barriers = await sb(`bowtie_barriers?bowtie_id=eq.${bt.id}&select=id,label,side&order=order_index.asc`);
    result.push({ id: bt.id, title: bt.title, barriers: sbOk(barriers) ? barriers.map((b) => ({ id: b.id, label: b.label, side: b.side })) : [] });
  }
  return result;
}
