import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadIndicatorQuestions, computeIndicatorScore, submitAssessment } from "./proactiveIndicatorsApi.js";

// دقیقاً همان مقیاس فایل مرجع — هر ۵ گزینه، همیشه به همین ترتیب و همین
// امتیازِ خام (قبل از اعمال reverse scoring که در محاسبه‌ی نهایی انجام می‌شود)
const SCALE_OPTIONS = [
  { value: 5, label: "کاملاً موافقم" },
  { value: 4, label: "موافقم" },
  { value: 3, label: "نظری ندارم" },
  { value: 2, label: "مخالفم" },
  { value: 1, label: "بکلی مخالفم" },
];

export default function AccidentPronenessAssessmentForm({ personnelId, jobTitle, personnelName, currentUser, onBack, onSaved }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [assessorName, setAssessorName] = useState(currentUser?.name || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // بعد از ثبت، امتیاز نهایی اینجا نمایش داده می‌شود

  useEffect(() => {
    loadIndicatorQuestions("accident_proneness").then((rows) => { setQuestions(rows); setLoading(false); });
  }, []);

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const unanswered = questions.filter((q) => !answers[q.id]);

  const handleSubmit = async () => {
    setError("");
    if (!assessorName.trim()) { setError("نام ارزیاب الزامی است"); return; }
    if (unanswered.length > 0) {
      setError(`همه‌ی سؤالات اجباری هستند — ${unanswered.length} سؤال هنوز بی‌پاسخ مانده (سؤال شماره‌ی ${unanswered[0].number} به بعد)`);
      return;
    }
    setSaving(true);
    const result = await submitAssessment("accident_proneness", personnelId, jobTitle, assessorName.trim(), questions, answers, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setDone(result.finalScore);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری سؤالات...</div>;

  if (done !== null) {
    return (
      <div style={{ maxWidth: 500, margin: "60px auto", padding: 24, textAlign: "center" }}>
        <CheckCircle2 size={48} color="#166534" style={{ marginBottom: 12 }} />
        <h3 style={{ color: THEME.navy, marginBottom: 8 }}>ارزیابی با موفقیت ثبت شد</h3>
        <p style={{ color: THEME.text3, fontSize: 13, marginBottom: 16 }}>امتیاز نهایی — به‌صورت خودکار محاسبه شد و قابل ویرایش دستی نیست</p>
        <div style={{ fontSize: 40, fontWeight: 800, color: THEME.teal, marginBottom: 20 }}>{done}</div>
        <button type="button" style={styles.button} onClick={onSaved}>بازگشت</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={styles.backLink} onClick={onBack}>بازگشت</div>
      <h3 style={{ marginBottom: 4, color: THEME.navy }}>ارزیابی استعداد حادثه‌پذیری</h3>
      {personnelName && <p style={{ color: THEME.text3, fontSize: 13, marginTop: 0, marginBottom: 4 }}>پرسنل: <b>{personnelName}</b>{jobTitle && ` — ${jobTitle}`}</p>}
      <p style={{ color: THEME.text3, fontSize: 12, marginTop: 0, marginBottom: 16 }}>
        همه‌ی {questions.length} سؤال اجباری است. امتیاز نهایی پس از ثبت، خودکار محاسبه می‌شود و قابل ویرایش دستی نیست.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={styles.label}>نام ارزیاب</label>
        <input style={styles.input} value={assessorName} onChange={(e) => setAssessorName(e.target.value)} dir="rtl" />
      </div>

      {questions.map((q) => (
        <div key={q.id} style={{ ...styles.card, width: "auto", marginBottom: 10, border: !answers[q.id] ? `1.5px solid ${THEME.border}` : `1.5px solid ${THEME.teal}` }}>
          <p style={{ fontSize: 13, color: THEME.navy, fontWeight: 600, marginBottom: 10, lineHeight: 1.8 }}>
            {q.number}. {q.text}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SCALE_OPTIONS.map((opt) => (
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

      {error && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <AlertTriangle size={16} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "#92400e", margin: 0 }}>{error}</p>
        </div>
      )}

      <div style={{ position: "sticky", bottom: 0, background: THEME.surface, padding: "12px 0", borderTop: `1px solid ${THEME.border}` }}>
        <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 8 }}>
          {questions.length - unanswered.length} از {questions.length} سؤال پاسخ داده شده
        </p>
        <button type="button" style={styles.button} onClick={handleSubmit} disabled={saving}>
          {saving ? "در حال ثبت..." : "ثبت نهایی ارزیابی"}
        </button>
      </div>
    </div>
  );
}
