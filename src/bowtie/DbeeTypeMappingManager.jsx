import React, { useState, useEffect } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadAllBowtiesWithBarriers, loadTypeMappings, createMapping, deleteMapping, RELEVANCE_LEVELS } from "./dbeeMappingApi.js";
import { loadSbsCategories } from "../proactiveIndicators/sbsApi.js";
import { HSE_CLIMATE_DIMENSIONS } from "../proactiveIndicators/hseClimateData.js";
import { ACCIDENT_PRONENESS_CRITICAL_JOBS } from "../proactiveIndicators/proactiveIndicatorsApi.js";

/**
 * بخش ۳ طرح تأییدشده‌ی DBEE — Mapping نوع‌به‌نوع (نه رکورد‌به‌رکورد):
 * «دسته‌ی SBS → Barrier»، «بُعد HSE Climate → Barrier»،
 * «شغل بحرانی → Barrier». طبق الزام صریح، سیستم هرگز خودش این ارتباط
 * را حدس نمی‌زند — همیشه محصول انتخاب صریح یک کاربر مجاز است.
 */
const SOURCE_TABS = [
  { key: "sbs_category", label: "دسته‌های SBS" },
  { key: "hse_climate_dimension", label: "ابعاد HSE Climate" },
  { key: "accident_proneness_job", label: "مشاغل بحرانی (استعداد حادثه‌پذیری)" },
];

export default function DbeeTypeMappingManager({ currentUser, onBack }) {
  const [sourceType, setSourceType] = useState("sbs_category");
  const [bowties, setBowties] = useState([]);
  const [mappings, setMappings] = useState(null);
  const [options, setOptions] = useState([]); // گزینه‌های خودِ منبع (کد دسته/بعد/شغل)
  const [showForm, setShowForm] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [selectedBowtieId, setSelectedBowtieId] = useState("");
  const [selectedBarrierId, setSelectedBarrierId] = useState("");
  const [relevance, setRelevance] = useState("medium");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSourceOptions = async () => {
    if (sourceType === "sbs_category") {
      const cats = await loadSbsCategories();
      setOptions(cats.map((c) => ({ id: c.code, label: c.titleFa })));
    } else if (sourceType === "hse_climate_dimension") {
      setOptions(HSE_CLIMATE_DIMENSIONS.map((d) => ({ id: d.id, label: d.title })));
    } else if (sourceType === "accident_proneness_job") {
      setOptions(ACCIDENT_PRONENESS_CRITICAL_JOBS.map((j) => ({ id: `job:${j}`, label: j })));
    }
  };

  const load = async () => {
    const [bts, maps] = await Promise.all([loadAllBowtiesWithBarriers(), loadTypeMappings(sourceType)]);
    setBowties(bts);
    setMappings(maps);
    await loadSourceOptions();
  };
  useEffect(() => { setMappings(null); load(); setShowForm(false); }, [sourceType]);

  const selectedBowtie = bowties.find((b) => b.id === selectedBowtieId);
  const optionLabel = (id) => options.find((o) => o.id === id)?.label || id;

  const handleAdd = async () => {
    setError("");
    if (!selectedOptionId || !selectedBowtieId || !selectedBarrierId) {
      setError("انتخاب هر سه‌ی منبع، BowTie و Barrier الزامی است");
      return;
    }
    setSaving(true);
    const result = await createMapping({ sourceType, sourceId: selectedOptionId, bowtieId: selectedBowtieId, barrierId: selectedBarrierId, relevance, note }, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setSelectedOptionId(""); setSelectedBowtieId(""); setSelectedBarrierId(""); setRelevance("medium"); setNote(""); setShowForm(false);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("این ارتباط حذف شود؟")) return;
    const result = await deleteMapping(id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>بازگشت</div>}
      <h2 style={{ fontSize: 18, color: THEME.navy, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <Link2 size={20} color={THEME.teal} /> Mapping منابع غیرمستقیم به Barrier
      </h2>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18, lineHeight: 1.9 }}>
        برای منابعی که رابطه‌ی مستقیمی به Barrier ندارند (SBS، HSE Climate، استعداد حادثه‌پذیری)، اینجا مشخص می‌کنید کدام دسته/بُعد/شغل به کدام Barrier مرتبط است. این ارتباط هیچ‌وقت خودکار ایجاد نمی‌شود.
      </p>

      <div style={{ display: "flex", gap: 4, borderBottom: `1.5px solid ${THEME.border}`, marginBottom: 16, flexWrap: "wrap" }}>
        {SOURCE_TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => setSourceType(t.key)}
            style={{
              padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: THEME.font, fontSize: 12.5,
              color: sourceType === t.key ? THEME.teal : THEME.text3, fontWeight: sourceType === t.key ? 700 : 500,
              borderBottom: sourceType === t.key ? `2.5px solid ${THEME.teal}` : "2.5px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mappings === null && <p style={{ color: THEME.text3, textAlign: "center", padding: 20 }}>در حال بارگذاری...</p>}

      {mappings !== null && (
        <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18 }}>
          {mappings.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, marginBottom: 10 }}>هنوز هیچ ارتباطی ثبت نشده است.</p>}
          {mappings.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${THEME.border}` }}>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.navy }}>{optionLabel(m.sourceId)}</span>
                <span style={{ fontSize: 11, color: THEME.text3 }}> ← </span>
                <span style={{ fontSize: 12.5, color: THEME.text }}>{m.barrierLabel || m.barrierId}</span>
                <span style={{ fontSize: 11, color: THEME.text3, marginRight: 8 }}>({m.bowtieTitle || "BowTie"} — ارتباط: {RELEVANCE_LEVELS.find((r) => r.value === m.relevance)?.label})</span>
              </div>
              <button type="button" onClick={() => handleDelete(m.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <Trash2 size={13} color={THEME.danger} />
              </button>
            </div>
          ))}

          {!showForm && (
            <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6, marginTop: 14 }} onClick={() => setShowForm(true)}>
              <Plus size={13} /> افزودن ارتباط جدید
            </button>
          )}

          {showForm && (
            <div style={{ background: THEME.bg, borderRadius: 9, padding: 12, marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>{SOURCE_TABS.find((t) => t.key === sourceType)?.label}</label>
                  <select style={styles.input} value={selectedOptionId} onChange={(e) => setSelectedOptionId(e.target.value)} dir="rtl">
                    <option value="">انتخاب کنید</option>
                    {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>BowTie</label>
                  <select style={styles.input} value={selectedBowtieId} onChange={(e) => { setSelectedBowtieId(e.target.value); setSelectedBarrierId(""); }} dir="rtl">
                    <option value="">انتخاب کنید</option>
                    {bowties.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>Barrier</label>
                  <select style={styles.input} value={selectedBarrierId} onChange={(e) => setSelectedBarrierId(e.target.value)} dir="rtl" disabled={!selectedBowtie}>
                    <option value="">{selectedBowtie ? "انتخاب کنید" : "ابتدا BowTie را انتخاب کنید"}</option>
                    {(selectedBowtie?.barriers || []).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>میزان ارتباط</label>
                  <select style={styles.input} value={relevance} onChange={(e) => setRelevance(e.target.value)} dir="rtl">
                    {RELEVANCE_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>یادداشت / شواهد (اختیاری)</label>
                  <input style={styles.input} value={note} onChange={(e) => setNote(e.target.value)} dir="rtl" placeholder="مثلاً: بر اساس بررسی کارشناس HSE" />
                </div>
              </div>
              {error && <p style={styles.error}>{error}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" style={styles.smallButton} onClick={handleAdd} disabled={saving}>{saving ? "در حال ثبت..." : "ثبت ارتباط"}</button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => { setShowForm(false); setError(""); }}>انصراف</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
