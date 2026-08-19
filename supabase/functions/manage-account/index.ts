// supabase/functions/manage-account/index.ts
//
// دروازه‌ی امن مدیریت حساب‌ها (Admin/Employer/Contractor) — فقط Super Admin.
//
// نکته‌ی امنیتی اصلی این تابع: محدودیت «Admin نمی‌تواند حساب Employer/
// Contractor بسازد» اینجا enforce می‌شود، نه فقط با مخفی‌کردن دکمه در UI.
// این تابع claims توکن فراخوان را با امضای واقعی بررسی می‌کند (jwtUtils)؛
// اگر is_super_admin در توکن true نباشد، کل درخواست رد می‌شود — مستقل از
// اینکه کلاینت چه چیزی ادعا کند یا چه دکمه‌ای در UI باشد یا نباشد.
//
// Deploy:
//   supabase functions deploy manage-account

import { getCallerClaims } from "../_shared/jwtUtils.ts";
import { json, CORS_HEADERS, callRpc, restFetch } from "../_shared/supabaseAdmin.ts";

const TABLE_BY_TYPE: Record<string, string> = {
  admin: "employer_accounts",
  employer: "employer_accounts",
  contractor: "contractors",
};

function auditNote(action: string) {
  return `عملیات ${action} — از طریق پنل Super Admin`;
}

async function logAudit(entry: Record<string, unknown>) {
  await restFetch("admin_audit_log", { method: "POST", body: JSON.stringify([entry]), headers: { Prefer: "return=minimal" } }).catch(() => {});
}

// اعتبارسنجی فرمت — دقیقاً همان الگوی استفاده‌شده در فرم‌های دیگر پروژه (PersonnelForm)
function isValidEmailFormat(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidMobileFormat(phone: string) {
  return /^09\d{9}$/.test(phone);
}

// بررسی یکتایی ایمیل/موبایل — در هر دو جدول employer_accounts و contractors
// با هم، چون این‌ها شناسه‌ی شخصی‌اند و نباید در کل سیستم تکراری باشند.
// excludeId برای حالت ویرایش است — رکورد خودش را از بررسی حذف می‌کند.
async function checkContactUniqueness(field: "email" | "phone", value: string, excludeTable: string, excludeId: string | null) {
  const [empRes, conRes] = await Promise.all([
    restFetch(`employer_accounts?${field}=eq.${encodeURIComponent(value)}&select=id`),
    restFetch(`contractors?${field}=eq.${encodeURIComponent(value)}&select=id`),
  ]);
  const empMatches = empRes.ok && Array.isArray(empRes.data) ? empRes.data : [];
  const conMatches = conRes.ok && Array.isArray(conRes.data) ? conRes.data : [];
  const isSelf = (id: string, table: string) => excludeId && table === excludeTable && id === excludeId;
  const conflict = empMatches.some((r: any) => !isSelf(r.id, "employer_accounts")) || conMatches.some((r: any) => !isSelf(r.id, "contractors"));
  return conflict;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const claims = await getCallerClaims(req);
  // ---------- مرز امنیتی اصلی: فقط Super Admin ----------
  if (!claims || claims.is_super_admin !== true) {
    return json({ error: "دسترسی غیرمجاز — این عملیات فقط برای Super Admin مجاز است." }, 403);
  }
  const performedBy = String(claims.username || "super_admin");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
  }

  const action = String(body?.action || "");
  const targetType = String(body?.targetType || "");
  const table = TABLE_BY_TYPE[targetType];
  if (!table) return json({ error: "نوع حساب نامعتبر است" }, 400);

  try {
    // ---------- ایجاد حساب ----------
    if (action === "create") {
      const f = body.fields || {};
      if (!f.name?.trim() || !f.username?.trim() || !f.password) {
        return json({ error: "نام، نام‌کاربری و رمز عبور الزامی است" }, 400);
      }
      if (f.email && !isValidEmailFormat(f.email)) {
        return json({ error: "فرمت ایمیل نامعتبر است" }, 400);
      }
      if (f.phone && !isValidMobileFormat(f.phone)) {
        return json({ error: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود" }, 400);
      }
      if (f.email && await checkContactUniqueness("email", f.email, table, null)) {
        return json({ error: "این ایمیل قبلاً برای حساب دیگری استفاده شده است" }, 409);
      }
      if (f.phone && await checkContactUniqueness("phone", f.phone, table, null)) {
        return json({ error: "این شماره موبایل قبلاً برای حساب دیگری استفاده شده است" }, 409);
      }
      const existing = await restFetch(`${table}?username=eq.${encodeURIComponent(f.username.trim())}&select=id`);
      if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
        return json({ error: "این نام‌کاربری قبلاً استفاده شده است" }, 409);
      }

      const payload: Record<string, unknown> =
        targetType === "contractor"
          ? {
              name: f.name.trim(), username: f.username.trim(), company_id: f.companyId || null,
              job_position_id: f.jobPositionId || null, contact_person_name: f.contactPersonName || "",
              start_date: f.startDate || null, contract_details: f.contractDetails || "",
              phone: f.phone || "", email: f.email || "",
            }
          : {
              name: f.name.trim(), username: f.username.trim(), company_id: f.companyId || null,
              job_position_id: f.jobPositionId || null, role: targetType === "admin" ? "admin" : "employer",
              can_edit: f.canEdit !== false, phone: f.phone || "", email: f.email || "",
            };

      const created = await restFetch(table, { method: "POST", body: JSON.stringify([payload]) });
      if (!created.ok || !Array.isArray(created.data) || created.data.length === 0) {
        return json({ error: "خطا در ایجاد حساب" }, 500);
      }
      const newId = created.data[0].id;
      // رمز عبور را جدا و فقط از طریق تابع هش‌کننده تنظیم می‌کنیم — هرگز
      // متن‌ساده در ستون password ذخیره نمی‌شود
      const hashFn = targetType === "contractor" ? "set_contractor_password" : "set_employer_password";
      await callRpc(hashFn, { p_id: newId, p_new_password: f.password });

      await logAudit({ action: "create_account", target_type: targetType, target_id: newId, target_username: f.username.trim(), performed_by: performedBy, performed_by_role: "super_admin", note: auditNote("ایجاد حساب") });
      return json({ ok: true, id: newId });
    }

    // برای بقیه‌ی عملیات‌ها، targetId الزامی است
    const targetId = String(body?.targetId || "");
    if (!targetId) return json({ error: "شناسه‌ی حساب مقصد الزامی است" }, 400);

    // ---------- ویرایش حساب (بدون رمز عبور — رمز جدا reset می‌شود) ----------
    if (action === "update") {
      const f = body.fields || {};
      if (f.email && !isValidEmailFormat(f.email)) {
        return json({ error: "فرمت ایمیل نامعتبر است" }, 400);
      }
      if (f.phone && !isValidMobileFormat(f.phone)) {
        return json({ error: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود" }, 400);
      }
      if (f.email && await checkContactUniqueness("email", f.email, table, targetId)) {
        return json({ error: "این ایمیل قبلاً برای حساب دیگری استفاده شده است" }, 409);
      }
      if (f.phone && await checkContactUniqueness("phone", f.phone, table, targetId)) {
        return json({ error: "این شماره موبایل قبلاً برای حساب دیگری استفاده شده است" }, 409);
      }
      const payload: Record<string, unknown> = {};
      if ("name" in f) payload.name = f.name;
      if ("companyId" in f) payload.company_id = f.companyId || null;
      if ("jobPositionId" in f) payload.job_position_id = f.jobPositionId || null;
      if ("phone" in f) payload.phone = f.phone || "";
      if ("email" in f) payload.email = f.email || "";
      if (targetType === "contractor") {
        if ("contactPersonName" in f) payload.contact_person_name = f.contactPersonName;
        if ("startDate" in f) payload.start_date = f.startDate || null;
        if ("contractDetails" in f) payload.contract_details = f.contractDetails;
      } else {
        if ("canEdit" in f) payload.can_edit = f.canEdit !== false;
        if (targetType === "admin" || targetType === "employer") payload.role = targetType === "admin" ? "admin" : "employer";
      }
      const updated = await restFetch(`${table}?id=eq.${targetId}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (!updated.ok) return json({ error: "خطا در ویرایش حساب" }, 500);
      await logAudit({ action: "update_account", target_type: targetType, target_id: targetId, performed_by: performedBy, performed_by_role: "super_admin", note: auditNote("ویرایش حساب") });
      return json({ ok: true });
    }

    // ---------- فعال/غیرفعال کردن ----------
    if (action === "deactivate" || action === "reactivate") {
      const active = action === "reactivate";
      const updated = await restFetch(`${table}?id=eq.${targetId}`, { method: "PATCH", body: JSON.stringify({ is_active: active }) });
      if (!updated.ok) return json({ error: "خطا در تغییر وضعیت حساب" }, 500);
      await logAudit({ action: action === "reactivate" ? "reactivate_account" : "deactivate_account", target_type: targetType, target_id: targetId, performed_by: performedBy, performed_by_role: "super_admin", note: auditNote(active ? "فعال‌سازی" : "غیرفعال‌سازی") });
      return json({ ok: true });
    }

    // ---------- Reset Password ----------
    if (action === "reset_password") {
      const newPassword = String(body?.newPassword || "");
      if (newPassword.length < 8) return json({ error: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد" }, 400);
      const hashFn = targetType === "contractor" ? "set_contractor_password" : "set_employer_password";
      const result = await callRpc(hashFn, { p_id: targetId, p_new_password: newPassword });
      if (!result.ok) return json({ error: "خطا در بازنشانی رمز عبور" }, 500);
      // عمداً خودِ رمز عبور جدید هرگز در audit log ثبت نمی‌شود
      await logAudit({ action: "reset_password", target_type: targetType, target_id: targetId, performed_by: performedBy, performed_by_role: "super_admin", note: auditNote("بازنشانی رمز عبور") });
      return json({ ok: true });
    }

    // ---------- حذف حساب ----------
    if (action === "delete") {
      // آدمین/کارفرما توسط هیچ جدول دیگری با شناسه ارجاع نمی‌شوند (فقط
      // متن آزاد created_by/approved_by) — حذفشان همیشه امن است. پیمانکار
      // اما توسط پرسنل/ماشین‌آلات/اقدام اصلاحی با contractor_id واقعی وصل
      // است؛ قبل از حذف باید این وابستگی‌ها بررسی شوند، وگرنه یک خطای
      // مبهم foreign key به کاربر برمی‌گردد.
      if (targetType === "contractor") {
        const [personnelCheck, machineryCheck, correctiveCheck] = await Promise.all([
          restFetch(`personnel?contractor_id=eq.${targetId}&select=id&limit=1`),
          restFetch(`machinery?contractor_id=eq.${targetId}&select=id&limit=1`),
          restFetch(`corrective_actions?responsible_contractor_id=eq.${targetId}&select=id&limit=1`),
        ]);
        const hasPersonnel = personnelCheck.ok && Array.isArray(personnelCheck.data) && personnelCheck.data.length > 0;
        const hasMachinery = machineryCheck.ok && Array.isArray(machineryCheck.data) && machineryCheck.data.length > 0;
        const hasCorrective = correctiveCheck.ok && Array.isArray(correctiveCheck.data) && correctiveCheck.data.length > 0;
        if (hasPersonnel || hasMachinery || hasCorrective) {
          const parts = [];
          if (hasPersonnel) parts.push("پرسنل");
          if (hasMachinery) parts.push("ماشین‌آلات");
          if (hasCorrective) parts.push("اقدام اصلاحی");
          return json({ error: `این پیمانکار هنوز به رکوردهایی در ${parts.join("، ")} وصل است — اول آن‌ها را به پیمانکار دیگری منتقل کنید یا حذف کنید، یا به‌جای حذف، غیرفعالش کنید.` }, 409);
        }
      }

      const deleted = await restFetch(`${table}?id=eq.${targetId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      if (!deleted.ok) return json({ error: "خطا در حذف حساب" }, 500);
      await logAudit({ action: "delete_account", target_type: targetType, target_id: targetId, performed_by: performedBy, performed_by_role: "super_admin", note: auditNote("حذف حساب") });
      return json({ ok: true });
    }

    return json({ error: "action نامعتبر است" }, 400);
  } catch (e) {
    return json({ error: "خطای داخلی: " + String((e as Error)?.message || e) }, 500);
  }
});
