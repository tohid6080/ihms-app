// supabase/functions/hcms-ai-assistant/index.ts
//
// دستیار هوشمند ارزیابی ریسک HCMS. این تابع تنها جایی است که کلیدهای API
// هوش مصنوعی وجود دارند — در Edge Function secrets، هرگز در باندل مرورگر.
// نقش هوش مصنوعی اینجا فقط «پیشنهاددهنده» است: چند سناریوی کامل تولید
// می‌کند و آن‌ها را برمی‌گرداند؛ هیچ ردیفی در دیتابیس ثبت یا تأیید
// نمی‌شود — ثبت نهایی فقط با انتخاب و تأیید صریح کارشناس HSE، از همان
// مسیر همیشگی (saveHcmsAssessment + تأیید نهایی) انجام می‌شود.
//
// ============================================================
// لایه‌ی مستقل AI Provider
// ============================================================
// این فایل عمداً به‌جای هاردکد کردن یک سرویس خاص، یک انتزاع دارد: هر
// provider فقط باید بتواند {baseUrl, apiKey, model} بدهد و بقیه (ساخت
// پرامپت، فراخوانی endpoint سازگار با OpenAI، تجزیه‌ی JSON، لاگ) کاملاً
// مشترک و بدون تغییر باقی می‌ماند. برای افزودن یک provider جدید در آینده
// (مثلاً Ollama خودمیزبان، یا هر سرویس دیگر با endpoint سازگار با OpenAI)،
// فقط کافی‌ست یک case جدید به getProviderConfig() اضافه شود — هیچ‌جای
// دیگر این فایل، و هیچ‌کدام از فایل‌های فرانت‌اند (hcmsApi.js،
// HcmsDashboard.jsx)، نیازی به تغییر ندارند.
//
// فعلاً فقط OpenRouter پیاده‌سازی شده (پیش‌فرض) چون سطح رایگانش نیازی به
// کارت اعتباری ندارد (فقط ایمیل) و چون از سرورهای خودش عبور می‌دهد،
// معمولاً محدودیت‌های منطقه‌ای مستقیمِ ارائه‌دهندگان اصلی (OpenAI،
// Google) را دور می‌زند. Ollama برای آینده آماده‌سازی شده ولی غیرفعال
// است — چون Ollama یک سرویس ابری نیست بلکه نرم‌افزاری است که مدل را روی
// سخت‌افزار خودِ شما اجرا می‌کند؛ برای فعال‌کردنش باید خودتان یک سرور
// (با Ollama نصب‌شده و در دسترسِ اینترنت) داشته باشید و آدرسش را در
// OLLAMA_BASE_URL بدهید.
//
// Deploy:
//   supabase functions deploy hcms-ai-assistant
// Secrets (برای OpenRouter، پیش‌فرض فعلی):
//   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
// برای سوییچ به provider دیگر در آینده (مثلاً بعد از راه‌اندازی Ollama):
//   supabase secrets set AI_PROVIDER=ollama
//   supabase secrets set OLLAMA_BASE_URL=https://your-ollama-server.example.com/v1

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ACTIVE_PROVIDER = Deno.env.get("AI_PROVIDER") ?? "openrouter";

interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

// تنها جایی که برای افزودن یک provider جدید باید ویرایش شود
function getProviderConfig(providerName: string): ProviderConfig {
  switch (providerName) {
    case "openrouter":
      return {
        name: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: Deno.env.get("OPENROUTER_API_KEY") ?? "",
        // مدل رایگان پیش‌فرض؛ فهرست مدل‌های :free در OpenRouter گاهی تغییر
        // می‌کند — اگر این مدل دیگر در دسترس نبود، از openrouter.ai/models
        // (فیلتر Free) یک مدل جایگزین انتخاب کنید و OPENROUTER_MODEL را
        // ست کنید، بدون نیاز به تغییر این فایل.
        model: Deno.env.get("OPENROUTER_MODEL") ?? "meta-llama/llama-3.3-70b-instruct:free",
        extraHeaders: { "HTTP-Referer": "https://ihms-app.local", "X-Title": "IHMS HCMS Assistant" },
      };
    case "ollama":
      // آماده برای آینده — نیاز به یک سرور Ollama خودمیزبان و در دسترس دارد
      return {
        name: "ollama",
        baseUrl: Deno.env.get("OLLAMA_BASE_URL") ?? "http://localhost:11434/v1",
        apiKey: Deno.env.get("OLLAMA_API_KEY") ?? "",
        model: Deno.env.get("OLLAMA_MODEL") ?? "llama3.3",
      };
    default:
      throw new Error(`AI Provider ناشناخته: "${providerName}"`);
  }
}

// فراخوانی مشترک — هر provider که endpoint سازگار با OpenAI Chat Completions
// بدهد (OpenRouter و Ollama هر دو این‌طورند) از همین یک تابع رد می‌شود
async function callAiProvider(config: ProviderConfig, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      ...(config.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${config.name} (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.name}: پاسخ فاقد متن بود — ${JSON.stringify(data).slice(0, 300)}`);
  return content;
}

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

function buildSystemPrompt(matrixSummary: string): string {
  return `تو یک دستیار متخصص HSE (ایمنی، بهداشت و محیط‌زیست) هستی که برای یک سامانه‌ی مدیریت ریسک صنعتی (HCMS) سناریوهای ارزیابی ریسک پیشنهاد می‌دهی.

مرجع سطح شدت (Severity، عدد ۰ تا ۵):
${SEVERITY_REFERENCE}

مرجع سطح احتمال (Probability، حرف A تا E):
${PROBABILITY_REFERENCE}

${matrixSummary ? `ماتریس رنگی سازمان (سطح ریسک هر ترکیب شدت+احتمال، طبق تنظیمات واقعی این سازمان):\n${matrixSummary}\n` : ""}

بر اساس «خطر شناسایی‌شده» که کاربر می‌فرستد، بین ۳ تا ۵ سناریوی کامل و متفاوت از هم پیشنهاد بده. خروجی را فقط و فقط به‌صورت یک آرایه‌ی JSON معتبر برگردان — هیچ متن، توضیح یا فرمت‌بندی markdown قبل یا بعدش نباشد، دقیقاً با این ساختار برای هر سناریو:

[{"title": "عنوان کوتاه سناریو", "cause": "علت خطر", "consequence": "پیامدهای احتمالی", "existingControls": "کنترل‌های موجود", "proposedControls": "اقدامات کنترلی پیشنهادی", "severity": 0, "probabilityLetter": "A", "residualSeverity": 0, "residualProbabilityLetter": "A"}]

severity و residualSeverity باید عدد صحیح ۰ تا ۵ باشند. probabilityLetter و residualProbabilityLetter باید دقیقاً یکی از A B C D E باشند. residualSeverity معمولاً باید کمتر یا مساوی severity باشد (چون کنترل‌های پیشنهادی ریسک را کاهش می‌دهند).`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let providerConfig: ProviderConfig;
  try {
    providerConfig = getProviderConfig(ACTIVE_PROVIDER);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
  if (!providerConfig.apiKey && providerConfig.name !== "ollama") {
    return json({ error: `سرویس هوش مصنوعی (${providerConfig.name}) هنوز روی سرور تنظیم نشده — کلید API را در Edge Function secrets تنظیم کنید` }, 500);
  }

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

  const systemPrompt = buildSystemPrompt(matrixSummary || "");
  const userMessage = `خطر شناسایی‌شده: ${hazardText.trim()}${activityContext ? `\nفعالیت مرتبط: ${activityContext}` : ""}`;

  try {
    const rawText = await callAiProvider(providerConfig, systemPrompt, userMessage);
    const cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "");
    let scenarios;
    try {
      scenarios = JSON.parse(cleaned);
    } catch {
      // بعضی مدل‌های رایگان متن اضافه قبل/بعد آرایه می‌گذارند — تلاش برای
      // استخراج فقط بخش [ ... ] قبل از تسلیم‌شدن
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try { scenarios = JSON.parse(match[0]); } catch { /* پایین fallback نهایی */ }
      }
      if (!scenarios) return json({ error: "پاسخ هوش مصنوعی به فرمت JSON معتبر نبود — لطفاً دوباره تلاش کنید" }, 502);
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

    return json({ scenarios, provider: providerConfig.name });
  } catch (e) {
    return json({ error: `خطا در فراخوانی هوش مصنوعی (${providerConfig.name}): ${String(e?.message || e)}` }, 502);
  }
});
