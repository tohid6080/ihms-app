import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { THEME } from "../shared.js";
import { fetchDatabaseSizeMB, DB_SIZE_WARNING_MB, DB_SIZE_FREE_TIER_LIMIT_MB } from "./dbSizeMonitor.js";

export default function DbSizeWarningBanner() {
  const [sizeMB, setSizeMB] = useState(null);

  useEffect(() => {
    fetchDatabaseSizeMB().then(setSizeMB);
  }, []);

  if (sizeMB === null || sizeMB < DB_SIZE_WARNING_MB) return null;

  const critical = sizeMB >= DB_SIZE_FREE_TIER_LIMIT_MB * 0.9;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, background: critical ? "#fdecec" : "#fef3c7",
        border: `1.5px solid ${critical ? THEME.danger : "#d97706"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14,
      }}
    >
      <AlertTriangle size={18} color={critical ? THEME.danger : "#b45309"} style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: critical ? THEME.danger : "#92400e" }}>
          حجم دیتابیس: {sizeMB} از {DB_SIZE_FREE_TIER_LIMIT_MB} مگابایت ({Math.round((sizeMB / DB_SIZE_FREE_TIER_LIMIT_MB) * 100)}٪)
        </div>
        <div style={{ fontSize: 11.5, color: critical ? THEME.danger : "#92400e", marginTop: 3 }}>
          {critical
            ? "به سقف پلن رایگان Supabase بسیار نزدیک شده‌اید. مدارک/عکس‌های قدیمی را آرشیو و از سامانه حذف کنید."
            : "به‌زودی لازم است مدارک یا عکس‌های قدیمی را روی سیستم خودتان آرشیو و از سامانه حذف کنید."}
        </div>
      </div>
    </div>
  );
}
