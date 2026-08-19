// supabase/functions/delete-company/index.ts
//
// حذف کامل و برگشت‌ناپذیر یک شرکت — فقط Super Admin.
//
// چرا این باید Edge Function جدا باشد، نه یک DELETE ساده روی companies:
// ده‌ها جدول (پرسنل، آنومالی، BowTie، ماشین‌آلات، داربست، حساب‌ها و...)
// از طریق company_id به companies وصل‌اند. اگر مستقیم companies حذف شود،
// این وابستگی‌های خارجی‌کلید همان کار را با خطا متوقف می‌کنند. این تابع
// اول همه‌ی داده‌های وابسته را به ترتیب درست (فرزند قبل از والد) حذف
// می‌کند، بعد خودِ شرکت را.
//
// نکته‌ی مهم: سوابق مالی (company_payments، company_subscription_history)
// عمداً هم حذف می‌شوند — چون خواسته‌ی صریح «حذف کامل» برای شرکتی که کاملاً
// انصراف داده همین است. اگر برای حسابداری/حسابرسی نیاز به نگه‌داشتن این
// سوابق دارید، قبل از حذف شرکت از بخش «تاریخچه‌ی پرداخت» خروجی بگیرید —
// این تابع هیچ پشتیبان خودکاری نمی‌سازد.
//
// Deploy:
//   supabase functions deploy delete-company

import { getCallerClaims } from "../_shared/jwtUtils.ts";
import { json, CORS_HEADERS, restFetch } from "../_shared/supabaseAdmin.ts";

// ترتیب حذف — از وابسته‌ترین (فرزند) به مستقل‌ترین (والد). هر جدولی که
// اینجا نیست یا company_id ندارد یا حذفش لازم نیست (مثل super_admins).
const DELETE_ORDER = [
  "bowtie_escalation_controls",
  "bowtie_escalation_factors",
  "anomaly_barrier_links",
  "bowtie_barriers",
  "bowtie_threats",
  "bowtie_consequences",
  "bowties",
  "corrective_actions",
  "anomaly_photos",
  "anomalies",
  "personnel_documents",
  "personnel_audit_log",
  "personnel_notifications",
  "personnel",
  "machinery_documents",
  "machinery",
  "scaffold_tag_photos",
  "scaffold_tags",
  "hcms_risk_assessments",
  "risk_assessment_history",
  "hcms_risk_matrix",
  "risk_knowledge_base",
  "bowtie_effectiveness_thresholds",
  "anomaly_categories",
  "training_requirements",
  "training_courses",
  "job_positions",
  "chat_visibility_rules",
  "chat_matrix_extra_identities",
  "archive_log",
  "user_activity",
  "admin_audit_log",
  "company_payments",
  "company_subscription_history",
  "contractors",
  "employer_accounts",
];

async function logAudit(entry: Record<string, unknown>) {
  await restFetch("admin_audit_log", { method: "POST", body: JSON.stringify([entry]), headers: { Prefer: "return=minimal" } }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const claims = await getCallerClaims(req);
  if (!claims || claims.is_super_admin !== true) {
    return json({ error: "دسترسی غیرمجاز — این عملیات فقط برای Super Admin مجاز است." }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
  }

  const companyId = String(body?.companyId || "");
  const confirmName = String(body?.confirmName || "").trim();
  if (!companyId) return json({ error: "شناسه‌ی شرکت الزامی است" }, 400);

  try {
    const companyRows = await restFetch(`companies?id=eq.${companyId}&select=id,name`);
    const company = companyRows.ok && Array.isArray(companyRows.data) && companyRows.data.length > 0 ? companyRows.data[0] : null;
    if (!company) return json({ error: "شرکت پیدا نشد" }, 404);

    // تأیید صریح — سوپرادمین باید دقیقاً نام شرکت را تایپ کرده باشد، تا
    // حذف تصادفی یک شرکتِ در حال فعالیت واقعی پیش نیاید.
    if (confirmName !== company.name) {
      return json({ error: "نام واردشده با نام دقیق شرکت مطابقت ندارد." }, 400);
    }

    const deletedCounts: Record<string, number> = {};
    for (const table of DELETE_ORDER) {
      const before = await restFetch(`${table}?company_id=eq.${companyId}&select=id`);
      const count = before.ok && Array.isArray(before.data) ? before.data.length : 0;
      if (count > 0) {
        await restFetch(`${table}?company_id=eq.${companyId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      }
      deletedCounts[table] = count;
    }

    const finalDelete = await restFetch(`companies?id=eq.${companyId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (!finalDelete.ok) return json({ error: "همه‌ی داده‌های وابسته حذف شدند، اما حذف خودِ شرکت با خطا مواجه شد.", deletedCounts }, 500);

    await logAudit({
      action: "delete_company", target_type: "company", target_id: companyId, target_username: company.name,
      performed_by: claims.username || "super_admin", performed_by_role: "super_admin",
      note: `حذف کامل شرکت — ${Object.entries(deletedCounts).filter(([, c]) => c > 0).map(([t, c]) => `${t}:${c}`).join(", ") || "بدون داده‌ی وابسته"}`,
    });

    return json({ ok: true, deletedCounts });
  } catch (e) {
    return json({ error: "خطای داخلی: " + String((e as Error)?.message || e) }, 500);
  }
});
