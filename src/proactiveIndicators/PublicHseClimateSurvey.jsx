import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { THEME } from "../shared.js";
import { HSE_CLIMATE_QUESTIONS, HSE_CLIMATE_OPTIONS } from "./hseClimateData.js";
import { loadPublicCampaignInfo, submitHseClimateResponse } from "./hseClimateCampaignsApi.js";

/**
 * صفحه‌ی مستقل و کاملاً ناشناس — از طریق آدرس هش hse-climate-survey همراه
 * با publicToken باز می‌شود (نگاه کنید به App.jsx). هیچ وابستگی‌ای به
 * ورود، currentUser، یا هیچ بخش دیگری از اپ ندارد. هیچ چیز
 * شناسایی‌کننده‌ای (نام، شماره، IP، دستگاه) نه گرفته می‌شود، نه ذخیره.
 */
export default function PublicHseClimateSurvey({ publicToken }) {
  const [campaignInfo, setCampaignInfo] = useState(undefined); // undefined=در حال بارگذاری
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadPublicCampaignInfo(publicToken).then(setCampaignInfo);
  }, [publicToken]);

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const unanswered = HSE_CLIMATE_QUESTIONS.filter((q) => !answers[q.id]);

  const handleSubmit = async () => {
    setError("");
    if (unanswered.length > 0) {
      setError(`همه‌ی سؤالات اجباری هستند — ${unanswered.length} سؤال هنوز بی‌پاسخ مانده (اولین مورد: سؤال شماره‌ی ${unanswered[0].id})`);
      // اسکرول خودکار به اولین سؤال بی‌پاسخ — چون با ۴۳ سؤال، پیدا کردن
      // دستی سؤال جاافتاده در وسط لیست عملاً سخت است
      const el = document.getElementById(`hse-climate-q-${unanswered[0].id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    const result = await submitHseClimateResponse(publicToken, answers);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setDone(true);
  };

  if (campaignInfo === undefined) {
    return <div style={{ padding: 60, textAlign: "center", color: THEME.text3, fontFamily: THEME.font }}>در حال بارگذاری...</div>;
  }

  if (campaignInfo?.__error) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, textAlign: "center", fontFamily: THEME.font }}>
        <AlertTriangle size={40} color={THEME.danger} style={{ marginBottom: 12 }} />
        <p style={{ color: THEME.text2, fontSize: 14 }}>{campaignInfo.message}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, textAlign: "center", fontFamily: THEME.font }}>
        <CheckCircle2 size={48} color="#166534" style={{ marginBottom: 12 }} />
        <h2 style={{ color: THEME.navy, fontSize: 18 }}>پرسشنامه با موفقیت ثبت شد</h2>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: THEME.font, direction: "rtl" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ color: THEME.navy, fontSize: 17, marginBottom: 4 }}>پرسشنامه جو ایمنی، بهداشت و محیط زیست</h2>
        <p style={{ color: THEME.text3, fontSize: 12.5 }}>
          {campaignInfo.companyName}{campaignInfo.projectName && ` — ${campaignInfo.projectName}`}
        </p>
        <p style={{ color: THEME.text3, fontSize: 11.5, marginTop: 8, lineHeight: 1.8 }}>
          پاسخ‌های شما کاملاً ناشناس ثبت می‌شود — هیچ نام، شماره پرسنلی یا اطلاعات شناسایی‌کننده‌ای ذخیره نمی‌شود.
        </p>
      </div>

      {HSE_CLIMATE_QUESTIONS.map((q) => (
        <div key={q.id} id={`hse-climate-q-${q.id}`} style={{ background: THEME.surface, border: `1.5px solid ${answers[q.id] ? THEME.teal : THEME.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <p style={{ fontSize: 13, color: THEME.navy, fontWeight: 600, marginBottom: 10, lineHeight: 1.8 }}>
            {q.id}. {q.text}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {HSE_CLIMATE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                  background: answers[q.id] === opt.value ? THEME.teal : THEME.bg,
                  color: answers[q.id] === opt.value ? "#fff" : THEME.text2,
                  border: `1px solid ${answers[q.id] === opt.value ? THEME.teal : THEME.border}`,
                }}
              >
                <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === opt.value} onChange={() => handleAnswer(q.id, opt.value)} style={{ display: "none" }} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div style={{ position: "sticky", bottom: 0, background: THEME.bg, padding: "14px 0" }}>
        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <AlertTriangle size={16} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12.5, color: "#92400e", margin: 0 }}>{error}</p>
          </div>
        )}
        <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 8, textAlign: "center" }}>
          {HSE_CLIMATE_QUESTIONS.length - unanswered.length} از {HSE_CLIMATE_QUESTIONS.length} سؤال پاسخ داده شده
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: THEME.teal, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: THEME.font }}
        >
          {saving ? "در حال ثبت..." : "ثبت پرسشنامه"}
        </button>
      </div>
    </div>
  );
}
