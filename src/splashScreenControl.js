import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

// حداقل زمانی که Splash Screen باید دیده شود — طبق خواسته حدود ۳ ثانیه.
const MIN_DISPLAY_MS = 3000;
const appStartTime = Date.now();

// launchAutoHide:false در تنظیمات، در برخی نسخه‌ها/دستگاه‌های اندروید یک
// باگ شناخته‌شده و قدیمی خودِ پلاگین Capacitor است — یعنی گاهی نادیده
// گرفته می‌شود و splash طبق مقدار پیش‌فرض (~۵۰۰ میلی‌ثانیه) خودش را مخفی
// می‌کند، مستقل از تنظیمات ما. راهکار مستندشده‌ی خودِ Capacitor برای این
// مشکل: علاوه بر تنظیمات فایل کانفیگ، صریحاً هم از طریق کد یک‌بار
// SplashScreen.show({ autoHide: false }) صدا زده شود تا مطمئن شویم واقعاً
// تا فراخوانی صریح hide() باز می‌ماند.
if (Capacitor.isNativePlatform()) {
  SplashScreen.show({ autoHide: false }).catch(() => {});
}

// این تابع باید یک‌بار، از نقطه‌ی راه‌اندازی اپ (main.jsx) صدا زده شود —
// کاملاً مستقل از صفحه‌ی ورود یا احراز هویت؛ فقط منتظر می‌ماند تا هم
// حداقل‌زمان نمایش سپری شود و هم اولین صفحه‌ی وب (که همان Login خواهد
// بود) واقعاً رندر و روی صفحه نقاشی شده باشد، بعد با یک محو شدن نرم
// Splash را کنار می‌زند.
export async function hideSplashWhenReady() {
  if (!Capacitor.isNativePlatform()) return; // در مرورگر وب، Splash بومی اصلاً وجود ندارد

  // دو requestAnimationFrame پشت‌سرهم، تضمین می‌کند که مرورگر واقعاً یک
  // فریم را نقاشی کرده — یعنی صفحه‌ی ورود پیش از کنارزدن Splash، از قبل
  // پشت آن آماده و قابل‌مشاهده است (بدون یک لحظه صفحه‌ی سفید خالی).
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const elapsed = Date.now() - appStartTime;
  const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));

  try {
    await SplashScreen.hide({ fadeOutDuration: 400 });
  } catch {
    // اگر پلاگین به هر دلیلی در دسترس نبود، برنامه نباید متوقف بماند
  }
}
