import React, { useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { markNotificationRead } from "./personnelApi.js";

/**
 * Bell + dropdown list for personnel-module notifications
 * (health-visit deadline, health-result deadline, health expiry —
 * inserted by checkAndUpdateDeadlines in personnelApi.js).
 */
export default function NotificationPanel({ notifications, onChanged }) {
  const [open, setOpen] = useState(false);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    onChanged();
  };
  const handleMarkAllRead = async () => {
    for (const n of notifications) await markNotificationRead(n.id);
    onChanged();
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
        {notifications.length > 0 && (
          <span
            style={{
              position: "absolute", top: -4, insetInlineEnd: -4, background: THEME.danger, color: "#fff",
              fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 17, height: 17, display: "flex",
              alignItems: "center", justifyContent: "center", padding: "0 3px",
            }}
          >
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: 44, insetInlineEnd: 0, width: 300, maxHeight: 360, overflowY: "auto",
            background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12,
            boxShadow: "0 10px 30px -8px rgba(15,42,63,0.25)", zIndex: 30, padding: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: THEME.navy }}>اعلان‌ها</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {notifications.length > 0 && (
                <span style={{ fontSize: 11, color: THEME.teal, cursor: "pointer" }} onClick={handleMarkAllRead}>خواندن همه</span>
              )}
              <X size={15} color={THEME.text3} style={{ cursor: "pointer" }} onClick={() => setOpen(false)} />
            </div>
          </div>

          {notifications.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: "10px 0" }}>اعلان جدیدی نیست</p>}

          {notifications.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, borderBottom: `1px solid ${THEME.border}`, padding: "8px 2px" }}>
              <button
                type="button"
                onClick={() => handleMarkRead(n.id)}
                title="علامت‌گذاری به‌عنوان خوانده‌شده"
                style={{ background: THEME.tealSoft, border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <Check size={12} color={THEME.tealDeep} />
              </button>
              <p style={{ fontSize: 12, color: THEME.text, margin: 0, lineHeight: 1.6 }}>{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
