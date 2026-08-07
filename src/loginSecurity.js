import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./shared.js";

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordLength(password) {
  return (password || "").length >= MIN_PASSWORD_LENGTH;
}

async function callLoginAttemptFn(action, username, extra = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/check-login-attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action, username, ...extra }),
    });
    return await res.json();
  } catch {
    // اگر خودِ سرویس محدودیت تلاش در دسترس نبود (مثلاً هنوز deploy نشده یا
    // قطعی شبکه)، عمداً «باز» می‌مانیم نه «بسته» — یعنی نبودِ این لایه‌ی
    // اضافه نباید کل امکان ورود را برای همه مسدود کند.
    return { locked: false, __unreachable: true };
  }
}

// آیا همین الان این نام‌کاربری، به‌خاطر تلاش‌های ناموفق اخیر، قفل است؟
export async function checkLoginLockout(username) {
  return callLoginAttemptFn("check", (username || "").trim().toLowerCase());
}

// نتیجه‌ی واقعی تلاش ورود (موفق/ناموفق) را برای شمارنده‌ی سمت سرور ثبت می‌کند
export async function recordLoginAttempt(username, success) {
  return callLoginAttemptFn("record", (username || "").trim().toLowerCase(), { success: !!success });
}
