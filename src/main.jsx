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
`;
document.head.appendChild(baseStyle);

if ("serviceWorker" in navigator) {
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
