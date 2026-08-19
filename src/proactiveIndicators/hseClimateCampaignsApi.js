import { sb, sbOk, getCurrentCompanyId, SUPABASE_URL, SUPABASE_ANON_KEY } from "../shared.js";

/**
 * مدیریت دوره‌های ارزیابی (کمپین) HSE Climate — طرف احراز هویت‌شده.
 * ثبت خودِ پاسخ‌ها کاملاً جداست (submitHseClimateResponse در همین فایل،
 * که به Edge Function عمومی وصل می‌شود، نه مستقیم به جدول) چون آن مسیر
 * باید بدون ورود هم کار کند — نگاه کنید به PublicHseClimateSurvey.jsx.
 */

export async function createHseClimateCampaign({ projectName, orgType, contractorId, contractorName, targetCount, minValidResponses }, createdBy) {
  const companyId = getCurrentCompanyId();
  const payload = {
    company_id: companyId, project_name: projectName || null, org_type: orgType,
    contractor_id: orgType === "contractor" ? contractorId || null : null,
    contractor_name: orgType === "contractor" ? contractorName || null : null,
    target_count: targetCount || null, min_valid_responses: minValidResponses || 50,
    status: "active", created_by: createdBy || "",
  };
  const rows = await sb("hse_climate_campaigns", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ایجاد دوره‌ی ارزیابی" };
  return campaignFromRow(rows[0]);
}

export async function loadHseClimateCampaigns(scopeToContractorId) {
  const companyId = getCurrentCompanyId();
  let filter = companyId ? `&company_id=eq.${companyId}` : "";
  if (scopeToContractorId) filter += `&contractor_id=eq.${scopeToContractorId}`;
  const rows = await sb(`hse_climate_campaigns?select=*&order=created_at.desc${filter}`);
  return sbOk(rows) ? rows.map(campaignFromRow) : [];
}

export async function closeHseClimateCampaign(id) {
  const rows = await sb(`hse_climate_campaigns?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در بستن دوره" };
  return campaignFromRow(rows[0]);
}
export async function reopenHseClimateCampaign(id) {
  const rows = await sb(`hse_climate_campaigns?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در فعال‌سازی مجدد دوره" };
  return campaignFromRow(rows[0]);
}

function campaignFromRow(r) {
  return {
    id: r.id, companyId: r.company_id, projectName: r.project_name || "", orgType: r.org_type,
    contractorId: r.contractor_id || "", contractorName: r.contractor_name || "",
    targetCount: r.target_count, minValidResponses: r.min_valid_responses,
    publicToken: r.public_token, status: r.status, createdBy: r.created_by || "", createdAt: r.created_at,
  };
}

// لینک عمومی قابل‌اشتراک — صفحه‌ی مستقل و بدون نیاز به ورود
export function buildHseClimateSurveyLink(publicToken) {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}#hse-climate-survey/${publicToken}`;
}

// ---------- نتیجه‌ی تجمیعی — فقط از طریق تابع امن دیتابیس (هرگز رکورد خام) ----------
export async function loadHseClimateAggregate({ projectName, orgType, contractorId } = {}) {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { responseCount: 0, averageTotal: null, dimensionAverages: [] };
  const rows = await sb("rpc/get_hse_climate_aggregate", {
    method: "POST",
    body: JSON.stringify({
      p_company_id: companyId,
      p_project_name: projectName || null,
      p_org_type: orgType || null,
      p_contractor_id: contractorId || null,
    }),
  });
  if (!sbOk(rows) || rows.length === 0) return { responseCount: 0, averageTotal: null, dimensionAverages: [] };
  const r = rows[0];
  return {
    responseCount: Number(r.response_count) || 0,
    averageTotal: r.average_total != null ? Number(r.average_total) : null,
    dimensionAverages: Array.isArray(r.dimension_averages) ? r.dimension_averages : [],
  };
}

// ---------- ثبت پاسخ عمومی (بدون ورود) — از طریق Edge Function، نه مستقیم به جدول ----------

export async function loadPublicCampaignInfo(publicToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/hse-climate-campaign-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ publicToken }),
    });
    const data = await res.json();
    if (!res.ok) return { __error: true, message: data?.error || "خطا در دریافت اطلاعات پرسشنامه" };
    return data;
  } catch {
    return { __error: true, message: "خطا در برقراری ارتباط با سرور" };
  }
}

export async function submitHseClimateResponse(publicToken, answers) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-hse-climate-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ publicToken, answers }),
    });
    const data = await res.json();
    if (!res.ok) return { __error: true, message: data?.error || "خطا در ثبت پرسشنامه" };
    return { ok: true };
  } catch {
    return { __error: true, message: "خطا در برقراری ارتباط با سرور" };
  }
}
