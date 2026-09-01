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
<<<<<<< HEAD
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
=======
// اینجا نیست یا company_id ندارد یا حذفش لازم نیست (مثل super_admins،
// یا جداول مرجع سراسری مثل sbs_ref_*/tripod_ref_*/plans که بین همه‌ی
// شرکت‌ها مشترک‌اند و نباید حذف شوند).
//
// ⚠️ نکته‌ی نگهداری حیاتی: هر جدول جدیدی که از این پس به پروژه اضافه
// می‌شود و ستون company_id دارد، باید همین‌جا هم اضافه شود — وگرنه دقیقاً
// همین باگ (حذف زیرشاخه‌ها موفق، حذف خودِ شرکت با خطای کلید خارجی ناموفق)
// دوباره رخ می‌دهد. این فهرست را از روی حسابرسی کامل schema (بخش
// «Audit دیتابیس» در تاریخچه‌ی این پروژه) بازسازی کردم؛ اگر ماژول جدیدی
// بعد از این اضافه شود، این‌جا را هم به‌روزرسانی کنید.
const DELETE_ORDER = [
  // عمیق‌ترین فرزندان
  "bowtie_escalation_controls", "anomaly_barrier_links", "dbee_score_history", "dbee_source_barrier_map",
  "tripod_branch_hidden_failures", "tripod_corrective_actions", "tripod_status_history", "tripod_targets",
  "risk_assessment_history", "proactive_indicator_answers", "personnel_documents", "personnel_notifications",
  "machinery_documents", "scaffold_tag_photos", "training_requirements", "hse_climate_responses",
  "chat_messages", "chat_participants", "anomaly_photos", "anomaly_notifications", "corrective_actions",
  // سطح بعد
  "bowtie_escalation_factors", "tripod_branch_preconditions", "hcms_risk_assessments",
  "proactive_indicator_assessments", "hse_gate_items",
  // بریرها و شاخه‌ها
  "bowtie_barriers", "tripod_branches",
  // خودِ BowTie/Tripod/Anomaly
  "bowtie_threats", "bowtie_consequences", "bowtie_effectiveness_thresholds", "dbee_weights",
  "tripod_analyses", "anomalies",
  // موجودیت‌های اصلی ماژول‌ها
  "bowties", "incidents", "hcms_risk_matrix", "risk_knowledge_base", "sbs_observations",
  "sbs_sample_size_assignments", "personnel_audit_log", "personnel", "machinery", "scaffold_tags",
  "training_courses", "hse_climate_campaigns", "chat_conversations", "chat_visibility_rules",
  "chat_matrix_extra_identities", "archive_log", "user_activity", "admin_audit_log", "anomaly_categories",
  // مالی/سیستمی مخصوص شرکت
  "payments", "company_payments", "company_subscription_history", "permissions", "system_announcements",
  // جداولی که بقیه به آن‌ها ارجاع می‌دهند — باید آخر از همه حذف شوند
  "job_positions", "contractors", "employer_accounts",
>>>>>>> 62c9c73 (Upload project files)
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
<<<<<<< HEAD
      if (count > 0) {
        await restFetch(`${table}?company_id=eq.${companyId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      }
      deletedCounts[table] = count;
    }

    const finalDelete = await restFetch(`companies?id=eq.${companyId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (!finalDelete.ok) return json({ error: "همه‌ی داده‌های وابسته حذف شدند، اما حذف خودِ شرکت با خطا مواجه شد.", deletedCounts }, 500);
=======
      let deleteError: string | null = null;
      if (count > 0) {
        const delRes = await restFetch(`${table}?company_id=eq.${companyId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        if (!delRes.ok) deleteError = (delRes as any).error || `خطای نامشخص (status ${delRes.status})`;
      }
      deletedCounts[table] = count;
      if (deleteError) {
        return json({
          error: `حذف جدول «${table}» با خطا مواجه شد — این احتمالاً علت واقعی مشکل است.`,
          detail: deleteError, deletedCounts,
        }, 500);
      }
    }

    const finalDelete = await restFetch(`companies?id=eq.${companyId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (!finalDelete.ok) {
      return json({
        error: "همه‌ی داده‌های وابسته حذف شدند، اما حذف خودِ شرکت با خطا مواجه شد.",
        detail: (finalDelete as any).error || `status ${finalDelete.status}`,
        deletedCounts,
      }, 500);
    }
>>>>>>> 62c9c73 (Upload project files)

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
