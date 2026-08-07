import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

// حداقل زمانی که Splash Screen باید دیده شود — طبق خواسته حدود ۳ ثانیه.
// چون capacitor.config.json با launchAutoHide:false تنظیم شده، Splash تا
// وقتی این تابع صدا زده نشود، خودش را مخفی نمی‌کند — یعنی این عدد دقیقاً
// همان مدت‌زمان واقعی نمایش است، نه یک تخمین.
const MIN_DISPLAY_MS = 3000;
const appStartTime = Date.now();

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
