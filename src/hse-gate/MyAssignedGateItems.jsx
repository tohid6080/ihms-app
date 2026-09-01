import React, { useState, useEffect } from "react";
import { ClipboardList, Clock } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { loadAssignedGateItems } from "../hseGateApi.js";

const MODULE_LABELS = {
  anomalyReport: "مدیریت عدم انطباق‌ها",
  personnelAccess: "مدیریت ورود و تردد پرسنل",
  machineryManagement: "مدیریت ماشین‌آلات",
  riskAssessment: "مدیریت ارزیابی ریسک",
  scaffoldManagement: "مدیریت داربست",
};

/**
 * کارهای واگذارشده به من — طبق طرح تأییدشده‌ی گیت HSE. وقتی سرپرست/مدیر
 * HSE یک مورد گزارش‌شده از پیمانکار را به یک کارشناس مشخص واگذار می‌کند
 * (assignGateItem)، آن کارشناس اینجا می‌بیندش. هر کارفرمایی می‌تواند این
 * صفحه را ببیند (نه فقط سرپرست/مدیر HSE) — چون این «کارشناسا» هستند که
 * قرار است بروند بررسی کنند.
 */
export default function MyAssignedGateItems({ currentUser, onBack }) {
  const [items, setItems] = useState(null);

  const load = () => loadAssignedGateItems(currentUser?.username).then(setItems);
  useEffect(() => { load(); }, [currentUser?.username]);

  if (items === null) return <p style={{ color: THEME.text3, textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>بازگشت</div>}
      <h2 style={{ fontSize: 18, color: THEME.navy, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <ClipboardList size={20} color={THEME.teal} /> کارهای واگذارشده به من
      </h2>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18, lineHeight: 1.9 }}>
        مواردی که سرپرست/مدیر HSE برای بررسی به شما واگذار کرده است.
      </p>

      {items.length === 0 && <p style={{ fontSize: 12.5, color: THEME.text3, textAlign: "center", padding: 30 }}>در حال حاضر هیچ کاری به شما واگذار نشده است.</p>}

      {items.map((it) => (
        <div key={it.id} style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: THEME.tealSoft, color: THEME.tealDeep, fontWeight: 700 }}>
            {MODULE_LABELS[it.moduleKey] || it.moduleKey}
          </span>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: THEME.navy, margin: "8px 0 3px" }}>{it.recordLabel || it.recordId}</p>
          <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} /> واگذارشده توسط {it.reviewedBy || "سرپرست/مدیر HSE"} — {toJalaliSafe(it.reviewedAt || it.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
