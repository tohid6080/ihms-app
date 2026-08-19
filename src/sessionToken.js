// عمداً این دو مقدار مستقیم اینجا تکرار شده‌اند، نه import از shared.js —
// چون shared.js خودش این فایل را import می‌کند (برای getSessionToken داخل
// sb())، و وارد کردن متقابل باعث وابستگی دایره‌ای بین دو ماژول می‌شد.
const SUPABASE_URL = "https://zmmxiyqlwkqjzghbcydi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pvobGcp2snOD3oFTX2LVMg_bZx2A9CR";

/**
 * این ماژول توکن نشست را می‌گیرد، نگه می‌دارد، و در دسترس sb() قرار
 * می‌دهد. از وقتی احراز هویت به‌طور کامل به Edge Function منتقل شد
 * (رفع نشتی رمزهای متنی که قبلاً در attemptCredentialLogin سمت کلاینت
 * می‌رفت)، issueSessionToken دیگر یک «بهبود اختیاری پس‌زمینه» نیست — مسیر
 * اصلی و تنها مسیر تأیید اعتبار ورود است.
 *
 * نکته‌ی مهم: توکن مشتری (کارفرما/ادمین/پیمانکار) و توکن Super Admin در دو
 * جای کاملاً جدا نگه داشته می‌شوند — قبلاً یک جای مشترک بودند، و اگر در
 * همان مرورگر هم ورود مشتری تست می‌شد هم ورود Super Admin، دومی می‌توانست
 * اولی را بی‌سروصدا جایگزین کند (یا برعکس) و باعث خطای «دسترسی غیرمجاز» شود.
 */

const STORAGE_KEY_CUSTOMER = "ihms_session_token";
const STORAGE_KEY_SUPER_ADMIN = "ihms_super_admin_session_token";

let cachedTokens = { customer: null, super_admin: null };

function keyFor(scope) {
  return scope === "super_admin" ? STORAGE_KEY_SUPER_ADMIN : STORAGE_KEY_CUSTOMER;
}

function decodeExp(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp || null;
  } catch {
    return null;
  }
}

export function getSessionToken(scope = "customer") {
  if (cachedTokens[scope]) return cachedTokens[scope];
  try {
    const storageKey = keyFor(scope);
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    const exp = decodeExp(stored);
    if (exp && exp * 1000 < Date.now()) {
      localStorage.removeItem(storageKey);
      return null;
    }
    cachedTokens[scope] = stored;
    return stored;
  } catch {
    return null;
  }
}

function storeToken(token, scope) {
  cachedTokens[scope] = token;
  try { localStorage.setItem(keyFor(scope), token); } catch { /* بی‌اهمیت — فقط یعنی بین رفرش‌ها حفظ نمی‌شود */ }
}

export function clearSessionToken(scope = "customer") {
  cachedTokens[scope] = null;
  try { localStorage.removeItem(keyFor(scope)); } catch { /* بی‌اهمیت */ }
}

// درخواست ورود واقعی — رمز عبور کاملاً سمت سرور (Edge Function، با
// service_role و توابع verify_* بر پایه‌ی pgcrypto) بررسی می‌شود؛ هرگز هیچ
// رمز خام یا هش‌شده‌ای به مرورگر برنمی‌گردد. نتیجه شامل توکن امضاشده و
// پروفایل پاک‌سازی‌شده‌ی کاربر (بدون رمز) است.
export async function issueSessionToken(username, password, loginType = "customer") {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/issue-session-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ username, password, loginType }),
    });
    const data = await res.json();
    if (!res.ok || !data?.token) return { error: true, message: data?.error || "نام کاربری یا رمز عبور اشتباه است" };
    storeToken(data.token, loginType === "super_admin" ? "super_admin" : "customer");
    return { token: data.token, user: data.user || null };
  } catch (e) {
    return { error: true, message: "خطا در برقراری ارتباط با سرور احراز هویت" };
  }
}

// تغییر رمز عبور شخصی کاربر لاگین‌شده (Admin یا Super Admin) — نیازمند
// دانستن رمز فعلی؛ تأیید و تنظیم رمز جدید هر دو کاملاً سمت سرور انجام می‌شود.
export async function changeMyPassword(oldPassword, newPassword, scope = "customer") {
  const token = getSessionToken(scope);
  if (!token) return { error: true, message: "نشست نامعتبر است — لطفاً دوباره وارد شوید." };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) return { error: true, message: data?.error || "خطا در تغییر رمز عبور" };
    return { ok: true };
  } catch {
    return { error: true, message: "خطا در برقراری ارتباط با سرور" };
  }
}
