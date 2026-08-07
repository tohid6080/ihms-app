import React, { createContext, useContext, useState, useCallback } from "react";
import { translate } from "./translations.js";

const LanguageContext = createContext(null);

const STORAGE_KEY = "ihms_lang";

function readStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" ? "en" : "fa";
  } catch {
    return "fa";
  }
}

/**
 * فاز ۱: این Provider فقط زبان صفحه‌ی ورود، هدر، و پروفایل/تنظیمات را
 * کنترل می‌کند — بقیه‌ی سامانه فعلاً همیشه فارسی می‌ماند. دلیل اینکه این
 * Context در سطح کل اپ قرار گرفته (نه فقط دور این سه بخش)، این است که در
 * فازهای بعد، بقیه‌ی ماژول‌ها هم بتوانند بدون تغییر ساختار، به همین یک
 * منبع وصل شوند.
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang);

  const setLang = useCallback((next) => {
    const value = next === "en" ? "en" : "fa";
    setLangState(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* بی‌اهمیت */ }
  }, []);

  const t = useCallback((key) => translate(lang, key), [lang]);
  const dir = lang === "en" ? "ltr" : "rtl";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage باید داخل LanguageProvider استفاده شود");
  return ctx;
}
