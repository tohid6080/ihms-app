// دیکشنری مرکزی ترجمه. هر فاز بعدی، کلیدهای مربوط به ماژول خودش را همین‌جا
// اضافه می‌کند — ساختار یکسان می‌ماند: { fa: "...", en: "..." }.
export const translations = {
  // ---------- عمومی ----------
  language: { fa: "زبان", en: "Language" },
  persian: { fa: "فارسی", en: "Persian" },
  english: { fa: "English", en: "English" },

  // ---------- صفحه‌ی ورود ----------
  loginTagline: { fa: "ورود به سامانه مدیریت یکپارچه ایمنی، بهداشت و محیط‌زیست", en: "Sign in to the Integrated HSE Management System" },
  username: { fa: "نام کاربری", en: "Username" },
  password: { fa: "رمز عبور", en: "Password" },
  loginButton: { fa: "ورود", en: "Login" },
  loggingIn: { fa: "در حال بررسی...", en: "Signing in..." },
  invalidCredentials: { fa: "نام کاربری یا رمز عبور اشتباه است", en: "Invalid username or password" },
  designedBy: { fa: "Designed by: Tohid Mirasadi", en: "Designed by: Tohid Mirasadi" },

  // ---------- هدر ----------
  panelAdmin: { fa: "پنل ادمین", en: "Admin Panel" },
  panelEmployer: { fa: "پنل کارفرما", en: "Employer Panel" },
  panelEmployerViewOnly: { fa: "پنل کارفرما (فقط مشاهده)", en: "Employer Panel (View Only)" },
  panelContractor: { fa: "پنل پیمانکار", en: "Contractor Panel" },
  logout: { fa: "خروج", en: "Logout" },
  settingsTooltip: { fa: "تنظیمات", en: "Settings" },

  // ---------- پروفایل / تنظیمات ----------
  backToMenu: { fa: "← بازگشت به منو", en: "← Back to Menu" },
  orgInfoTitle: { fa: "اطلاعات سازمانی (فقط ادمین تغییر می‌دهد)", en: "Organization Info (Admin-managed)" },
  fullName: { fa: "نام و نام خانوادگی", en: "Full Name" },
  companyLabel: { fa: "شرکت", en: "Company" },
  contractorLabel: { fa: "پیمانکار", en: "Contractor" },
  jobTitle: { fa: "سمت سازمانی", en: "Job Title" },
  userRole: { fa: "نقش کاربری", en: "User Role" },
  joinDate: { fa: "تاریخ عضویت", en: "Join Date" },
  lastLogin: { fa: "آخرین ورود قبلی", en: "Previous Login" },
  firstLogin: { fa: "اولین ورود شماست", en: "This is your first login" },
  contactInfoTitle: { fa: "اطلاعات تماس (قابل ویرایش توسط شما)", en: "Contact Info (Editable by You)" },
  mobileNumber: { fa: "شماره موبایل", en: "Mobile Number" },
  orgEmail: { fa: "ایمیل سازمانی", en: "Organization Email" },
  saveChanges: { fa: "ذخیره‌ی تغییرات", en: "Save Changes" },
  saving: { fa: "در حال ذخیره...", en: "Saving..." },
  savedConfirm: { fa: "ذخیره شد.", en: "Saved." },
  systemLanguage: { fa: "زبان سامانه", en: "System Language" },
};

export function translate(lang, key) {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.fa || key;
}
