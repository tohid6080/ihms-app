import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// این استایل قبلاً یک <style> درون‌خطی در index.html بود. تزریقش از طریق
// جاوااسکریپت (به‌جای HTML) باگ شناخته‌شده‌ی Vite روی ویندوز را دور می‌زند:
// وقتی مسیر پروژه بین حروف بزرگ/کوچک درایو ناسازگار باشد (مثلاً D:/Projects
// در Explorer در برابر d:/projects که Vite داخلی می‌بیند)، پلاگین
// html-inline-proxy در resolve کردن ماژول مجازی <style> شکست می‌خورد.
const baseStyle = document.createElement("style");
baseStyle.textContent = "* { box-sizing: border-box; } body { margin: 0; -webkit-font-smoothing: antialiased; }";
document.head.appendChild(baseStyle);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// ---------- Google Analytics 4 ----------
// فقط اگر VITE_GA4_MEASUREMENT_ID در .env تنظیم شده باشد فعال می‌شود؛ این
// اسکریپت فقط داده ارسال می‌کند (بازدید صفحه/رویداد) — نمایش آمار واقعی
// (کشورها، منابع، Realtime و ...) از طریق پنل ادمین → آنالیتیکس و
// Edge Function جداگانه‌ی ga4-analytics انجام می‌شود، نه از اینجا، چون
// خواندن آمار به کلید سرویس‌اکانت نیاز دارد که هرگز نباید در مرورگر باشد.
const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID;
if (GA4_ID) {
  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", GA4_ID);
  window.gtag = gtag;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
