import React, { useState, useEffect } from "react";
import { Sliders } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadThresholds, saveThresholds } from "./effectivenessApi.js";

/**
 * ادمین/HSE از اینجا مقادیر برش (Threshold) تبدیل امتیاز عددی اثربخشی به
 * رنگ را تنظیم می‌کند. مثال داده‌شده در طرح اصلی:
 *   ۹۲٪ 🟢  →  ۷۸٪ 🟡  →  ۶۰٪ 🟠  →  ۳۰٪ 🔴
 * یعنی این سه عدد، مرز پایینِ هر سطح هستند (effectiveMin/reducingMin/weakMin)
 * — هرچیز پایین‌تر از weakMin به‌طور خودکار «شکست‌خورده» حساب می‌شود.
 */
export default function EffectivenessThresholdsManager({ onBack, currentUser }) {
  const [thresholds, setThresholds] = useState({ effectiveMin: 85, reducingMin: 65, weakMin: 40, id: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadThresholds().then((t) => { setThresholds(t); setLoading(false); });
  }, []);

  const handleSave = async () => {
    setError("");
    if (!(thresholds.effectiveMin > thresholds.reducingMin && thresholds.reducingMin > thresholds.weakMin)) {
      setError("مقادیر باید نزولی باشند: مؤثر > کاهش‌یافته > ضعیف");
      return;
    }
    setSaving(true);
    const result = await saveThresholds(thresholds, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به مدیریت سیستم</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Sliders size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>Threshold اثربخشی Barrier</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18, lineHeight: 1.8 }}>
        این سه عدد تعیین می‌کنند امتیاز عددی محاسبه‌شده‌ی اثربخشی هر Barrier (۰ تا ۱۰۰)، به کدام رنگ نگاشت شود.
        هر عدد، مرز پایین همان سطح است.
      </p>

      <div style={styles.card}>
        <ThresholdRow label="🟢 مؤثر (Effective) — حداقل" value={thresholds.effectiveMin} onChange={(v) => setThresholds({ ...thresholds, effectiveMin: v })} color="#16a34a" />
        <ThresholdRow label="🟡 در حال کاهش اثربخشی — حداقل" value={thresholds.reducingMin} onChange={(v) => setThresholds({ ...thresholds, reducingMin: v })} color="#eab308" />
        <ThresholdRow label="🟠 ضعیف / نیازمند اقدام — حداقل" value={thresholds.weakMin} onChange={(v) => setThresholds({ ...thresholds, weakMin: v })} color="#f97316" />
        <p style={{ fontSize: 11, color: THEME.text3, margin: "6px 0 14px" }}>🔴 شکست‌خورده: هر امتیازی کمتر از عدد بالا</p>

        {error && <p style={styles.error}>{error}</p>}
        {saved && <p style={{ color: "#166534", fontSize: 12.5, marginBottom: 8 }}>ذخیره شد.</p>}
        <button type="button" style={styles.button} onClick={handleSave} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره‌ی تنظیمات"}</button>
      </div>
    </div>
  );
}

function ThresholdRow({ label, value, onChange, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="number" min={0} max={100} style={{ ...styles.input, marginBottom: 0, width: 90 }}
          value={value} onChange={(e) => onChange(Number(e.target.value))} dir="ltr"
        />
        <div style={{ flex: 1, height: 8, background: "#eef1f5", borderRadius: 4, position: "relative" }}>
          <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: `${value}%`, background: color, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 11, color: THEME.text3, width: 24 }}>٪</span>
      </div>
    </div>
  );
}
