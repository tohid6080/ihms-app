import React, { useState, useEffect } from "react";
import { THEME, styles } from "../shared.js";
import { loadBowtieCanvas } from "./bowtieApi.js";
import { BARRIER_STATUS, EFFECTIVENESS_STATUS } from "./bowtieApi.js";
import BowTieCanvas from "./BowTieCanvas.jsx";

export default function BowTieEditor({ bowtie, onBack, readOnly }) {
  const [data, setData] = useState({ threats: [], consequences: [], barriers: [], escalationFactors: [], escalationControls: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setData(await loadBowtieCanvas(bowtie.id));
    setLoading(false);
  };

  useEffect(() => { load(); }, [bowtie.id]);

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری Canvas...</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      <div style={styles.backLink} onClick={onBack}>← بازگشت به لیست BowTie</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div>
          <h3 style={{ margin: "0 0 4px", color: THEME.navy, fontSize: 17, fontWeight: 700 }}>{bowtie.title}</h3>
          <p style={{ color: THEME.text3, fontSize: 12, margin: 0 }}>
            {bowtie.hazard} · {bowtie.topEvent}
          </p>
        </div>
        <ColorLegend />
      </div>
      <div style={{ marginBottom: 14 }} />
      <BowTieCanvas
        bowtie={bowtie}
        threats={data.threats}
        consequences={data.consequences}
        barriers={data.barriers}
        escalationFactors={data.escalationFactors}
        escalationControls={data.escalationControls}
        onDataChange={load}
        readOnly={readOnly}
      />
      <p style={{ fontSize: 11, color: THEME.text3, marginTop: 10, textAlign: "center" }}>
        برای جابه‌جایی نودها آن‌ها را بکشید؛ برای ویرایش روی هرکدام کلیک کنید. اسکرول = زوم، کشیدن پس‌زمینه = جابه‌جایی نما.
      </p>
    </div>
  );
}

// راهنمای رنگ‌ها — همیشه و در همه‌ی مدل‌های BowTie یکسان و قابل‌مشاهده.
// دو سیستم رنگی مستقل روی کانواس هست: نوار سمت چپ هر کارت Barrier (قضاوت
// دستی و فوری HSE) و دایره‌ی کوچک بالای همان کارت (اثربخشی محاسبه‌شده بر
// اساس شواهد Anomaly) — هر دو اینجا توضیح داده می‌شوند تا کاربر گیج نشود.
function ColorLegend() {
  return (
    <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 10.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ color: THEME.text3, fontWeight: 700, whiteSpace: "nowrap" }}>وضعیت Barrier:</span>
        {BARRIER_STATUS.map((s) => (
          <span key={s.value} style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: "inline-block" }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: THEME.text3, fontWeight: 700, whiteSpace: "nowrap" }}>اثربخشی محاسبه‌شده:</span>
        {EFFECTIVENESS_STATUS.map((s) => (
          <span key={s.value} style={{ display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
            {s.emoji} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
