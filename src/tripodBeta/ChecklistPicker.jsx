import React, { useState, useMemo } from "react";
import { Plus, Search, X } from "lucide-react";
import { THEME } from "../shared.js";

/**
 * پورت React از checklist-picker.js اصلی — جعبه‌ی جست‌وجوپذیر با متن
 * کامل (نه select ساده)، گروه‌بندی‌شده بر اساس دسته‌ی چک‌لیست، پشت یک
 * دکمه‌ی toggle تا صفحه شلوغ نشود.
 */
export default function TogglePicker({ label, items, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const f = search.trim().toLowerCase();
    return f ? items.filter((it) => it.code.toLowerCase().includes(f) || it.textFa.toLowerCase().includes(f) || (it.brfCode || "").toLowerCase().includes(f)) : items;
  }, [items, search]);

  const byGroup = useMemo(() => {
    const map = {};
    filtered.forEach((it) => { (map[it.groupNo] = map[it.groupNo] || []).push(it); });
    return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [filtered]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1.5px dashed ${THEME.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, color: THEME.teal, cursor: "pointer", fontFamily: THEME.font }}>
        <Plus size={13} /> {label}
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${THEME.border}`, borderRadius: 10, marginTop: 6, background: THEME.surface, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: `1px solid ${THEME.border}`, background: THEME.bg }}>
        <Search size={13} color={THEME.text3} />
        <input
          autoFocus style={{ flex: 1, border: "none", background: "transparent", fontSize: 12.5, outline: "none", fontFamily: THEME.font }}
          placeholder={placeholder || "جستجو در کد یا شرح..."} value={search} onChange={(e) => setSearch(e.target.value)} dir="rtl"
        />
        <button type="button" onClick={() => { setOpen(false); setSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
          <X size={14} color={THEME.text3} />
        </button>
      </div>
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {filtered.length === 0 && <div style={{ padding: 14, fontSize: 12, color: THEME.text3, textAlign: "center" }}>موردی یافت نشد.</div>}
        {byGroup.map(([gno, groupItems]) => (
          <div key={gno}>
            <div style={{ padding: "5px 10px", background: THEME.bg, fontSize: 10.5, color: THEME.text3, fontWeight: 700 }}>
              {gno}. {groupItems[0].groupTitle || ""}
            </div>
            {groupItems.map((it) => (
              <div
                key={it.id}
                onClick={() => { onSelect(it); setOpen(false); setSearch(""); }}
                style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", cursor: "pointer", borderBottom: `1px solid ${THEME.border}`, fontSize: 12 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = THEME.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontWeight: 700, color: THEME.teal, flexShrink: 0, minWidth: 62 }}>{it.code}{it.brfCode ? ` · ${it.brfCode}` : ""}</span>
                <span style={{ color: THEME.text, lineHeight: 1.7, flex: 1 }}>{it.textFa}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
