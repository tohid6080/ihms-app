// supabase/functions/hcms-ai-assistant/index.ts
//
// دستیار هوشمند ارزیابی ریسک HCMS. این تابع تنها جایی است که کلید API
// هوش مصنوعی وجود دارد — در Edge Function secrets، هرگز در باندل مرورگر.
// نقش هوش مصنوعی اینجا فقط «پیشنهاددهنده» است: چند سناریوی کامل تولید
// می‌کند و آن‌ها را برمی‌گرداند؛ هیچ ردیفی در دیتابیس ثبت یا تأیید
// نمی‌شود — ثبت نهایی فقط با انتخاب و تأیید صریح کارشناس HSE، از همان
// مسیر همیشگی (saveHcmsAssessment + تأیید نهایی) انجام می‌شود.
//
// Deploy:
//   supabase functions deploy hcms-ai-assistant
// Secrets:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... \
//     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// تأیید هویت سمت سرور — هر حساب employer_accounts (ادمین یا کارفرما) مجاز
// است، دقیقاً همان محدودیتی که خودِ ماژول «مدیریت ارزیابی ریسک» دارد
// (employerOnly)؛ پیمانکارها اصلاً به این ماژول دسترسی ندارند.
async function verifyEmployerOrAdmin(username: string, password: string): Promise<boolean> {
  if (!username || !password) return false;
  const url = `${SUPABASE_URL}/rest/v1/employer_accounts?username=eq.${encodeURIComponent(username)}&select=password,role`;
  const res = await fetch(url, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } });
  if (!res.ok) return false;
  const rows = await res.json();
  const match = Array.isArray(rows) ? rows[0] : null;
  return !!match && match.password === password;
}

const SEVERITY_REFERENCE = `
۰ = بدون هیچ آسیب یا تاثیری بر سلامتی/بدون خسارت/بدون هیچ تاثیر زیست‌محیطی/بدون ضربه به اعتبار
۱ = جراحت جزئی (استعلاجی کمتر از ۳ روز) / خسارت تا ۵۰ میلیون تومان / تاثیر زیست‌محیطی در سطح ایستگاه کاری با ضرر ناچیز / ضربه بی‌اهمیت به اعتبار
۲ = شکستگی یا جراحت شدید (استعلاجی بیش از ۳ روز) / خسارت ۵۱ تا ۱۵۰ میلیون تومان / تاثیر زیست‌محیطی در سطح جزیره‌ی کاری با ضرر خفیف / ضربه محدود به اعتبار در سطح پروژه
۳ = نقض عضو یا بیماری ناشی از کار (برگشت‌ناپذیر) / خسارت ۱۵۱ تا ۴۰۰ میلیون تومان / تاثیر زیست‌محیطی در محدوده‌ی پروژه با ضرر متوسط / ضربه قابل‌ملاحظه به اعتبار در سطح گروه
۴ = یک کشته یا ناتوانی کلی / خسارت عمده ۴۰۱ میلیون تا ۱ میلیارد تومان / تاثیر زیست‌محیطی فراتر از پروژه در سطح منطقه با ضرر جدی / ضربه به اعتبار در سطح ملی
۵ = بیش از یک کشته / خسارت کلان بالای ۱ میلیارد تومان / تاثیر زیست‌محیطی ملی با ضرر فاجعه‌آفرین / ضربه به اعتبار در سطح بین‌المللی
`.trim();

const PROBABILITY_REFERENCE = `
A = تاکنون در صنایع مشابه اتفاق نیفتاده / در معرض قرارگرفتن قابل چشم‌پوشی
B = در صنایع مشابه اتفاق افتاده / زیر OEL و به‌خوبی تحت کنترل
C = در شرکت‌های گروه اتفاق افتاده / کنترل ممکن است متکی به معیارهای کم‌اهمیت مثل PPE باشد
D = در پروژه‌های این شرکت اتفاق افتاده / اغلب بیش از حد OEL و کنترل کافی نیست
E = به‌طور مکرر در پروژه‌های این شرکت اتفاق می‌افتد / نزدیک به آسیب واقعی
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "سرویس هوش مصنوعی هنوز روی سرور تنظیم نشده — ANTHROPIC_API_KEY را در Edge Function secrets تنظیم کنید" }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
  }
  const { username, password, hazardText, activityContext, matrixSummary } = body || {};

  const authed = await verifyEmployerOrAdmin(username, password);
  if (!authed) return json({ error: "دسترسی غیرمجاز" }, 401);
  if (!hazardText || !hazardText.trim()) return json({ error: "متن خطر ارسال نشده است" }, 400);

  const systemPrompt = `تو یک دستیار متخصص HSE (ایمنی، بهداشت و محیط‌زیست) هستی که برای یک سامانه‌ی مدیریت ریسک صنعتی (HCMS) سناریوهای ارزیابی ریسک پیشنهاد می‌دهی.

مرجع سطح شدت (Severity، عدد ۰ تا ۵):
${SEVERITY_REFERENCE}

مرجع سطح احتمال (Probability، حرف A تا E):
${PROBABILITY_REFERENCE}

${matrixSummary ? `ماتریس رنگی سازمان (سطح ریسک هر ترکیب شدت+احتمال، طبق تنظیمات واقعی این سازمان):\n${matrixSummary}\n` : ""}

بر اساس «خطر شناسایی‌شده» که کاربر می‌فرستد، بین ۳ تا ۵ سناریوی کامل و متفاوت از هم پیشنهاد بده (مثلاً از منظر علت‌های مختلف یا شدت‌های مختلف). خروجی را **فقط و فقط** به‌صورت یک آرایه‌ی JSON معتبر برگردان، بدون هیچ متن اضافه قبل یا بعدش، دقیقاً با این ساختار برای هر سناریو:

{
  "title": "عنوان کوتاه سناریو",
  "cause": "علت خطر",
  "consequence": "پیامدهای احتمالی",
  "existingControls": "کنترل‌های موجود",
  "proposedControls": "اقدامات کنترلی پیشنهادی",
  "severity": <عدد صحیح ۰ تا ۵>,
  "probabilityLetter": "<یکی از A B C D E>",
  "residualSeverity": <عدد صحیح ۰ تا ۵، معمولاً کمتر یا مساوی severity>,
  "residualProbabilityLetter": "<یکی از A B C D E>"
}

فقط آرایه‌ی JSON را برگردان.`;

  const userMessage = `خطر شناسایی‌شده: ${hazardText.trim()}${activityContext ? `\nفعالیت مرتبط: ${activityContext}` : ""}`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!aiRes.ok) {
      const text = await aiRes.text();
      return json({ error: `خطا در فراخوانی هوش مصنوعی: ${aiRes.status} ${text}` }, 502);
    }
    const aiData = await aiRes.json();
    const textBlock = (aiData.content || []).find((b: any) => b.type === "text");
    if (!textBlock) return json({ error: "پاسخ هوش مصنوعی فاقد متن بود" }, 502);

    let cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    let scenarios;
    try {
      scenarios = JSON.parse(cleaned);
    } catch {
      return json({ error: "پاسخ هوش مصنوعی به فرمت JSON معتبر نبود — لطفاً دوباره تلاش کنید" }, 502);
    }
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return json({ error: "هوش مصنوعی هیچ سناریویی برنگرداند" }, 502);
    }

    // ثبت لاگ درخواست (best-effort، اگر شکست بخورد کل درخواست را خراب نمی‌کند)
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/hcms_ai_requests`, {
        method: "POST",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify([{ hazard_text: hazardText.trim(), requested_by: username }]),
      });
    } catch { /* لاگ اختیاری است */ }

    return json({ scenarios });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
