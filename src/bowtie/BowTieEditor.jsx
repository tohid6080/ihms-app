import React, { useState, useEffect } from "react";
import { THEME, styles } from "../shared.js";
import { loadBowtieCanvas } from "./bowtieApi.js";
import BowTieCanvas from "./BowTieCanvas.jsx";

export default function BowTieEditor({ bowtie, onBack, readOnly }) {
  const [data, setData] = useState({ threats: [], consequences: [], barriers: [] });
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
      <h3 style={{ margin: "0 0 4px", color: THEME.navy, fontSize: 17, fontWeight: 700 }}>{bowtie.title}</h3>
      <p style={{ color: THEME.text3, fontSize: 12, marginTop: 0, marginBottom: 14 }}>
        {bowtie.hazard} · {bowtie.topEvent}
      </p>
      <BowTieCanvas
        bowtie={bowtie}
        threats={data.threats}
        consequences={data.consequences}
        barriers={data.barriers}
        onDataChange={load}
        readOnly={readOnly}
      />
      <p style={{ fontSize: 11, color: THEME.text3, marginTop: 10, textAlign: "center" }}>
        برای جابه‌جایی نودها آن‌ها را بکشید؛ برای ویرایش روی هرکدام کلیک کنید. اسکرول = زوم، کشیدن پس‌زمینه = جابه‌جایی نما.
      </p>
    </div>
  );
}
