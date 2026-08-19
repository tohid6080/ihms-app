// supabase/functions/issue-session-token/index.ts
//
// نسخه‌ی امن‌شده: دیگر هیچ ردیف خامی (شامل رمز عبور، حتی هش‌شده) از
// جدول‌های حساب خوانده نمی‌شود. تأیید رمز عبور کاملاً داخل خودِ دیتابیس
// (توابع verify_employer_password/verify_contractor_password/
// verify_super_admin_password، بخش ۱ SQL) با pgcrypto انجام می‌شود؛ این
// تابع فقط نتیجه‌ی «درست بود یا نه» را می‌بیند، نه خودِ رمز یا هش را.
//
// Deploy:
//   supabase functions deploy issue-session-token

import { signToken, numericDateInSeconds, hasJwtSecret } from "../_shared/jwtUtils.ts";
import { json, CORS_HEADERS, callRpc } from "../_shared/supabaseAdmin.ts";

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24; // ۲۴ ساعت

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!hasJwtSecret()) {
    return json({ error: "APP_JWT_SECRET تنظیم نشده است." }, 500);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
    }

    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    const loginType = body?.loginType === "super_admin" ? "super_admin" : "customer";
    if (!username || !password) return json({ error: "نام‌کاربری و رمز عبور الزامی است" }, 400);

    // ---------- ورود Super Admin ----------
    if (loginType === "super_admin") {
      const result = await callRpc("verify_super_admin_password", { p_username: username, p_password: password });
      const admin = result.ok && Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
      if (!admin) return json({ error: "نام کاربری یا رمز عبور اشتباه است" }, 401);

      const token = await signToken({
        sub: admin.id, role: "authenticated", username: admin.username,
        is_super_admin: true, company_id: null, app_role: "super_admin",
        exp: numericDateInSeconds(TOKEN_LIFETIME_SECONDS),
      });
      return json({ token, user: { id: admin.id, username: admin.username, fullName: admin.full_name || admin.username, role: "SUPER_ADMIN" } });
    }

    // ---------- ورود کارفرما/ادمین ----------
    const employerResult = await callRpc("verify_employer_password", { p_username: username, p_password: password });
    const employer = employerResult.ok && Array.isArray(employerResult.data) && employerResult.data.length > 0 ? employerResult.data[0] : null;
    if (employer) {
      const appRole = employer.role === "admin" ? "admin" : "employer";
      const token = await signToken({
        sub: employer.id, role: "authenticated", username: employer.username,
        is_super_admin: false, company_id: employer.company_id || null, app_role: appRole,
        exp: numericDateInSeconds(TOKEN_LIFETIME_SECONDS),
      });
      return json({
        token,
        user: {
          id: employer.id, name: employer.name, username: employer.username,
          canEdit: employer.can_edit !== false, jobPositionId: employer.job_position_id || "",
          jobPositionTitle: employer.job_position_title || "", companyName: employer.company_name || "",
          role: appRole === "admin" ? "ADMIN" : "EMPLOYER", companyId: employer.company_id || "",
          phone: employer.phone || "", email: employer.email || "",
          preferredLanguage: employer.preferred_language || "fa", createdAt: employer.created_at || "",
        },
      });
    }

    // ---------- ورود پیمانکار ----------
    const contractorResult = await callRpc("verify_contractor_password", { p_username: username, p_password: password });
    const contractor = contractorResult.ok && Array.isArray(contractorResult.data) && contractorResult.data.length > 0 ? contractorResult.data[0] : null;
    if (contractor) {
      const token = await signToken({
        sub: contractor.id, role: "authenticated", username: contractor.username,
        is_super_admin: false, company_id: contractor.company_id || null, app_role: "contractor",
        exp: numericDateInSeconds(TOKEN_LIFETIME_SECONDS),
      });
      return json({
        token,
        user: {
          id: contractor.id, name: contractor.name, username: contractor.username,
          contactPersonName: contractor.contact_person_name || "", startDate: contractor.start_date || "",
          contractDetails: contractor.contract_details || "", jobPositionId: contractor.job_position_id || "",
          jobPositionTitle: contractor.job_position_title || "", companyName: contractor.company_name || "",
          role: "CONTRACTOR", companyId: contractor.company_id || "",
          phone: contractor.phone || "", email: contractor.email || "",
          preferredLanguage: contractor.preferred_language || "fa", createdAt: contractor.created_at || "",
        },
      });
    }

    return json({ error: "نام کاربری یا رمز عبور اشتباه است" }, 401);
  } catch (e) {
    return json({ error: "خطای داخلی: " + String((e as Error)?.message || e) }, 500);
  }
});
