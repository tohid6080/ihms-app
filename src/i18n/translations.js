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

  // ---------- فاز ۲: منوی اصلی و زیرماژول‌ها ----------
  moduleChat: { fa: "چت", en: "Chat" },
  moduleArchive: { fa: "آرشیو فایل‌ها", en: "File Archive" },
  moduleAnomalyReport: { fa: "مدیریت عدم انطباق‌ها (Anomaly Report)", en: "Non-Conformance Management (Anomaly Report)" },
  subAnomalyForm: { fa: "ثبت آنومالی", en: "Report Anomaly" },
  subAnomalyList: { fa: "لیست آنومالی‌ها", en: "Anomaly List" },
  moduleRiskAssessment: { fa: "مدیریت ارزیابی ریسک (Risk Assessment)", en: "Risk Assessment Management" },
  subBowtie: { fa: "BowTie Risk Analysis", en: "BowTie Risk Analysis" },
  subHcms: { fa: "HCMS - سیستم مدیریت و کنترل خطرات", en: "HCMS - Hazard Control Management System" },
  subRiskKnowledge: { fa: "بانک اطلاعاتی ارزیابی ریسک", en: "Risk Assessment Knowledge Base" },
  modulePersonnelAccess: { fa: "مدیریت ورود و تردد پرسنل", en: "Personnel Access Management" },
  subPersonnelList: { fa: "لیست پرسنل", en: "Personnel List" },
  subPersonnelForm: { fa: "ثبت پرسنل جدید", en: "Register New Personnel" },
  moduleMachinery: { fa: "مدیریت ماشین‌آلات و تجهیزات", en: "Machinery & Equipment Management" },
  subMachineryList: { fa: "لیست ماشین‌آلات", en: "Machinery List" },
  moduleScaffold: { fa: "مدیریت داربست", en: "Scaffolding Management" },
  subScaffoldList: { fa: "لیست تگ داربست", en: "Scaffold Tag List" },
  moduleManagementDashboard: { fa: "داشبورد مدیریتی و گزارش‌های تحلیلی", en: "Management Dashboard & Analytics" },

  // ---------- فاز ۲: مدیریت سیستم (منوی ادمین) ----------
  moduleAdminAnalytics: { fa: "داشبورد فعالیت کاربران", en: "User Activity Dashboard" },
  moduleSystemManagement: { fa: "مدیریت سیستم", en: "System Management" },
  subEmployerAccounts: { fa: "مدیریت حساب‌های کارفرما/همکاران", en: "Employer/Colleague Accounts" },
  subContractors: { fa: "مدیریت پیمانکاران", en: "Contractor Management" },
  subPermissions: { fa: "مدیریت نقش‌ها و دسترسی‌ها", en: "Roles & Permissions" },
  subJobPositions: { fa: "مدیریت عناوین شغلی", en: "Job Positions" },
  subScaffoldCodes: { fa: "کد تگ داربست پیمانکاران", en: "Contractor Scaffold Tag Codes" },
  subTraining: { fa: "مدیریت آموزش‌های تخصصی", en: "Specialized Training Management" },
  subChatAccess: { fa: "مدیریت دسترسی چت", en: "Chat Access Management" },
  subHcmsMatrix: { fa: "ماتریس ریسک HCMS", en: "HCMS Risk Matrix" },
  subAnomalyCategories: { fa: "دسته‌بندی‌های آنومالی", en: "Anomaly Categories" },

  // ---------- فاز ۲: داشبورد مدیریتی اصلی ----------
  dashboardTitle: { fa: "داشبورد مدیریتی IHMS", en: "IHMS Management Dashboard" },
  dashboardBack: { fa: "← بازگشت", en: "← Back" },
  dashboardAllContractorsOverview: { fa: "نمای کلی همه‌ی پیمانکاران", en: "Overview of All Contractors" },
  kpiContractors: { fa: "پیمانکاران", en: "Contractors" },
  kpiActivePersonnel: { fa: "پرسنل فعال", en: "Active Personnel" },
  kpiOpenAnomalies: { fa: "آنومالی باز", en: "Open Anomalies" },
  kpiCritical: { fa: "بحرانی", en: "Critical" },
  kpiActiveMachinery: { fa: "ماشین‌آلات فعال", en: "Active Machinery" },
  kpiActiveScaffold: { fa: "داربست فعال", en: "Active Scaffolding" },
  kpiBowtie: { fa: "BowTie", en: "BowTie" },
  kpiPendingApproval: { fa: "در انتظار تأیید", en: "Pending Approval" },
  kpiImportantNotifications: { fa: "اعلان مهم", en: "Important Notifications" },
  panelContractorHse: { fa: "وضعیت HSE پیمانکاران", en: "Contractor HSE Status" },
  colContractor: { fa: "پیمانکار", en: "Contractor" },
  colScore: { fa: "امتیاز", en: "Score" },
  colOpenAnomalies: { fa: "آنومالی باز", en: "Open Anomalies" },
  colNeedsHealthVisit: { fa: "نیازمند طب کار", en: "Needs Health Visit" },
  colFaultyMachinery: { fa: "ماشین ناقص", en: "Faulty Machinery" },
  colScaffoldNeedsVisit: { fa: "داربست نیازمند بازدید", en: "Scaffold Needs Inspection" },
  colStatus: { fa: "وضعیت", en: "Status" },
  noContractorsRegistered: { fa: "پیمانکاری ثبت نشده است", en: "No contractors registered" },
  panelUrgentAlerts: { fa: "هشدارهای فوری", en: "Urgent Alerts" },
  noUrgentAlerts: { fa: "هشدار فوری فعالی وجود ندارد.", en: "No active urgent alerts." },
  panelSmartInsights: { fa: "تحلیل هوشمند", en: "Smart Insights" },
  noSmartInsights: { fa: "داده‌ی کافی برای تحلیل وجود ندارد.", en: "Not enough data for analysis." },
  panelAnomalyTrend: { fa: "روند آنومالی (۶ ماه اخیر)", en: "Anomaly Trend (Last 6 Months)" },
  panelHealthStatus: { fa: "وضعیت طب کار", en: "Occupational Health Status" },
  panelMachineryStatus: { fa: "وضعیت ماشین‌آلات", en: "Machinery Status" },
  panelAnomalyByRisk: { fa: "آنومالی بر اساس ریسک", en: "Anomalies by Risk Level" },
  panelContractorPerformance: { fa: "امتیاز عملکرد پیمانکاران", en: "Contractor Performance Score" },
  noChartData: { fa: "داده‌ای موجود نیست", en: "No data available" },
  roleLabelAdmin: { fa: "ادمین", en: "Admin" },
  roleLabelEmployer: { fa: "کارفرما", en: "Employer" },
  roleLabelContractor: { fa: "پیمانکار", en: "Contractor" },
  roleLabelEmployerViewOnly: { fa: "کارفرما (فقط مشاهده)", en: "Employer (View Only)" },

  // ---------- فاز ۲: برچسب‌های نمودار دونات ----------
  chartActive: { fa: "فعال", en: "Active" },
  chartNeedsVisit: { fa: "نیازمند مراجعه", en: "Needs Visit" },
  chartExpired: { fa: "منقضی", en: "Expired" },
  chartApproved: { fa: "تأییدشده", en: "Approved" },
  chartPending: { fa: "در انتظار", en: "Pending" },
  chartNeedsCorrection: { fa: "نیاز به اصلاح/رد", en: "Needs Correction/Rejected" },
  chartHigh: { fa: "بالا", en: "High" },
  chartMed: { fa: "متوسط", en: "Medium" },
  chartLow: { fa: "پایین", en: "Low" },
  loadingDashboard: { fa: "در حال بارگذاری داشبورد...", en: "Loading dashboard..." },

  // ---------- ورود با اثر انگشت (Biometric Login) ----------
  securitySectionTitle: { fa: "امنیت", en: "Security" },
  biometricToggleLabel: { fa: "ورود با اثر انگشت", en: "Fingerprint Login" },
  biometricEnabledHint: { fa: "فعال — دفعه‌ی بعد می‌توانید با اثر انگشت یا چهره وارد شوید", en: "Enabled — next time you can sign in with fingerprint or face" },
  biometricDisabledHint: { fa: "غیرفعال — برای فعال‌سازی دکمه را بزنید", en: "Disabled — tap to enable" },
  biometricEnabling: { fa: "در حال فعال‌سازی...", en: "Enabling..." },
  biometricDisabling: { fa: "در حال غیرفعال‌سازی...", en: "Disabling..." },
  biometricNativeOnly: { fa: "این قابلیت فقط داخل اپلیکیشن نصب‌شده روی گوشی در دسترس است.", en: "This feature is only available inside the installed mobile app." },
  biometricGateChecking: { fa: "در حال بررسی اثر انگشت...", en: "Checking fingerprint..." },
  biometricGateWaiting: { fa: "منتظر تأیید بیومتریک...", en: "Waiting for biometric confirmation..." },
  biometricRetry: { fa: "تلاش دوباره", en: "Try Again" },
  biometricUsePassword: { fa: "ورود با رمز عبور", en: "Sign In With Password" },
  biometricStaleCredentials: { fa: "اعتبار ورود ذخیره‌شده دیگر معتبر نیست — لطفاً با رمز عبور وارد شوید.", en: "Saved sign-in is no longer valid — please sign in with your password." },

  // ---------- امنیت ورود ----------
  accountTemporarilyLocked: { fa: "به‌دلیل تلاش‌های ناموفق مکرر، امکان ورود موقتاً مسدود شده است. لطفاً چند دقیقه‌ی دیگر دوباره امتحان کنید.", en: "Due to repeated failed attempts, sign-in is temporarily locked. Please try again in a few minutes." },
  passwordTooShort: { fa: "رمز عبور باید حداقل ۸ کاراکتر باشد.", en: "Password must be at least 8 characters." },
};

export function translate(lang, key) {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.fa || key;
}
