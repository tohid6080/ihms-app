import React, { useState, useEffect } from "react";
import { X, Grid3x3 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadFullMatrix, RISK_LEVEL_META, SEVERITY_CODES, PROBABILITY_LETTERS } from "./hcmsApi.js";

const SEVERITY_LABELS = {
  0: "۰ — بدون هیچ آسیب/تاثیری",
  1: "۱ — جراحت جزئی (استعلاجی <۳ روز)",
  2: "۲ — شکستگی/جراحت شدید (>۳ روز)",
  3: "۳ — نقض عضو / ناتوانی بخشی",
  4: "۴ — یک کشته یا ناتوانی کلی",
  5: "۵ — بیش از یک کشته",
};

/**
 * پیش‌نمایش ماتریس ریسک — دقیقاً مثل الگوی پیش‌نمایش مدارک پیوستی
 * (DocUploadField/DocumentViewerModal): یک کارت کوچک قابل‌کلیک که با
 * زدنش، نسخه‌ی کامل و بزرگ باز می‌شود.
 *
 * این کامپوننت هیچ ماتریس جدیدی نمی‌سازد و چیزی را ویرایش نمی‌کند — فقط
 * همان داده‌ای را که loadFullMatrix() از hcms_risk_matrix (تنظیم‌شده در
 * «مدیریت سیستم → ماتریس ریسک HCMS») می‌خواند، نمایش می‌دهد. اگر ادمین
 * بعداً ماتریس را عوض کند، همین‌جا هم به‌روز دیده می‌شود — چون هر بار که
 * این کامپوننت mount می‌شود، دوباره از دیتابیس می‌خواند، نه از یک کپی محلی.
 */
export default function RiskMatrixPreview() {
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadFullMatrix().then((g) => { setGrid(g); setLoading(false); });
  }, []);

  const cellFor = (severity, letter) => grid.find((c) => c.severity === severity && c.letter === letter);

  return (
    <>
      <div
        onClick={() => !loading && grid.length > 0 && setShowModal(true)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 10,
          border: `1px solid ${THEME.border}`, borderRadius: 8, cursor: loading ? "default" : "pointer", width: "fit-content", maxWidth: "100%",
        }}
        title="کلیک برای مشاهده‌ی کامل ماتریس ریسک سازمان"
      >
        <MiniGrid grid={grid} loading={loading} />
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: THEME.navy }}>ماتریس ریسک سازمان</div>
          <div style={{ fontSize: 9.5, color: THEME.text3 }}>{loading ? "در حال بارگذاری..." : "برای بزرگ‌نمایی کلیک کنید"}</div>
        </div>
      </div>

      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <button
            type="button"
            onClick={() => setShowModal(false)}
            style={{ position: "absolute", top: 16, insetInlineEnd: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={18} color="#fff" />
          </button>
          <div
            style={{ background: THEME.surface, borderRadius: 12, padding: 24, maxWidth: "94vw", maxHeight: "88vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Grid3x3 size={18} color={THEME.teal} />
              <h3 style={{ margin: 0, fontSize: 16, color: THEME.navy, fontWeight: 700 }}>ماتریس ریسک سازمان</h3>
            </div>
            <p style={{ color: THEME.text3, fontSize: 11.5, marginBottom: 14 }}>
              ستون‌ها احتمال وقوع (A تا E)، ردیف‌ها شدت پیامد (۰ تا ۵) — همان ماتریسی که در «مدیریت سیستم» تعریف شده.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse" }}>
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
                            <div style={{
                              width: 56, height: 40, margin: "0 auto", borderRadius: 6,
                              background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, border: `1px solid ${THEME.border}`,
                            }}>
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
            <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11.5, color: THEME.text2 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: RISK_LEVEL_META.Low.bg, display: "inline-block" }} /> کم (Low)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: RISK_LEVEL_META.Medium.bg, display: "inline-block" }} /> متوسط (Medium)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: RISK_LEVEL_META.High.bg, display: "inline-block" }} /> زیاد (High)</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// شبکه‌ی کوچک ۶×۵ بدون برچسب، فقط برای حس «پیش‌نمایش» — همون رنگ‌های واقعی ماتریس
function MiniGrid({ grid, loading }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${PROBABILITY_LETTERS.length}, 6px)`, gap: 1.5, flexShrink: 0 }}>
      {loading
        ? Array.from({ length: SEVERITY_CODES.length * PROBABILITY_LETTERS.length }).map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: "#EEF1F5" }} />
          ))
        : SEVERITY_CODES.map((s) =>
            PROBABILITY_LETTERS.map((l) => {
              const cell = grid.find((c) => c.severity === s && c.letter === l);
              const meta = RISK_LEVEL_META[cell?.level] || RISK_LEVEL_META.Low;
              return <div key={`${s}${l}`} style={{ width: 6, height: 6, borderRadius: 1, background: meta.color }} />;
            })
          )}
    </div>
  );
}
