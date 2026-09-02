import React, { useState, useEffect } from "react";
import { ChevronRight, TrendingUp, ClipboardList, BookOpen } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { loadActiveIndicators, loadAllAssessments, accidentPronenessLevel } from "./proactiveIndicatorsApi.js";
import { loadCorrectiveActionsForAssessments, STATUS_META } from "../correctiveActions/correctiveActionsApi.js";
import AccidentPronenessAssessmentForm from "./AccidentPronenessAssessmentForm.jsx";
import HseClimateCampaignManager from "./HseClimateCampaignManager.jsx";
import SbsSubmodule from "./SbsSubmodule.jsx";

/**
 * نقطه‌ی ورود ماژول — طراحی Dynamic: لیست شاخص‌ها از دیتابیس خوانده می‌شود
 * (نه هاردکد)، و فقط شاخص‌های فعال‌شده برای همین شرکت نشان داده می‌شوند
 * (company_proactive_settings). افزودن یک شاخص جدید در آینده فقط با درج
 * در دیتابیس + یک شاخه‌ی رندر مشابه اینجا لازم است.
 *
 * اگر focusPersonnelId داده شده باشد (از پرونده‌ی پرسنل)، مستقیم فرم
 * ارزیابی استعداد حادثه‌پذیری را برای همان پرسنل باز می‌کند.
 */
export default function ProactiveIndicatorsDashboard({ onBack, currentUser, role, readOnly, focusPersonnelId, focusJobTitle, focusPersonnelName }) {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(focusPersonnelId ? "form" : "list"); // list | results | form
  const [activeIndicatorKey, setActiveIndicatorKey] = useState(focusPersonnelId ? "accident_proneness" : null);

  useEffect(() => {
    loadActiveIndicators().then((rows) => { setIndicators(rows); setLoading(false); });
  }, []);

  if (view === "form" && activeIndicatorKey === "accident_proneness") {
    return (
      <AccidentPronenessAssessmentForm
        personnelId={focusPersonnelId}
        jobTitle={focusJobTitle}
        personnelName={focusPersonnelName}
        currentUser={currentUser}
        onBack={() => { if (focusPersonnelId) { onBack(); } else { setView("results"); } }}
        onSaved={() => { if (focusPersonnelId) { onBack(); } else { setView("results"); } }}
      />
    );
  }

  if (view === "results" && activeIndicatorKey === "hse_climate") {
    return <HseClimateCampaignManager currentUser={currentUser} role={role} onBack={() => setView("list")} />;
  }

  if (view === "results" && activeIndicatorKey === "sbs") {
    return <SbsSubmodule currentUser={currentUser} role={role} readOnly={readOnly} onBack={() => setView("list")} />;
  }

  if (view === "results" && activeIndicatorKey) {
    return (
      <ResultsList
        indicatorKey={activeIndicatorKey}
        indicatorName={indicators.find((i) => i.key === activeIndicatorKey)?.name || ""}
        onBack={() => setView("list")}
      />
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={styles.backLink} onClick={onBack}>بازگشت به منو</div>
        <a
          href="/hse_guide.html" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: THEME.teal, textDecoration: "none", background: THEME.tealSoft, padding: "7px 14px", borderRadius: 8 }}
        >
          <BookOpen size={14} /> راهنمای تکمیل و ارزیابی
        </a>
      </div>
      <h3 style={{ marginBottom: 4, color: THEME.navy }}>اندازه‌گیری شاخص‌های Proactive HSE</h3>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 0, marginBottom: 16 }}>
        شاخص‌های پیش‌نگر ایمنی — اندازه‌گیری استعداد و رفتار قبل از وقوع حادثه، نه فقط پس از آن.
      </p>

      {loading && <p style={{ color: THEME.text3, textAlign: "center", padding: 20 }}>در حال بارگذاری...</p>}
      {!loading && indicators.length === 0 && (
        <p style={{ color: THEME.text3, textAlign: "center", padding: 20 }}>
          هنوز هیچ شاخصی برای شرکت شما فعال نشده است — از سوپرادمین درخواست فعال‌سازی کنید.
        </p>
      )}

      {indicators.map((ind) => (
        <div
          key={ind.key}
          onClick={() => { setActiveIndicatorKey(ind.key); setView("results"); }}
          style={{ ...styles.card, width: "auto", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TrendingUp size={20} color={THEME.teal} />
            <div>
              <div style={{ fontWeight: 700, color: THEME.navy, fontSize: 14 }}>{ind.name}</div>
              {ind.description && <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 3 }}>{ind.description}</div>}
            </div>
          </div>
          <ChevronRight size={18} color={THEME.text3} style={{ transform: "rotate(180deg)" }} />
        </div>
      ))}
    </div>
  );
}

// ---------- نتایج استعداد حادثه‌پذیری — جدول شخص‌محور (بدون تغییر) ----------
function ResultsList({ indicatorKey, indicatorName, onBack }) {
  const [rows, setRows] = useState(null);
  const [caByAssessment, setCaByAssessment] = useState({});

  useEffect(() => {
    loadAllAssessments(indicatorKey).then((data) => {
      setRows(data);
      loadCorrectiveActionsForAssessments(data.map((r) => r.id)).then(setCaByAssessment);
    });
  }, [indicatorKey]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={styles.backLink} onClick={onBack}>بازگشت</div>
      <h3 style={{ marginBottom: 4, color: THEME.navy, display: "flex", alignItems: "center", gap: 8 }}>
        <ClipboardList size={18} /> نتایج {indicatorName}
      </h3>
      <p style={{ color: THEME.text3, fontSize: 12, marginTop: 0, marginBottom: 16 }}>
        ثبت ارزیابی جدید فقط از پرونده‌ی همان پرسنل، در ماژول «لیست پرسنل» انجام می‌شود.
      </p>

      {rows === null && <p style={{ color: THEME.text3, textAlign: "center", padding: 20 }}>در حال بارگذاری...</p>}
      {rows !== null && rows.length === 0 && <p style={{ color: THEME.text3, textAlign: "center", padding: 20 }}>هنوز هیچ ارزیابی‌ای ثبت نشده است.</p>}

      {rows && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                <th style={{ textAlign: "right", padding: "8px" }}>پرسنل</th>
                <th style={{ textAlign: "center", padding: "8px" }}>شغل</th>
                <th style={{ textAlign: "center", padding: "8px" }}>تاریخ</th>
                <th style={{ textAlign: "center", padding: "8px" }}>ارزیاب</th>
                <th style={{ textAlign: "center", padding: "8px" }}>امتیاز نهایی</th>
                <th style={{ textAlign: "center", padding: "8px" }}>سطح</th>
                <th style={{ textAlign: "center", padding: "8px" }}>اقدام اصلاحی</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ padding: "8px", fontWeight: 600 }}>{r.personnelName}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{r.jobTitle}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{toJalaliSafe(r.assessmentDate)}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{r.assessorName}</td>
                  <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: THEME.navy }}>{r.finalScore}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    {indicatorKey === "accident_proneness" && r.finalScore != null ? (() => {
                      const lv = accidentPronenessLevel(r.finalScore);
                      return <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: lv.bg, color: lv.color, fontWeight: 700 }}>{lv.level}</span>;
                    })() : "—"}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    {caByAssessment[r.id] ? (
                      <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: STATUS_META[caByAssessment[r.id].status]?.bg || "#eef1f5", color: STATUS_META[caByAssessment[r.id].status]?.color || THEME.text3, fontWeight: 600 }}>
                        {caByAssessment[r.id].actionNumber} — {STATUS_META[caByAssessment[r.id].status]?.label || caByAssessment[r.id].status}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: THEME.text3 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- نتایج HSE Climate اکنون کاملاً از طریق HseClimateCampaignManager
// (لینک/QR ناشناس + نتیجه‌ی تجمیعی) مدیریت می‌شود — این تابع قدیمی مربوط
// به مدل قبلیِ خودارزیابی نام‌دار بود و دیگر استفاده نمی‌شود.
