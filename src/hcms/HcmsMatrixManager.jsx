import React, { useState, useEffect } from "react";
import { Grid3x3 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadFullMatrix, setMatrixCell, RISK_LEVEL_META, SEVERITY_CODES, PROBABILITY_LETTERS } from "./hcmsApi.js";

const SEVERITY_LABELS = {
  0: "۰ — بدون هیچ آسیب/تاثیری",
  1: "۱ — جراحت جزئی (استعلاجی <۳ روز)",
  2: "۲ — شکستگی/جراحت شدید (>۳ روز)",
  3: "۳ — نقض عضو / ناتوانی بخشی",
  4: "۴ — یک کشته یا ناتوانی کلی",
  5: "۵ — بیش از یک کشته",
};

const LEVEL_CYCLE = ["Low", "Medium", "High"];

/**
 * ماتریس واقعی فایل مرجع: ۶ سطح شدت (۰ تا ۵) × ۵ سطح احتمال (A تا E) = ۳۰
 * خانه. روی هر خانه کلیک کن تا بین کم/متوسط/زیاد بچرخد — این مقدار در
 * hcms_risk_matrix ذخیره می‌شود و از این پس، دقیقاً همان مقدار (نه فرمول
 * پیش‌فرض) برای آن خانه استفاده می‌شود.
 */
export default function HcmsMatrixManager({ onBack }) {
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setGrid(await loadFullMatrix());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cellFor = (severity, letter) => grid.find((c) => c.severity === severity && c.letter === letter);

  const cycleCell = async (severity, letter) => {
    const cell = cellFor(severity, letter);
    const currentIdx = LEVEL_CYCLE.indexOf(cell?.level);
    const nextLevel = LEVEL_CYCLE[(currentIdx + 1) % LEVEL_CYCLE.length];
    setGrid((prev) => prev.map((c) => (c.severity === severity && c.letter === letter ? { ...c, level: nextLevel, isOverride: true } : c)));
    const result = await setMatrixCell(severity, letter, nextLevel);
    if (result?.__error) { setError(result.message); await load(); }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Grid3x3 size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>ماتریس ریسک HCMS</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 16 }}>
        روی هر خانه کلیک کن تا بین کم (زرد) / متوسط (نارنجی) / زیاد (قرمز) بچرخد. ستون‌ها احتمال وقوع (A تا E)، ردیف‌ها شدت پیامد (۰ تا ۵) هستند — دقیقاً مطابق فایل مرجع.
      </p>
      {error && <p style={styles.error}>{error}</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: THEME.text3 }}>شدت \ احتمال</th>
              {PROBABILITY_LETTERS.map((l) => (
                <th key={l} style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700, color: THEME.navy }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEVERITY_CODES.map((s) => (
              <tr key={s}>
                <td style={{ padding: "6px 10px", fontSize: 11.5, color: THEME.text2, whiteSpace: "nowrap" }}>{SEVERITY_LABELS[s]}</td>
                {PROBABILITY_LETTERS.map((l) => {
                  const cell = cellFor(s, l);
                  const meta = RISK_LEVEL_META[cell?.level] || RISK_LEVEL_META.Low;
                  return (
                    <td key={l} style={{ padding: 3, textAlign: "center" }}>
                      <div
                        onClick={() => cycleCell(s, l)}
                        title={`${s}${l} — کلیک برای تغییر سطح`}
                        style={{
                          width: 56, height: 40, margin: "0 auto", borderRadius: 6, cursor: "pointer",
                          background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, border: cell?.isOverride ? `2px solid ${meta.color}` : `1px solid ${THEME.border}`,
                        }}
                      >
                        {s}{l}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 16, fontSize: 11.5, color: THEME.text2 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: RISK_LEVEL_META.Low.bg, display: "inline-block" }} /> کم (Low)</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: RISK_LEVEL_META.Medium.bg, display: "inline-block" }} /> متوسط (Medium)</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: RISK_LEVEL_META.High.bg, display: "inline-block" }} /> زیاد (High)</span>
      </div>
      <p style={{ fontSize: 10.5, color: THEME.text3, marginTop: 8 }}>خانه‌هایی با کادر پررنگ‌تر یعنی به‌صورت دستی تنظیم شده‌اند؛ بقیه هنوز مقدار پیش‌فرض فرمولی دارند.</p>
    </div>
  );
}
