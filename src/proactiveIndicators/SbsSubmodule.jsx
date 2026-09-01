import React, { useState, useEffect } from "react";
import { ClipboardCheck, Trash2, Printer, Calculator } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { JalaliDateInput, toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { loadSbsCategories, loadSbsObservations, createSbsObservation, deleteSbsObservation, computeSbsAnalysis, SEASONS } from "./sbsApi.js";
import SbsSampleSizeCalculator from "./SbsSampleSizeCalculator.jsx";
import SbsAssignmentsList from "./SbsAssignmentsList.jsx";

/**
 * پورت وفادار از sbs-submodule.html — فرم ثبت + تحلیل فصلی + جدول
 * مشاهدات. جدول مرجع نمایشی (که کاربر گفت لازم نیست) عمداً اینجا
 * نیست؛ خودِ داده‌ی ۱۲ دسته/۳۲ کد مصداق در فرم ثبت (به‌شکل dropdown
 * آبشاری) کاملاً استفاده می‌شود.
 */
export default function SbsSubmodule({ currentUser, role, readOnly, onBack }) {
  const isEmployerSide = role === "EMPLOYER" || role === "ADMIN";
  const [categories, setCategories] = useState([]);
  const [observations, setObservations] = useState(null);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function emptyForm() {
    return { project: "", contractorOrg: "", jobTitle: "", observationDate: "", observationTime: "", status: "", categoryCode: "", subitemId: "", note: "" };
  }

  const [loading, setLoading] = useState(true);

  const load = async () => {
    setObservations(await loadSbsObservations());
  };
  useEffect(() => {
    Promise.all([loadSbsCategories(), load()]).then(([cats]) => {
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p style={{ color: THEME.text3, textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>;
  }
  if (categories.length === 0) {
    return (
      <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center", padding: 20 }}>
        <p style={{ color: THEME.danger, fontSize: 13, lineHeight: 1.9 }}>
          دسته‌بندی‌های SBS هنوز در دیتابیس ثبت نشده‌اند. لطفاً از مدیر سامانه بخواهید فایل SQL مرجع این زیرماژول را اجرا کند.
        </p>
        <div style={{ ...styles.backLink, marginTop: 12, justifyContent: "center" }} onClick={onBack}>بازگشت</div>
      </div>
    );
  }
  if (observations === null) {
    return <p style={{ color: THEME.text3, textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>;
  }

  const selectedCategory = categories.find((c) => c.code === form.categoryCode);
  const isOtherCategory = form.categoryCode === "12";

  const handleSubmit = async () => {
    setError("");
    if (form.status === "unsafe" && isOtherCategory && !form.note.trim()) {
      setError("برای دسته‌ی «سایر»، شرح رفتار مشاهده‌شده الزامی است");
      return;
    }
    setSaving(true);
    const result = await createSbsObservation(form, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setForm(emptyForm());
    setShowForm(false);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("این مشاهده حذف شود؟")) return;
    const result = await deleteSbsObservation(id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  const analysis = computeSbsAnalysis(observations, seasonFilter);
  const catTitleByCode = Object.fromEntries(categories.map((c) => [c.code, c.titleFa]));
  const maxBar = Math.max(1, ...analysis.categoryBars.map(([, n]) => n));

  return (
    <div>
      <div style={styles.backLink} onClick={onBack}>بازگشت</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 18, color: THEME.navy, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardCheck size={20} color={THEME.teal} /> نمونه‌برداری از رفتارهای ایمنی (SBS)
        </h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18, lineHeight: 1.9 }}>
        ثبت میدانی رفتار ایمن/ناایمن کارکنان توسط پیمانکار، و مشاهده‌ی آنی تحلیل نتایج برای ارائه به کارفرما. دوره‌ی ثبت برای پیمانکار: فصلی — هر ۳ ماه یک‌بار.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {!readOnly && (
          <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={() => { setShowForm((v) => !v); setError(""); }}>
            <ClipboardCheck size={14} /> ثبت مشاهده‌ی جدید
          </button>
        )}
        {isEmployerSide && (
          <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6, background: THEME.navyMid }} onClick={() => setShowCalculator((v) => !v)}>
            <Calculator size={14} /> {showCalculator ? "بستن ماشین‌حساب" : "محاسبه و واگذاری حجم نمونه"}
          </button>
        )}
      </div>

      {showCalculator && isEmployerSide && (
        <SbsSampleSizeCalculator currentUser={currentUser} onClose={() => setShowCalculator(false)} onSent={load} />
      )}

      <SbsAssignmentsList role={role} currentUser={currentUser} observations={observations} />

      {showForm && (
        <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={styles.label}>پروژه</label>
              <input style={styles.input} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} dir="rtl" placeholder="مثلاً واحد نمک‌زدایی" />
            </div>
            <div>
              <label style={styles.label}>شرکت / پیمانکار</label>
              <input style={styles.input} value={form.contractorOrg} onChange={(e) => setForm({ ...form, contractorOrg: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>شغل / پست</label>
              <input style={styles.input} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} dir="rtl" placeholder="مثلاً جوشکار، ریگر..." />
            </div>
            <div>
              <label style={styles.label}>تاریخ مشاهده</label>
              <JalaliDateInput value={form.observationDate} onChange={(v) => setForm({ ...form, observationDate: v })} />
            </div>
            <div>
              <label style={styles.label}>ساعت</label>
              <input type="time" style={styles.input} value={form.observationTime} onChange={(e) => setForm({ ...form, observationTime: e.target.value })} />
            </div>
          </div>

          <label style={styles.label}>وضعیت مشاهده</label>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button" onClick={() => setForm({ ...form, status: "safe", categoryCode: "", subitemId: "", note: "" })}
              style={{
                flex: 1, padding: 12, borderRadius: 9, border: `2px solid ${form.status === "safe" ? "#166534" : THEME.border}`,
                background: form.status === "safe" ? "#dcfce7" : "#fbfcfd", color: form.status === "safe" ? "#166534" : THEME.text2,
                fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: THEME.font,
              }}
            >
              ✅ رفتار ایمن
            </button>
            <button
              type="button" onClick={() => setForm({ ...form, status: "unsafe" })}
              style={{
                flex: 1, padding: 12, borderRadius: 9, border: `2px solid ${form.status === "unsafe" ? THEME.danger : THEME.border}`,
                background: form.status === "unsafe" ? THEME.dangerBg : "#fbfcfd", color: form.status === "unsafe" ? THEME.danger : THEME.text2,
                fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: THEME.font,
              }}
            >
              ⚠️ رفتار ناایمن
            </button>
          </div>

          {form.status === "unsafe" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, background: THEME.dangerBg, border: `1px dashed #d9a9a8`, borderRadius: 9, padding: 14, marginTop: 12 }}>
              <div>
                <label style={styles.label}>کد رفتار ناایمن</label>
                <select style={styles.input} value={form.categoryCode} onChange={(e) => setForm({ ...form, categoryCode: e.target.value, subitemId: "" })} dir="rtl">
                  <option value="">انتخاب دسته</option>
                  {categories.map((c) => <option key={c.code} value={c.code}>{c.titleFa}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>کد مصداق</label>
                <select style={styles.input} value={form.subitemId} onChange={(e) => setForm({ ...form, subitemId: e.target.value })} dir="rtl" disabled={!selectedCategory}>
                  <option value="">{selectedCategory ? "انتخاب کنید" : "ابتدا دسته را انتخاب کنید"}</option>
                  {(selectedCategory?.items || []).map((it) => <option key={it.id} value={it.id}>{it.textFa}</option>)}
                </select>
              </div>
              {isOtherCategory && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>شرح رفتار مشاهده‌شده (برای کد ۱۲)</label>
                  <textarea style={{ ...styles.input, minHeight: 60 }} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} dir="rtl" placeholder="نوع رفتار ناایمن مشاهده‌شده را بنویسید..." />
                </div>
              )}
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" style={styles.smallButton} onClick={handleSubmit} disabled={saving || !form.status}>{saving ? "در حال ثبت..." : "ثبت مشاهده"}</button>
            <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => { setShowForm(false); setForm(emptyForm()); setError(""); }}>انصراف</button>
          </div>
        </div>
      )}

      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>فیلتر فصلی</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["all", ...SEASONS].map((s) => (
            <button
              key={s} type="button" onClick={() => setSeasonFilter(s)}
              style={{
                padding: "7px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, border: `1px solid ${THEME.border}`, cursor: "pointer", fontFamily: THEME.font,
                background: seasonFilter === s ? THEME.navy : "#fbfcfd", color: seasonFilter === s ? "#fff" : THEME.text2, borderColor: seasonFilter === s ? THEME.navy : THEME.border,
              }}
            >
              {s === "all" ? "همه‌ی فصول" : s}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
          <StatCard label="کل مشاهدات" value={analysis.total} />
          <StatCard label="رفتار ایمن" value={analysis.safe} color="#166534" bg="#dcfce7" />
          <StatCard label="رفتار ناایمن" value={analysis.unsafe} color={THEME.danger} bg={THEME.dangerBg} />
          <StatCard label="درصد رفتار ناایمن" value={`${analysis.unsafePct.toFixed(1)}٪`} color="#b45309" bg="#fef3c7" />
        </div>

        <h4 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>تفکیک رفتار ناایمن بر اساس دسته</h4>
        {analysis.categoryBars.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, marginBottom: 18 }}>رفتار ناایمنی در این فصل ثبت نشده است.</p>}
        {analysis.categoryBars.map(([code, count]) => (
          <div key={code} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: THEME.text2, width: 200, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={catTitleByCode[code]}>{catTitleByCode[code] || code}</span>
            <div style={{ flex: 1, height: 8, background: THEME.bg, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${(count / maxBar) * 100}%`, height: "100%", background: THEME.danger, borderRadius: 999 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: THEME.navy, width: 24, textAlign: "left", flexShrink: 0 }}>{count}</span>
          </div>
        ))}

        <h4 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "22px 0 10px" }}>وضعیت به تفکیک فصل</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {analysis.seasonSummary.map((s) => (
            <div key={s.season} style={{ background: THEME.bg, borderRadius: 9, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: THEME.navy, marginBottom: 6 }}>{s.season}</div>
              <Row label="کل مشاهدات" value={s.total} />
              <Row label="ناایمن" value={s.unsafe} />
              <Row label="درصد ناایمن" value={s.total ? `${s.unsafePct.toFixed(1)}٪` : "—"} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#eaf0fa", border: "1px solid #aec3d4", borderRadius: 9, padding: 12, marginTop: 18 }}>
          <span style={{ fontSize: 12, color: "#2c4a6b", lineHeight: 1.9 }}>📌 این گزارش برای ارائه به کارفرما آماده است — از دکمه‌ی «چاپ گزارش» پایین صفحه استفاده کنید.</span>
        </div>
      </div>

      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px" }}>جدول مشاهدات ثبت‌شده</h3>
        {analysis.filtered.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 20 }}>مشاهده‌ای برای این فصل ثبت نشده است.</p>}
        {analysis.filtered.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>پروژه</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>پیمانکار</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>تاریخ</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>فصل</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>شغل</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>وضعیت</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>دسته / کد مصداق</th>
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {analysis.filtered.map((o) => (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: "6px 8px" }}>{o.project || "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center" }}>{o.contractorOrg || "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center" }}>{toJalaliSafe(o.observationDate)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center" }}>{o.season}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center" }}>{o.jobTitle || "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center" }}>
                      <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: o.status === "safe" ? "#dcfce7" : THEME.dangerBg, color: o.status === "safe" ? "#166534" : THEME.danger, fontWeight: 600 }}>
                        {o.status === "safe" ? "ایمن" : "ناایمن"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {o.status === "unsafe" ? (catTitleByCode[o.categoryCode] ? `${catTitleByCode[o.categoryCode]}${o.note ? ` — ${o.note}` : ""}` : "—") : "—"}
                    </td>
                    {!readOnly && (
                      <td style={{ padding: "6px 8px", textAlign: "left" }}>
                        <button type="button" onClick={() => handleDelete(o.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                          <Trash2 size={13} color={THEME.danger} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={() => window.print()} style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6, background: THEME.navy }}>
          <Printer size={14} /> چاپ گزارش برای کارفرما
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ background: bg || THEME.bg, borderRadius: 9, padding: "12px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: THEME.text3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || THEME.navy }}>{value}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: THEME.text2, padding: "2px 0" }}>
      <span>{label}</span>
      <b style={{ color: THEME.navy }}>{value}</b>
    </div>
  );
}
