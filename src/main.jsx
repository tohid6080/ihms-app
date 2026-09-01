import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { hideSplashWhenReady } from "./splashScreenControl.js";

// این استایل قبلاً یک <style> درون‌خطی در index.html بود. تزریقش از طریق
// جاوااسکریپت (به‌جای HTML) باگ شناخته‌شده‌ی Vite روی ویندوز را دور می‌زند:
// وقتی مسیر پروژه بین حروف بزرگ/کوچک درایو ناسازگار باشد (مثلاً D:/Projects
// در Explorer در برابر d:/projects که Vite داخلی می‌بیند)، پلاگین
// html-inline-proxy در resolve کردن ماژول مجازی <style> شکست می‌خورد.
const baseStyle = document.createElement("style");
baseStyle.textContent = `
  * { box-sizing: border-box; }
  html, body { margin: 0; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  #root { min-height: 100vh; }
  img { max-width: 100%; }
  input, select, textarea, button { max-width: 100%; }
  :root {
    /* مقادیر پیش‌فرض تنظیمات ظاهری — دقیقاً همان مقادیر قبلی ثابت THEME؛
       بعد از بارگذاری از دیتابیس (systemConfigApi.js::applyAppearanceToDom)،
       این مقادیر override می‌شوند. تا آن لحظه، ظاهر سامانه بدون کوچک‌ترین
       تغییری همان قبلی است. */
    --ihms-navy: #0e2a3f;
    --ihms-teal: #0d8f8a;
    --ihms-bg: #f2f5f8;
    --ihms-surface: #ffffff;
    --ihms-border: #e3e8ee;
    --ihms-border-strong: #cbd5e1;
    --ihms-text: #152535;
    --ihms-text2: #5b6b7d;
    --ihms-text3: #93a1b0;
    --ihms-font: 'Vazirmatn', 'Inter', Tahoma, Arial, sans-serif;
  }
`;
document.head.appendChild(baseStyle);

<<<<<<< HEAD
if ("serviceWorker" in navigator) {
=======
// طبق یک باگ واقعی که گزارش شد: Service Worker قبلاً بدون قید و شرط
// حتی در npm run dev هم ثبت می‌شد — که باعث می‌شد کاربر با وجود
// build مجدد و Hard Refresh، هنوز محتوای کش‌شده‌ی قدیمی ببیند (چون
// Service Worker با Hot Module Reload خودِ Vite تداخل می‌کند). الان
// فقط در نسخه‌ی نهایی واقعی (Production build) ثبت می‌شود —
// import.meta.env.PROD مقداری است که خودِ Vite در npm run build
// روی true تنظیم می‌کند، نه در npm run dev.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
>>>>>>> 62c9c73 (Upload project files)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// بعد از رندر اولیه‌ی اپ (که همان صفحه‌ی ورود خواهد بود، مگر نشستی از
// قبل ذخیره شده باشد)، Splash Screen بومی را با یک محو شدن نرم کنار
// می‌زند. این تابع کاملاً مستقل از هر منطق Login/احراز هویتی است.
hideSplashWhenReady();
