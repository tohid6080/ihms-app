import React, { createContext, useContext } from "react";

const AppearanceContext = createContext(null);

/**
 * تنظیمات ظاهری (نام سامانه، لوگو، رنگ سازمانی و...) را در دسترس هر
 * کامپوننتی در درخت اپ اصلی مشتری می‌گذارد — عمداً فقط دور AppInner قرار
 * می‌گیرد، نه دور کل App، چون پنل Super Admin و صفحه‌ی عمومی پرسشنامه‌ی
 * HSE Climate هویت بصری مستقل خودشان را دارند و نباید این تنظیمات را بگیرند.
 * config===null یعنی هنوز از دیتابیس بارگذاری نشده — همه‌ی مصرف‌کننده‌ها
 * باید مقدار پیش‌فرض/fallback خودشان را برای این حالت داشته باشند.
 */
export function AppearanceProvider({ config, children }) {
  return <AppearanceContext.Provider value={config}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext); // ممکن است null باشد؛ عمداً throw نمی‌کند تا مصرف‌کننده خودش fallback بدهد
}
