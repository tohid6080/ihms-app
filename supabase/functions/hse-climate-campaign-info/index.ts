// supabase/functions/hse-climate-campaign-info/index.ts
//
// عمومی و بدون نیاز به احراز هویت — با گرفتن public_token از QR/لینک،
// فقط حداقل اطلاعات لازم برای نمایش فرم را برمی‌گرداند (نام شرکت/پروژه،
// وضعیت فعال‌بودن). این تابع هیچ داده‌ی شناسایی‌کننده‌ای نمی‌گیرد و
// نمی‌سازد — فقط می‌خواند.
//
// Deploy:
//   supabase functions deploy hse-climate-campaign-info --no-verify-jwt

import { json, CORS_HEADERS, restFetch } from "../_shared/supabaseAdmin.ts";

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
  if (!publicToken) return json({ error: "لینک نامعتبر است" }, 400);

  try {
    const campaignRes = await restFetch(`hse_climate_campaigns?public_token=eq.${encodeURIComponent(publicToken)}&select=id,status,project_name,org_type,contractor_name,company_id`);
    const campaign = campaignRes.ok && Array.isArray(campaignRes.data) && campaignRes.data.length > 0 ? campaignRes.data[0] : null;
    if (!campaign) return json({ error: "این لینک معتبر نیست یا منقضی شده است" }, 404);
    if (campaign.status !== "active") return json({ error: "این پرسشنامه دیگر فعال نیست" }, 410);

    const companyRes = await restFetch(`companies?id=eq.${campaign.company_id}&select=name`);
    const companyName = companyRes.ok && Array.isArray(companyRes.data) && companyRes.data.length > 0 ? companyRes.data[0].name : "";

    return json({
      companyName,
      projectName: campaign.project_name || "",
      orgType: campaign.org_type,
      contractorName: campaign.contractor_name || "",
    });
  } catch (e) {
    return json({ error: "خطای داخلی: " + String((e as Error)?.message || e) }, 500);
  }
});
