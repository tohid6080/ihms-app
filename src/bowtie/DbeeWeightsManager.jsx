import React, { useState, useEffect } from "react";
import { Sliders, HelpCircle } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadCompanyWeights, saveCompanyWeight, FACTOR_LABELS } from "./dbeeWeightsApi.js";

// راهنمای هر عامل — مثال‌ها دقیقاً بر اساس منطق واقعی موتور محاسبه
// (dbeeEngine.js) نوشته شده‌اند، نه توضیح کلی و غیردقیق.
const FACTOR_GUIDES = {
  frequency: "تعداد دفعات تکرار یک شاهد ضعف (مثلاً چند بار این Barrier در آنومالی‌های اخیر ذکر شده). مثال: اگر یک Barrier در ۵ آنومالی جدا دیده شود، وزن بیشتر یعنی این تکرار جریمه‌ی سنگین‌تری ایجاد کند.",
  severity: "شدت خودِ رویدادی که ضعف Barrier را نشان داده (مثلاً سطح ریسک آنومالی: بالا/متوسط/پایین، یا ناتوان‌کننده‌بودن حادثه). وزن بیشتر یعنی رویدادهای شدید، تأثیر بیشتری روی افت امتیاز بگذارند.",
  recurrence: "تکرارشدنِ مشابه در بازه‌ی کوتاه (مثلاً ۳ آنومالی مرتبط در ۹۰ روز اخیر). این جدا از «فراوانی کلی» است — تمرکزش روی الگوی اخیر و پشت‌سرهم است، نه کل تاریخچه.",
  criticality: "ضریبی که بر اساس سطح بحرانی‌بودن خودِ Barrier (پایین/متوسط/بالا، همان فیلدی که در خودِ BowTie تعیین می‌شود) کل جریمه‌ی نهایی را تشدید یا تخفیف می‌دهد. مثال: یک Barrier با بحرانی‌بودن «بالا»، با وزن بیشتر، حتی با شواهد کم هم امتیازش سریع‌تر افت می‌کند.",
  recency: "وزن شواهد جدید در برابر شواهد قدیمی. طبق طراحی موتور، شواهد ثبت‌شده در ۹۰ روز اخیر همیشه اثر بیشتری از شواهد قدیمی‌تر دارند؛ این عامل شدت آن تفاوت را تنظیم می‌کند.",
  source_anomaly: "سهم داده‌ی «مدیریت عدم انطباق‌ها (Anomaly)» در محاسبه — آنومالی‌هایی که مستقیماً به این Barrier متصل شده‌اند.",
  source_capa: "سهم داده‌ی «اقدامات اصلاحی (CAPA)» — اقدام‌های باز یا منقضی‌شده‌ی متصل به این Barrier؛ اقدام منقضی‌شده همیشه جریمه‌ی بیشتری دارد.",
  source_incident: "سهم داده‌ی «حوادث» — فقط حوادثی که کاربر HSE صراحتاً به این Barrier مرتبط کرده است (نه هر حادثه‌ای).",
  source_tripod: "سهم داده‌ی «تحلیل ریشه‌ای Tripod Beta» — فقط تحلیل‌هایی که صراحتاً به این Barrier مرتبط شده‌اند؛ نتیجه‌ی «رد شده» توسط کارفرما سیگنال قوی‌تری است.",
  source_sbs: "سهم داده‌ی «نمونه‌برداری رفتار ایمنی (SBS)» — مشاهدات رفتار ناایمن در دسته‌هایی که به این Barrier نگاشت شده‌اند.",
  source_hse_climate: "سهم داده‌ی «جو ایمنی سازمانی (HSE Climate)» — میانگین پایین ابعادی از پرسشنامه که به این Barrier نگاشت شده‌اند.",
  source_accident_proneness: "سهم داده‌ی «استعداد حادثه‌پذیری» — فقط ارزیابی‌های سطح «بالا»/«بسیار بالا» برای مشاغلی که به این Barrier نگاشت شده‌اند.",
};

const FACTOR_GROUPS = [
  { title: "عوامل اصلی محاسبه", keys: ["frequency", "severity", "recurrence", "criticality", "recency"] },
  { title: "وزن هر منبع داده", keys: ["source_anomaly", "source_capa", "source_incident", "source_tripod", "source_sbs", "source_hse_climate", "source_accident_proneness"] },
];

/**
 * مدیریت Weight های DBEE — طبق خواسته‌ی صریح، هم Admin هم Employer
 * (کارفرما/سرپرست یا مدیر HSE) همان شرکت این صفحه را می‌بینند/ویرایش
 * می‌کنند (نه فقط Admin، و نه سوپرادمین). این خودِ الزام فنی «امتیاز
 * محاسباتی دستی قابل‌تغییر نباشد» را تضمین می‌کند: اینجا فقط ضریب هر
 * عامل تنظیم می‌شود (۰ تا ۲)، هرگز عدد نهایی هیچ Barrier ای.
 */
export default function DbeeWeightsManager({ currentUser, onBack }) {
  const [weights, setWeights] = useState(null);
  const [saving, setSaving] = useState(null); // id در حال ذخیره
  const [message, setMessage] = useState("");
  const [openGuide, setOpenGuide] = useState(null); // کلید عاملی که راهنمایش باز است

  const load = () => loadCompanyWeights().then(setWeights);
  useEffect(() => { load(); }, []);

  const handleChange = async (id, value) => {
    setMessage("");
    const w = Number(value);
    if (Number.isNaN(w) || w < 0 || w > 2) return;
    setWeights((prev) => prev.map((x) => (x.id === id ? { ...x, weight: w } : x)));
    setSaving(id);
    const result = await saveCompanyWeight(id, w, currentUser?.name);
    setSaving(null);
    if (result?.__error) { setMessage(result.message); await load(); }
  };

  if (!weights) return <p style={{ color: THEME.text3, textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>بازگشت</div>}
      <h2 style={{ fontSize: 18, color: THEME.navy, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <Sliders size={20} color={THEME.teal} /> وزن‌دهی موتور اثربخشی Barrier (DBEE)
      </h2>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18, lineHeight: 1.9 }}>
        این وزن‌ها مخصوص شرکت شماست و روی محاسبه‌ی امتیاز اثربخشی همه‌ی Barrierهای BowTie اثر می‌گذارد.
        عدد ۱ یعنی خنثی؛ بیشتر از ۱ یعنی همان عامل جریمه‌ی بیشتری ایجاد کند، کمتر از ۱ یعنی جریمه‌اش تخفیف بخورد.
        برای توضیح هر عامل، روی آیکون <HelpCircle size={12} style={{ display: "inline", verticalAlign: "middle" }} /> کنارش بزنید.
      </p>
      {message && <p style={styles.error}>{message}</p>}

      {FACTOR_GROUPS.map((group) => (
        <div key={group.title} style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "0 0 12px" }}>{group.title}</h4>
          {group.keys.map((key) => {
            const w = weights.find((x) => x.factorKey === key);
            if (!w) return null;
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <label style={{ fontSize: 12.5, color: THEME.text2, fontWeight: 600 }}>{FACTOR_LABELS[key] || key}</label>
                    <button
                      type="button" onClick={() => setOpenGuide(openGuide === key ? null : key)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                      title="توضیح این عامل"
                    >
                      <HelpCircle size={13} color={openGuide === key ? THEME.teal : THEME.text3} />
                    </button>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: THEME.navy }}>{w.weight.toFixed(1)}×</span>
                </div>
                {openGuide === key && (
                  <p style={{ fontSize: 11.5, color: THEME.text2, background: THEME.bg, borderRadius: 8, padding: "8px 10px", margin: "0 0 8px", lineHeight: 1.9 }}>
                    {FACTOR_GUIDES[key]}
                  </p>
                )}
                <input
                  type="range" min={0} max={2} step={0.1} value={w.weight} dir="ltr"
                  onChange={(e) => handleChange(w.id, e.target.value)}
                  style={{ width: "100%", accentColor: THEME.teal }}
                  disabled={saving === w.id}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
