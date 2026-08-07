import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

/**
 * لایه‌ی بیومتریک — کاملاً مستقل از ماژول‌های دیگر IHMS.
 *
 * چون IHMS از Supabase Auth استفاده نمی‌کند (ورود، تطبیق مستقیم نام‌کاربری/
 * رمزعبور با ردیف‌های employer_accounts/contractors است، بدون توکن نشست)،
 * «Secure Storage» اینجا یعنی: پس از یک تأیید بیومتریک واقعی و موفق، همان
 * نام‌کاربری/رمزعبور از Keystore امن اندروید (یا Keychain در iOS) بازیابی
 * و به همان تابع واقعی اعتبارسنجی ورود (attemptCredentialLogin در App.jsx)
 * داده می‌شود — یعنی ورود بیومتریک هم از همان مسیر واقعی رد می‌شود، نه یک
 * میان‌بر جدا و ناامن.
 *
 * خودِ اثر انگشت/چهره هرگز به این اپ یا دیتابیس نمی‌رسد — کاملاً در سطح
 * سیستم‌عامل و Android Biometric API می‌ماند؛ ما فقط نتیجه‌ی «تأییدشد/
 * نشد» را از پلاگین می‌گیریم.
 */

const BIOMETRIC_SERVER_KEY = "ihms-app-biometric-login";
const ENABLED_FLAG_KEY = "ihms_biometric_enabled_username";

function isNative() {
  return Capacitor.isNativePlatform();
}

// آیا سخت‌افزار بیومتریک روی این دستگاه موجود است و حداقل یک اثر انگشت/چهره ثبت شده؟
export async function isBiometricAvailable() {
  if (!isNative()) return { available: false, reason: "not_native" };
  try {
    const result = await NativeBiometric.isAvailable();
    if (!result?.isAvailable) return { available: false, reason: "not_available" };
    return { available: true, biometryType: result.biometryType };
  } catch (e) {
    return { available: false, reason: "error", message: String(e?.message || e) };
  }
}

// همین الان روی این دستگاه، ورود بیومتریک برای کدام حساب فعال است؟ (هر
// دستگاه فقط یک حساب هم‌زمان — دقیقاً هم‌سو با اینکه currentUser هم فقط
// یک نشست هم‌زمان نگه می‌دارد)
export function getBiometricEnabledUsername() {
  try {
    return localStorage.getItem(ENABLED_FLAG_KEY) || null;
  } catch {
    return null;
  }
}

export function isBiometricEnabledFor(username) {
  return !!username && getBiometricEnabledUsername() === username;
}

// فعال‌سازی از پروفایل: اول یک تأیید بیومتریک واقعی می‌گیرد (تا مطمئن شویم
// واقعاً کار می‌کند، نه اینکه صرفاً یک تیک زده باشیم)، بعد نام‌کاربری/
// رمزعبور فعلی را در Keystore امن ذخیره می‌کند.
export async function enableBiometricLogin(username, password) {
  if (!isNative()) return { __error: true, message: "این قابلیت فقط داخل اپلیکیشن نصب‌شده روی گوشی در دسترس است، نه در مرورگر وب." };
  if (!username || !password) return { __error: true, message: "اطلاعات ورود فعلی در دسترس نیست." };

  const avail = await isBiometricAvailable();
  if (!avail.available) {
    return {
      __error: true,
      message: avail.reason === "not_available"
        ? "این دستگاه از احراز هویت بیومتریک پشتیبانی نمی‌کند یا هیچ اثر انگشت/چهره‌ای روی آن ثبت نشده است."
        : "خطا در بررسی سخت‌افزار بیومتریک این دستگاه.",
    };
  }

  try {
    await NativeBiometric.verifyIdentity({
      reason: "برای فعال‌سازی ورود با اثر انگشت",
      title: "تأیید هویت",
      subtitle: "برای فعال‌سازی ورود سریع",
      description: "لطفاً اثر انگشت یا چهره‌ی خود را تأیید کنید",
    });
  } catch {
    return { __error: true, message: "تأیید بیومتریک لغو شد یا انجام نشد — ورود سریع فعال نشد." };
  }

  try {
    await NativeBiometric.setCredentials({ username, password, server: BIOMETRIC_SERVER_KEY });
    localStorage.setItem(ENABLED_FLAG_KEY, username);
    return { ok: true };
  } catch (e) {
    return { __error: true, message: "خطا در ذخیره‌ی امن اطلاعات ورود: " + String(e?.message || e) };
  }
}

// غیرفعال‌سازی دستی (از پروفایل) — اعتبارنامه را کامل از Keystore حذف می‌کند
export async function disableBiometricLogin() {
  try {
    if (isNative()) await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_KEY });
  } catch {
    // اگر از قبل چیزی ذخیره نشده بود یا پلتفرم در دسترس نبود، بی‌اهمیت است
  }
  try { localStorage.removeItem(ENABLED_FLAG_KEY); } catch { /* بی‌اهمیت */ }
}

// همان تابع را خروج کامل هم صدا می‌زند — طبق الزام صریح، Logout باید
// اعتبار ورود بیومتریک را باطل کند، نه فقط نشست جاری را پاک کند.
export const invalidateBiometricOnLogout = disableBiometricLogin;

// گیت ورود بیومتریک: یک تأیید واقعی می‌گیرد؛ در صورت موفقیت، اعتبارنامه‌ی
// ذخیره‌شده را برمی‌گرداند تا فراخوان (BiometricGateScreen در App.jsx)
// همان را به attemptCredentialLogin واقعی بدهد.
export async function verifyBiometricAndGetCredentials() {
  if (!isNative()) return { __error: true, message: "not_native" };
  try {
    await NativeBiometric.verifyIdentity({
      reason: "برای ورود به سامانه",
      title: "ورود با اثر انگشت",
      subtitle: "IHMS",
      description: "لطفاً اثر انگشت یا چهره‌ی خود را تأیید کنید",
    });
  } catch (e) {
    // شامل: رد مجوز، لغو توسط کاربر، خطای سخت‌افزاری، قفل‌شدن موقت بعد از چند تلاش ناموفق
    return { __error: true, cancelled: true, message: "تأیید بیومتریک لغو شد یا ناموفق بود." };
  }
  try {
    const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER_KEY });
    if (!creds?.username || !creds?.password) return { __error: true, message: "اطلاعات ورود ذخیره‌شده یافت نشد." };
    return { username: creds.username, password: creds.password };
  } catch (e) {
    return { __error: true, message: "خطا در بازیابی امن اطلاعات ورود." };
  }
}
