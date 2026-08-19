// supabase/functions/change-password/index.ts
//
// تغییر رمز عبور شخصی — برای Admin یا Super Admin، هرکدام فقط برای حساب
// خودشان (شناسه‌ی هدف از خودِ claims امن توکن گرفته می‌شود، نه از چیزی که
// کلاینت در بدنه‌ی درخواست بفرستد — تا کسی نتواند با این مسیر رمز شخص
// دیگری را عوض کند). نیازمند دانستن رمز عبور فعلی است؛ برای Reset رمز یک
// Admin توسط Super Admin بدون دانستن رمز فعلی، از manage-account استفاده می‌شود.
//
// Deploy:
//   supabase functions deploy change-password

import { getCallerClaims } from "../_shared/jwtUtils.ts";
import { json, CORS_HEADERS, callRpc, restFetch } from "../_shared/supabaseAdmin.ts";

async function logAudit(entry: Record<string, unknown>) {
  await restFetch("admin_audit_log", { method: "POST", body: JSON.stringify([entry]), headers: { Prefer: "return=minimal" } }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const claims = await getCallerClaims(req);
  if (!claims) return json({ error: "نشست نامعتبر است — لطفاً دوباره وارد شوید." }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
  }

  const oldPassword = String(body?.oldPassword || "");
  const newPassword = String(body?.newPassword || "");
  if (!oldPassword || !newPassword) return json({ error: "رمز فعلی و رمز جدید هر دو الزامی است" }, 400);
  if (newPassword.length < 8) return json({ error: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد" }, 400);

  const username = String(claims.username || "");
  const isSuperAdmin = claims.is_super_admin === true;

  try {
    if (isSuperAdmin) {
      const verify = await callRpc("verify_super_admin_password", { p_username: username, p_password: oldPassword });
      const match = verify.ok && Array.isArray(verify.data) && verify.data.length > 0 ? verify.data[0] : null;
      if (!match) return json({ error: "رمز عبور فعلی اشتباه است" }, 401);
      await callRpc("set_super_admin_password", { p_id: match.id, p_new_password: newPassword });
      await logAudit({ action: "change_own_password", target_type: "super_admin", target_id: match.id, target_username: username, performed_by: username, performed_by_role: "super_admin" });
      return json({ ok: true });
    }

    // ادمین/کارفرما — هر دو در employer_accounts هستند
    const verify = await callRpc("verify_employer_password", { p_username: username, p_password: oldPassword });
    const match = verify.ok && Array.isArray(verify.data) && verify.data.length > 0 ? verify.data[0] : null;
    if (!match) return json({ error: "رمز عبور فعلی اشتباه است" }, 401);
    await callRpc("set_employer_password", { p_id: match.id, p_new_password: newPassword });
    await logAudit({ action: "change_own_password", target_type: match.role === "admin" ? "admin" : "employer", target_id: match.id, target_username: username, performed_by: username, performed_by_role: match.role === "admin" ? "admin" : "employer" });
    return json({ ok: true });
  } catch (e) {
    return json({ error: "خطای داخلی: " + String((e as Error)?.message || e) }, 500);
  }
});
