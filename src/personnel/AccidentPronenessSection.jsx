import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "./jalaliDate.jsx";
import { needsAccidentPronenessAssessment, isAccidentPronenessEnabledForCompany, loadLatestAccidentPronenessAssessment, accidentPronenessLevel } from "../proactiveIndicators/proactiveIndicatorsApi.js";
import { createCorrectiveAction, loadCorrectiveActionForAssessment, STATUS_META } from "../correctiveActions/correctiveActionsApi.js";

/**
 * وضعیت ارزیابی استعداد حادثه‌پذیری برای یک پرسنل خاص — سه حالت ممکن:
 * ۱. شغل بحرانی + هنوز ارزیابی‌نشده → بنر نارنجی «نیاز به ارزیابی»
 * ۲. ارزیابی‌شده، بدون اقدام اصلاحی مرتبط → نمایش نتیجه + (فقط برای
 *    کارفرما/ادمین) امکان صدور اقدام اصلاحی
 * ۳. ارزیابی‌شده، با اقدام اصلاحی مرتبط → نمایش نتیجه + وضعیت همان اقدام
 *    (که خودِ پیمانکار هم از همینجا و هم از ماژول اقدامات اصلاحی می‌بیندش)
 */
export default function AccidentPronenessSection({ personnel, role, currentUser, onNavigateToAssessment }) {
  const [apEnabled, setApEnabled] = useState(true); // پیش‌فرض true تا رفتار قبلی حفظ شود؛ بررسی واقعی async زیر
  const [assessment, setAssessment] = useState(undefined); // undefined = هنوز لود نشده
  const [correctiveAction, setCorrectiveAction] = useState(null);
  const [showCaForm, setShowCaForm] = useState(false);
  const [caDescription, setCaDescription] = useState("");
  const [caPriority, setCaPriority] = useState("medium");
  const [caDueDate, setCaDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    isAccidentPronenessEnabledForCompany().then(setApEnabled);
    loadLatestAccidentPronenessAssessment(personnel.id).then((a) => {
      setAssessment(a || null);
      if (a) loadCorrectiveActionForAssessment(a.id).then(setCorrectiveAction);
    });
  }, [personnel.id]);

  if (!apEnabled) return null;

  // هنوز در حال بارگذاری — چیزی نمایش نده تا از چشمک‌زدن بنر جلوگیری شود
  if (assessment === undefined) return null;

  // حالت ۱: هنوز ارزیابی‌نشده — فقط اگر شغل بحرانی باشد
  if (assessment === null) {
    if (!needsAccidentPronenessAssessment(personnel.jobTitle)) return null;
    return (
      <div style={{ ...styles.card, width: "auto", background: "#fff7ed", border: "1px solid #fdba74" }}>
        <h3 style={{ fontSize: 13, color: "#7c2d12", margin: "0 0 6px", fontWeight: 700 }}>نیاز به ارزیابی استعداد حادثه‌پذیری</h3>
        <p style={{ fontSize: 12, color: "#7c2d12", margin: "0 0 10px", lineHeight: 1.8 }}>
          شغل «{personnel.jobTitle}» جزو مشاغل بحرانی است — قبل از شروع به کار، انجام ارزیابی استعداد حادثه‌پذیری برای این پرسنل الزامی است.
        </p>
        <button
          type="button"
          style={{ ...styles.smallButton, background: "#c2410c" }}
          onClick={() => onNavigateToAssessment && onNavigateToAssessment({ personnelId: personnel.id, jobTitle: personnel.jobTitle, personnelName: personnel.name })}
        >
          ورود به فرم ارزیابی
        </button>
      </div>
    );
  }

  // حالت ۲/۳: ارزیابی موجود است — نتیجه را نشان بده
  const canIssueCorrectiveAction = (role === "EMPLOYER" || role === "ADMIN") && !correctiveAction;
  const levelInfo = accidentPronenessLevel(assessment.finalScore);
  // طبق آستانه‌ی درخواستی: از سطح «متوسط» به بالا، لازم است اقدام اصلاحی
  // برای پیمانکار صادر شود — اینجا فقط با یک هشدار برجسته پیشنهاد می‌شود؛
  // صدور نهایی همچنان با تأیید صریح کارفرما/ادمین (زدن دکمه) انجام می‌شود.
  const suggestsCorrectiveAction = levelInfo.level !== "پایین";

  const handleSendCorrectiveAction = async () => {
    if (!caDescription.trim()) { setError("توضیح اقدام اصلاحی الزامی است"); return; }
    setError("");
    setSaving(true);
    const result = await createCorrectiveAction({
      source: "proactive_indicator",
      nonconformanceDescription: `امتیاز ارزیابی استعداد حادثه‌پذیری پرسنل «${personnel.name}» (${personnel.jobTitle}): ${assessment.finalScore} — سطح ${levelInfo.level}`,
      actionDescription: caDescription.trim(),
      responsibleContractorId: personnel.contractorId || "",
      responsibleContractorName: personnel.contractorName || "",
      priority: caPriority,
      dueDate: caDueDate || "",
      status: "open",
      linkedAssessmentId: assessment.id,
    }, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setCorrectiveAction(result);
    setShowCaForm(false);
  };

  return (
    <div style={{ ...styles.card, width: "auto", background: levelInfo.bg, border: `1px solid ${levelInfo.color}` }}>
      <h3 style={{ fontSize: 13, color: "#1f2937", margin: "0 0 6px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
        <CheckCircle2 size={15} color={levelInfo.color} /> نتیجه‌ی ارزیابی استعداد حادثه‌پذیری
      </h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#1f2937", marginBottom: 10 }}>
        <span>امتیاز نهایی: <b style={{ fontSize: 17 }}>{assessment.finalScore}</b></span>
        <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 999, background: "#fff", color: levelInfo.color, fontWeight: 700, border: `1px solid ${levelInfo.color}` }}>
          سطح: {levelInfo.level}
        </span>
        <span>تاریخ: {toJalaliSafe(assessment.assessmentDate)}</span>
        <span>ارزیاب: {assessment.assessorName}</span>
      </div>

      {suggestsCorrectiveAction && canIssueCorrectiveAction && !showCaForm && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fff", border: `1px solid ${levelInfo.color}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <AlertTriangle size={16} color={levelInfo.color} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#1f2937", margin: 0 }}>
            با توجه به سطح «{levelInfo.level}»، صدور اقدام اصلاحی برای این پرسنل توصیه می‌شود.
          </p>
        </div>
      )}

      {correctiveAction && (
        <div style={{ background: "#fff", borderRadius: 8, padding: 10, marginBottom: canIssueCorrectiveAction ? 0 : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: THEME.navy }}>{correctiveAction.actionNumber}</span>
            <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: STATUS_META[correctiveAction.status]?.bg || "#eef1f5", color: STATUS_META[correctiveAction.status]?.color || THEME.text3, fontWeight: 600 }}>
              {STATUS_META[correctiveAction.status]?.label || correctiveAction.status}
            </span>
          </div>
          <p style={{ fontSize: 12, color: THEME.text2, margin: 0 }}>{correctiveAction.actionDescription}</p>
          {correctiveAction.dueDate && <p style={{ fontSize: 11, color: THEME.text3, margin: "4px 0 0" }}>مهلت: {toJalaliSafe(correctiveAction.dueDate)}</p>}
          {role === "CONTRACTOR" && (
            <p style={{ fontSize: 11, color: "#92400e", margin: "6px 0 0" }}>برای پیگیری و ثبت پیشرفت، به ماژول «اقدامات اصلاحی» مراجعه کنید.</p>
          )}
        </div>
      )}

      {canIssueCorrectiveAction && !showCaForm && (
        <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowCaForm(true)}>
          <Send size={13} /> ارسال اقدام اصلاحی برای پیمانکار
        </button>
      )}

      {canIssueCorrectiveAction && showCaForm && (
        <div style={{ background: "#fff", borderRadius: 8, padding: 10 }}>
          <label style={styles.label}>توضیح اقدام اصلاحی</label>
          <textarea style={{ ...styles.input, minHeight: 60 }} value={caDescription} onChange={(e) => setCaDescription(e.target.value)} dir="rtl" />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select style={{ ...styles.input, flex: 1 }} value={caPriority} onChange={(e) => setCaPriority(e.target.value)} dir="rtl">
              <option value="low">اولویت کم</option>
              <option value="medium">اولویت متوسط</option>
              <option value="high">اولویت زیاد</option>
              <option value="critical">بحرانی</option>
            </select>
            <input type="date" style={{ ...styles.input, flex: 1 }} value={caDueDate} onChange={(e) => setCaDueDate(e.target.value)} />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" style={styles.smallButton} onClick={handleSendCorrectiveAction} disabled={saving}>
              {saving ? "در حال ارسال..." : "ارسال به پیمانکار"}
            </button>
            <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setShowCaForm(false)}>انصراف</button>
          </div>
        </div>
      )}
    </div>
  );
}
