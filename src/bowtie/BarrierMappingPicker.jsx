import React, { useState, useEffect } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadAllBowtiesWithBarriers, loadMappingsForSource, createMapping, deleteMapping, RELEVANCE_LEVELS } from "./dbeeMappingApi.js";

/**
 * انتخاب صریح Barrier(های) مرتبط با یک منبع مشخص (Incident یا Tripod RCA)
 * — بخش ۲ طرح تأییدشده‌ی DBEE. طبق الزام صریح «کاربر HSE بتواند
 * Barrierهای مرتبط را انتخاب کند» و «ارتباط‌ها نباید حدسی یا خودکار
 * ایجاد شوند»: این کامپوننت هرگز خودش تصمیم به مپ‌کردن نمی‌گیرد — فقط
 * پس از انتخاب صریح BowTie→Barrier→میزان ارتباط توسط کاربر و کلیک دکمه،
 * یک ردیف در dbee_source_barrier_map ثبت می‌شود.
 */
export default function BarrierMappingPicker({ sourceType, sourceId, currentUser, readOnly }) {
  const [bowties, setBowties] = useState([]);
  const [mappings, setMappings] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedBowtieId, setSelectedBowtieId] = useState("");
  const [selectedBarrierId, setSelectedBarrierId] = useState("");
  const [relevance, setRelevance] = useState("medium");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [bts, maps] = await Promise.all([loadAllBowtiesWithBarriers(), loadMappingsForSource(sourceType, sourceId)]);
    setBowties(bts);
    setMappings(maps);
  };
  useEffect(() => { load(); }, [sourceType, sourceId]);

  const selectedBowtie = bowties.find((b) => b.id === selectedBowtieId);

  const handleAdd = async () => {
    setError("");
    if (!selectedBowtieId || !selectedBarrierId) { setError("انتخاب BowTie و Barrier الزامی است"); return; }
    setSaving(true);
    const result = await createMapping({ sourceType, sourceId, bowtieId: selectedBowtieId, barrierId: selectedBarrierId, relevance, note }, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setSelectedBowtieId(""); setSelectedBarrierId(""); setRelevance("medium"); setNote(""); setShowForm(false);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("این ارتباط با Barrier حذف شود؟")) return;
    const result = await deleteMapping(id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  if (mappings === null) return null;

  return (
    <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginTop: 16 }}>
      <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <GitBranch size={15} /> Barrierهای مرتبط (برای موتور اثربخشی DBEE)
      </h3>
      <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 12, lineHeight: 1.8 }}>
        اگر این رویداد نشان‌دهنده‌ی ضعف یکی از Barrierهای BowTie است، آن را اینجا مشخص کنید — این ارتباط مستقیماً در محاسبه‌ی اثربخشی همان Barrier لحاظ می‌شود.
      </p>

      {mappings.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, marginBottom: 10 }}>هنوز هیچ Barrier ای به این رویداد مرتبط نشده است.</p>}
      {mappings.map((m) => (
        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${THEME.border}` }}>
          <div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.navy }}>{m.barrierLabel || m.barrierId}</span>
            <span style={{ fontSize: 11, color: THEME.text3, marginRight: 8 }}>({m.bowtieTitle || "BowTie"} — ارتباط: {RELEVANCE_LEVELS.find((r) => r.value === m.relevance)?.label})</span>
          </div>
          {!readOnly && (
            <button type="button" onClick={() => handleDelete(m.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <Trash2 size={13} color={THEME.danger} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && !showForm && (
        <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6, marginTop: 12 }} onClick={() => setShowForm(true)}>
          <Plus size={13} /> افزودن Barrier مرتبط
        </button>
      )}

      {showForm && (
        <div style={{ background: THEME.bg, borderRadius: 9, padding: 12, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
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
                {(selectedBowtie?.barriers || []).map((b) => <option key={b.id} value={b.id}>{b.label} ({b.side === "preventive" ? "پیشگیرانه" : "بازیابی"})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>میزان ارتباط</label>
              <select style={styles.input} value={relevance} onChange={(e) => setRelevance(e.target.value)} dir="rtl">
                {RELEVANCE_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>یادداشت (اختیاری)</label>
              <input style={styles.input} value={note} onChange={(e) => setNote(e.target.value)} dir="rtl" placeholder="مثلاً: این Barrier در لحظه‌ی وقوع فعال نبود" />
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
  );
}
