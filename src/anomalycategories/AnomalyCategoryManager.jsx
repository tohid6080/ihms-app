import React, { useState, useEffect } from "react";
import { Tag as TagIcon, Plus } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadAllAnomalyCategories, createAnomalyCategory, updateAnomalyCategory, setAnomalyCategoryActive } from "./anomalyCategoriesApi.js";

export default function AnomalyCategoryManager({ onBack }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setCategories(await loadAllAnomalyCategories());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    const result = await createAnomalyCategory(newName);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setNewName("");
    await load();
  };

  const startEdit = (c) => { setEditingId(c.id); setEditingName(c.name); };
  const saveEdit = async () => {
    if (!editingName.trim()) return;
    const result = await updateAnomalyCategory(editingId, editingName);
    if (result?.__error) { alert(result.message); return; }
    setEditingId(null);
    await load();
  };

  const handleToggleActive = async (c) => {
    await setAnomalyCategoryActive(c.id, !c.isActive);
    await load();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به مدیریت سیستم</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <TagIcon size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>دسته‌بندی‌های آنومالی</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 16 }}>این لیست همان دسته‌بندی‌هایی است که در فرم «ثبت آنومالی» نمایش داده می‌شود.</p>

      <div style={{ ...styles.card, width: "auto", marginBottom: 16, display: "flex", gap: 8 }}>
        <input style={{ ...styles.input, marginBottom: 0, flex: 1 }} placeholder="دسته‌بندی جدید" value={newName} onChange={(e) => setNewName(e.target.value)} dir="rtl" onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
        <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={handleAdd} disabled={saving || !newName.trim()}>
          <Plus size={14} /> افزودن
        </button>
      </div>
      {error && <p style={styles.error}>{error}</p>}

      {categories.map((c) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${THEME.border}` }}>
          {editingId === c.id ? (
            <input style={{ ...styles.input, marginBottom: 0, flex: 1 }} value={editingName} onChange={(e) => setEditingName(e.target.value)} dir="rtl" autoFocus onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
          ) : (
            <span style={{ flex: 1, fontSize: 13, color: c.isActive ? THEME.text : THEME.text3, textDecoration: c.isActive ? "none" : "line-through" }}>{c.name}</span>
          )}
          {editingId === c.id ? (
            <button type="button" style={styles.smallButton} onClick={saveEdit}>ذخیره</button>
          ) : (
            <button type="button" style={{ ...styles.smallButton, background: THEME.navyMid }} onClick={() => startEdit(c)}>ویرایش</button>
          )}
          <button type="button" style={{ ...styles.smallButton, background: c.isActive ? THEME.text3 : "#166534" }} onClick={() => handleToggleActive(c)}>
            {c.isActive ? "غیرفعال" : "فعال"}
          </button>
        </div>
      ))}
    </div>
  );
}
