import React, { useState } from "react";
import { Bell, ChevronLeft, X } from "lucide-react";
import { styles, THEME } from "../shared.js";

/**
 * Bell + dropdown showing the live-computed status summary (open
 * anomalies, personnel needing a health visit/result upload — grouped per
 * contractor for the employer, scoped to just their own company for a
 * contractor). Nothing here is stored anywhere; it's recalculated fresh
 * every time the panel loads, so a line simply disappears on its own once
 * the underlying issue is resolved — no "mark as read" needed.
 * Clicking an item navigates straight to the relevant filtered screen via
 * `onNavigate(target)`.
 */
export default function NotificationPanel({ smartItems = [], onNavigate }) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (target) => {
    setOpen(false);
    onNavigate(target);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative", background: "#fff", border: `1.5px solid ${THEME.border}`, borderRadius: 9,
          width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        <Bell size={17} color={THEME.navy} />
        {smartItems.length > 0 && (
          <span
            style={{
              position: "absolute", top: -4, insetInlineEnd: -4, background: THEME.danger, color: "#fff",
              fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 17, height: 17, display: "flex",
              alignItems: "center", justifyContent: "center", padding: "0 3px",
            }}
          >
            {smartItems.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "fixed", top: 58, insetInlineEnd: 8, width: "calc(100vw - 16px)", maxWidth: 320, maxHeight: "70vh", overflowY: "auto",
            background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12,
            boxShadow: "0 10px 30px -8px rgba(15,42,63,0.25)", zIndex: 30, padding: 10, boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: THEME.navy }}>اعلان‌ها</span>
            <X size={15} color={THEME.text3} style={{ cursor: "pointer" }} onClick={() => setOpen(false)} />
          </div>

          {smartItems.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: "10px 0" }}>اعلان جدیدی نیست</p>}

          {smartItems.map((item) => (
            <div
              key={item.key}
              onClick={() => handleNavigate(item.target)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                background: THEME.tealSoft, borderRadius: 8, padding: "8px 10px", marginBottom: 6, cursor: "pointer",
              }}
            >
              <p style={{ fontSize: 12, color: THEME.tealDeep, margin: 0, lineHeight: 1.6, fontWeight: 600 }}>{item.label}</p>
              <ChevronLeft size={14} color={THEME.tealDeep} style={{ flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
