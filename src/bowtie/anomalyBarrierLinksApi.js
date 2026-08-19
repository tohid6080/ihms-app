import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

/**
 * ارتباط Anomaly ↔ Barrier (فاز ۲ از نقشه‌ی «Living BowTie»).
 *
 * نکته‌ی طراحی مهم: این ماژول هرگز به bowtie_barriers.status یا
 * effectiveness_status چیزی نمی‌نویسد — طبق خواسته‌ی صریح «Anomaly نباید
 * مستقیماً وضعیت Barrier را تغییر دهد؛ بلکه به‌عنوان Evidence استفاده
 * شود». محاسبه‌ی واقعی اثربخشی (خواندن همین ارتباط‌ها + منطق امتیازدهی)
 * فاز ۳ است و جای دیگری پیاده می‌شود.
 */

// ---------- برای dropdown آبشاری در فرم ثبت آنومالی ----------

// فقط id/title — سبک، برای پرکردن اولین dropdown (انتخاب BowTie)
export async function loadBowtiesForLinking() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`bowties?select=id,title&order=title.asc${filter}`);
  return sbOk(rows) ? rows.map((r) => ({ id: r.id, title: r.title })) : [];
}

// بعد از انتخاب یک BowTie، بریرهای همان BowTie (هم Preventive هم Recovery)
// برای dropdown دوم بارگذاری می‌شود
export async function loadBarriersForBowtie(bowtieId) {
  const rows = await sb(`bowtie_barriers?bowtie_id=eq.${bowtieId}&select=id,label,side&order=order_index.asc`);
  return sbOk(rows) ? rows.map((r) => ({ id: r.id, label: r.label, side: r.side })) : [];
}

// ---------- ثبت ارتباط (هنگام ذخیره‌ی آنومالی) ----------

// selections: [{ bowtieId, bowtieTitle, barrierId, barrierLabel }, ...]
export async function linkAnomalyToBarriers(anomalyId, selections, createdBy) {
  if (!selections || selections.length === 0) return { ok: true, count: 0 };
  const companyId = getCurrentCompanyId();
  const payload = selections.map((s) => ({
    anomaly_id: anomalyId,
    barrier_id: s.barrierId,
    bowtie_id: s.bowtieId || null,
    barrier_label_snapshot: s.barrierLabel || "",
    bowtie_title_snapshot: s.bowtieTitle || "",
    company_id: companyId,
    created_by: createdBy || "",
  }));
  const rows = await sb("anomaly_barrier_links", { method: "POST", body: JSON.stringify(payload) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت ارتباط با Barrier: " + (rows?.message || "نامشخص") };
  return { ok: true, count: rows.length };
}

// ---------- Traceability — خواندن ارتباط‌ها از هر دو جهت ----------

function linkFromRow(r) {
  return {
    id: r.id,
    anomalyId: r.anomaly_id,
    barrierId: r.barrier_id,
    bowtieId: r.bowtie_id || "",
    barrierLabel: r.barrier_label_snapshot || "",
    bowtieTitle: r.bowtie_title_snapshot || "",
    createdAt: r.created_at,
    createdBy: r.created_by || "",
  };
}

// از یک Anomaly، همه‌ی Barrier هایی که تحت‌تأثیرش قرار گرفته‌اند
export async function loadBarrierLinksForAnomaly(anomalyId) {
  const rows = await sb(`anomaly_barrier_links?anomaly_id=eq.${anomalyId}&select=*&order=created_at.desc`);
  return (sbOk(rows) ? rows : []).map(linkFromRow);
}

// از یک Barrier، همه‌ی Anomaly هایی که به‌عنوان Evidence رویش ثبت شده‌اند
// (برای فاز ۳: ورودی اصلی موتور محاسبه‌ی اثربخشی)
export async function loadAnomalyLinksForBarrier(barrierId) {
  const rows = await sb(`anomaly_barrier_links?barrier_id=eq.${barrierId}&select=*&order=created_at.desc`);
  return (sbOk(rows) ? rows : []).map(linkFromRow);
}

// نسخه‌ی دسته‌ای: تعداد Anomaly مرتبط با هر Barrier یک BowTie، برای نمایش
// یک شمارنده‌ی کوچک روی کارت هر بریر در کانواس بدون N بار درخواست جدا
export async function loadAnomalyCountsForBowtie(bowtieId) {
  const barriers = await sb(`bowtie_barriers?bowtie_id=eq.${bowtieId}&select=id`);
  if (!sbOk(barriers) || barriers.length === 0) return {};
  const idList = barriers.map((b) => b.id).join(",");
  const links = await sb(`anomaly_barrier_links?barrier_id=in.(${idList})&select=barrier_id`);
  const counts = {};
  if (sbOk(links)) links.forEach((l) => { counts[l.barrier_id] = (counts[l.barrier_id] || 0) + 1; });
  return counts;
}
