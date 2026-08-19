// supabase/functions/submit-hse-climate-response/index.ts
//
// عمومی و بدون نیاز به احراز هویت — تنها راه نوشتن در hse_climate_responses
// (که RLS اش عمداً هیچ policy ای برای anon/authenticated ندارد). این
// تابع عمداً هیچ چیز شناسایی‌کننده‌ای (نام، کد پرسنلی، موبایل، IP، user
// agent) از درخواست استخراج یا ذخیره نمی‌کند — فقط answers.
//
// محاسبه‌ی امتیاز از همان موتور مرجع (hseClimateScoring.ts، کپی دقیق
// نسخه‌ی کلاینت) انجام می‌شود — نه بازنویسی فرمول.
//
// Deploy:
//   supabase functions deploy submit-hse-climate-response --no-verify-jwt

import { json, CORS_HEADERS, restFetch } from "../_shared/supabaseAdmin.ts";
import { scoreHseClimate, isCompleteHseClimate } from "../_shared/hseClimateScoring.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
  }

  const publicToken = String(body?.publicToken || "").trim();
  const answers = body?.answers;
  if (!publicToken) return json({ error: "لینک نامعتبر است" }, 400);
  if (!answers || !isCompleteHseClimate(answers)) {
    return json({ error: "همه‌ی ۴۳ سؤال باید پاسخ داده شوند" }, 400);
  }

  try {
    const campaignRes = await restFetch(`hse_climate_campaigns?public_token=eq.${encodeURIComponent(publicToken)}&select=id,status,company_id`);
    const campaign = campaignRes.ok && Array.isArray(campaignRes.data) && campaignRes.data.length > 0 ? campaignRes.data[0] : null;
    if (!campaign) return json({ error: "این لینک معتبر نیست یا منقضی شده است" }, 404);
    if (campaign.status !== "active") return json({ error: "این پرسشنامه دیگر فعال نیست" }, 410);

    // محاسبه‌ی دقیق از موتور مرجع — نه بازنویسی
    const result = scoreHseClimate(answers);

    const payload = {
      campaign_id: campaign.id,
      company_id: campaign.company_id,
      answers,
      dimension_scores: result.dimensions,
      total_score: result.totalScore,
      total_level: result.level,
      status: "completed",
    };
    const inserted = await restFetch("hse_climate_responses", { method: "POST", body: JSON.stringify([payload]) });
    if (!inserted.ok) return json({ error: "خطا در ثبت پرسشنامه" }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: "خطای داخلی: " + String((e as Error)?.message || e) }, 500);
  }
});
