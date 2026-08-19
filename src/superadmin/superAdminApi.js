import { sb, sbOk, SUPABASE_URL, SUPABASE_ANON_KEY, uid } from "../shared.js";
import { issueSessionToken, getSessionToken } from "../sessionToken.js";

/**
 * Fully separate from the regular auth flow (SEED_USERS / employer_accounts
 * / contractors in App.jsx). Nothing in this file is reachable from any
 * customer-facing screen — the only way in is the hidden #super-admin
 * route checked once at the very top of App.jsx, before any of the normal
 * login/dashboard tree even mounts.
 */

// نسخه‌ی قبلی این تابع تمام ردیف super_admins (شامل رمز متنی خام) را با
// کلید anon می‌خواند و سمت کلاینت مقایسه می‌کرد — دقیقاً همان نشتی که در
// attemptCredentialLogin هم بود. حالا فقط از طریق Edge Function
// issue-session-token (که رمز را با pgcrypto سمت سرور بررسی می‌کند) انجام
// می‌شود و هیچ رمزی هرگز به مرورگر برنمی‌گردد.
export async function superAdminLogin(username, password) {
  const result = await issueSessionToken(username.trim(), password, "super_admin");
  if (result?.error) return { __error: true, message: result.message };
  return result.user;
}

export const SUBSCRIPTION_TYPES = [
  { value: "trial", label: "آزمایشی" },
  { value: "daily", label: "روزانه" },
  { value: "monthly", label: "ماهانه" },
  { value: "yearly", label: "سالانه" },
  { value: "monthly_and_yearly", label: "هر دو (ماهانه و سالانه)" },
  { value: "permanent", label: "دائمی" },
];
export const SUBSCRIPTION_STATUSES = [
  { value: "active", label: "فعال", color: "#166534", bg: "#dcfce7" },
  { value: "expired", label: "منقضی", color: "#c92a2a", bg: "#fdecec" },
  { value: "disabled", label: "غیرفعال", color: "#5b6b7d", bg: "#eef1f5" },
];
export function subscriptionStatusMeta(v) {
  return SUBSCRIPTION_STATUSES.find((s) => s.value === v) || SUBSCRIPTION_STATUSES[0];
}

function companyFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    registeredAt: r.registered_at,
    subscriptionType: r.subscription_type || "trial",
    subscriptionStatus: r.subscription_status || "active",
    subscriptionEndDate: r.subscription_end_date || "",
    subscriptionDays: r.subscription_days || null,
    storageQuotaMb: r.storage_quota_mb ?? 500,
    lastLoginAt: r.last_login_at || "",
    notes: r.notes || "",
    planId: r.plan_id || "",
    contractAmount: Number(r.contract_amount) || 0,
    discountAmount: Number(r.discount_amount) || 0,
    finalAmount: Number(r.final_amount) || 0,
    monthlyRecurringAmount: Number(r.monthly_recurring_amount) || 0,
  };
}

export async function loadCompanies() {
  const rows = await sb("companies?select=*&order=registered_at.desc", {}, "super_admin");
  return (sbOk(rows) ? rows : []).map(companyFromRow);
}

export async function createCompany(rec) {
  const payload = {
    name: rec.name, subscription_type: rec.subscriptionType || "trial",
    subscription_status: "active", subscription_end_date: rec.subscriptionEndDate || null,
    storage_quota_mb: rec.storageQuotaMb || 500,
  };
  const rows = await sb("companies", { method: "POST", body: JSON.stringify([payload]) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت شرکت" };
  return companyFromRow(rows[0]);
}

export async function updateCompany(id, patch) {
  const dbPatch = {};
  if ("subscriptionType" in patch) dbPatch.subscription_type = patch.subscriptionType;
  if ("subscriptionStatus" in patch) dbPatch.subscription_status = patch.subscriptionStatus;
  if ("subscriptionEndDate" in patch) dbPatch.subscription_end_date = patch.subscriptionEndDate || null;
  if ("storageQuotaMb" in patch) dbPatch.storage_quota_mb = patch.storageQuotaMb;
  if ("notes" in patch) dbPatch.notes = patch.notes;
  const rows = await sb(`companies?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی" };

  // طبق خواسته‌ی صریح: هم غیرفعال‌سازی/انقضا هم فعال‌سازی مجدد شرکت، همه‌ی
  // کاربرانش (کارفرما+پیمانکار) را در همان جهت هماهنگ می‌کند.
  if ("subscriptionStatus" in patch) {
    const shouldBeActive = patch.subscriptionStatus === "active";
    await Promise.all([
      sb(`employer_accounts?company_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ is_active: shouldBeActive }) }, "super_admin"),
      sb(`contractors?company_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ is_active: shouldBeActive }) }, "super_admin"),
    ]);
  }
  return companyFromRow(rows[0]);
}

// نسخه‌ی قبلی این تابع مستقیم روی companies یک DELETE ساده می‌زد — که با
// وجود ده‌ها جدول وابسته (پرسنل، آنومالی، BowTie و...) تقریباً همیشه با
// خطای foreign key متوقف می‌شد. الان از طریق Edge Function امن
// delete-company انجام می‌شود که اول همه‌ی داده‌های وابسته را به ترتیب
// درست پاک می‌کند. confirmName باید دقیقاً با نام شرکت یکی باشد — یک
// محافظ صریح در برابر حذف تصادفی.
export async function deleteCompanySecure(companyId, confirmName) {
  const token = getSessionToken("super_admin");
  if (!token) return { __error: true, message: "نشست نامعتبر است — لطفاً دوباره وارد شوید." };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-company`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ companyId, confirmName }),
    });
    const data = await res.json();
    if (!res.ok) return { __error: true, message: data?.error || "خطا در حذف شرکت" };
    return { ok: true, deletedCounts: data.deletedCounts };
  } catch {
    return { __error: true, message: "خطا در برقراری ارتباط با سرور" };
  }
}

// میانبر برای غیرفعال/فعال‌سازی سریع شرکت — همان تغییر subscription_status
// که از قبل با dropdown هم ممکن بود، فقط با یک دکمه‌ی مستقیم و واضح‌تر.
// برخلاف حذف، کاملاً برگشت‌پذیر است و هیچ داده‌ای پاک نمی‌شود.
export async function setCompanyActive(companyId, active) {
  const rows = await sb(`companies?id=eq.${companyId}`, { method: "PATCH", body: JSON.stringify({ subscription_status: active ? "active" : "disabled" }) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در تغییر وضعیت شرکت" };
  // طبق خواسته‌ی صریح: هم غیرفعال‌سازی هم فعال‌سازی مجدد شرکت، همه‌ی
  // کاربرانش (کارفرما+پیمانکار) را در همان جهت هماهنگ می‌کند.
  await Promise.all([
    sb(`employer_accounts?company_id=eq.${companyId}`, { method: "PATCH", body: JSON.stringify({ is_active: active }) }, "super_admin"),
    sb(`contractors?company_id=eq.${companyId}`, { method: "PATCH", body: JSON.stringify({ is_active: active }) }, "super_admin"),
  ]);
  return { ok: true };
}

export const PAYMENT_TYPES = [
  { value: "monthly", label: "ماهانه" },
  { value: "yearly", label: "سالانه" },
];

export async function loadCompanyPayments(companyId) {
  const rows = await sb(`company_payments?company_id=eq.${companyId}&select=*&order=payment_date.desc`, {}, "super_admin");
  return sbOk(rows) ? rows : [];
}
export async function addCompanyPayment(companyId, amount, paymentType, trackingNumber, note, paymentDate) {
  const payload = {
    company_id: companyId, amount: Number(amount) || 0,
    payment_type: paymentType || "installment",
    tracking_number: trackingNumber || "", note: note || "",
    payment_date: paymentDate || new Date().toISOString().slice(0, 10),
  };
  await sb("company_payments", { method: "POST", body: JSON.stringify([payload]), prefer: "return=minimal" }, "super_admin");
}

// ---------- وضعیت پرداخت — کاملاً محاسبه‌شده، مستقل از وضعیت اشتراک ----------
// طبق خواسته‌ی صریح: «اشتراک: فعال | پرداخت: بیعانه پرداخت شده» — این دو
// هرگز به‌طور خودکار به هم وابسته نمی‌شوند.
// وضعیت مبلغ یک‌بارهٔ قرارداد — فقط بر اساس پرداخت‌های نوع «سالانه» است.
// پرداخت‌های «ماهانه» جزو این مانده حساب نمی‌شوند، چون مبلغ مستمر ماهانه
// یک تعهد کاملاً جداست (نگاه کنید به computeMonthlyPaymentAlarm پایین).
export function computePaymentStatus(finalAmount, payments) {
  const yearlyPayments = payments.filter((p) => p.payment_type === "yearly");
  const totalPaid = yearlyPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (Number(finalAmount) || 0) - totalPaid);
  if (totalPaid === 0) return { status: "unpaid", label: "پرداخت نشده", color: "#5b6b7d", bg: "#eef1f5", remaining, totalPaid };
  if (remaining <= 0) return { status: "settled", label: "تسویه کامل", color: "#166534", bg: "#dcfce7", remaining: 0, totalPaid };
  return { status: "partial", label: "در حال تسویه", color: "#92400e", bg: "#fef3c7", remaining, totalPaid };
}

// وضعیت مبلغ مستمر ماهانه — طبق خواسته‌ی صریح: چون این مبلغ باید هرماه
// جداگانه اخذ شود، «مانده» به معنای یک‌باره ندارد؛ فقط بررسی می‌شود که آیا
// برای ماه جاری (میلادی) یک پرداخت «ماهانه» ثبت شده یا نه.
export function computeMonthlyPaymentAlarm(company, payments) {
  const monthlyAmount = Number(company?.monthlyRecurringAmount) || 0;
  if (monthlyAmount <= 0) return null; // این شرکت اصلاً تعهد ماهانه ندارد
  const now = new Date();
  const paidThisMonth = payments.some((p) => {
    if (p.payment_type !== "monthly") return false;
    const d = new Date(p.payment_date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  if (paidThisMonth) return { overdue: false, label: "پرداخت ماهانه این ماه ثبت شده", color: "#166534", bg: "#dcfce7" };
  return { overdue: true, label: `مبلغ مستمر ماهانه (${monthlyAmount.toLocaleString("fa-IR")} تومان) هنوز برای این ماه پرداخت نشده`, color: "#b91c1c", bg: "#fee2e2" };
}

// معوق: هنوز بدهی باقی مانده و دوره‌ی اشتراک هم به پایان رسیده
export function isPaymentOverdue(company, paymentStatus) {
  if (!paymentStatus || paymentStatus.remaining <= 0) return false;
  if (!company.subscriptionEndDate) return false;
  return new Date(company.subscriptionEndDate).getTime() < Date.now();
}

// ---------- هشدار پایان اشتراک — پلکان دقیق درخواست‌شده ----------
export function computeSubscriptionAlertTier(endDate) {
  if (!endDate) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const end = new Date(endDate); end.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((end - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { tier: "expired", label: "منقضی شده", daysLeft, color: "#b91c1c", bg: "#fee2e2" };
  if (daysLeft === 0) return { tier: "today", label: "امروز پایان می‌یابد", daysLeft, color: "#b91c1c", bg: "#fee2e2" };
  if (daysLeft <= 3) return { tier: "3days", label: `${daysLeft} روز مانده`, daysLeft, color: "#b91c1c", bg: "#fee2e2" };
  if (daysLeft <= 7) return { tier: "7days", label: `${daysLeft} روز مانده`, daysLeft, color: "#92400e", bg: "#fef3c7" };
  if (daysLeft <= 15) return { tier: "15days", label: `${daysLeft} روز مانده`, daysLeft, color: "#92400e", bg: "#fef3c7" };
  if (daysLeft <= 30) return { tier: "30days", label: `${daysLeft} روز مانده`, daysLeft, color: "#92400e", bg: "#fef3c7" };
  return null;
}

export async function sendAnnouncement(companyId, message) {
  const payload = { company_id: companyId || null, message };
  await sb("system_announcements", { method: "POST", body: JSON.stringify([payload]), prefer: "return=minimal" }, "super_admin");
}

// ---------- ایجاد اولین حساب کاربری برای یک شرکت ----------
// این تابع دقیقاً همان جدولی را می‌نویسد (employer_accounts) که صفحه‌ی ورود
// عادی سایت از آن می‌خواند — یعنی نتیجه‌اش بلافاصله قابل استفاده برای ورود
// به سایت اصلی است، نه پنل Super Admin.
export async function createCompanyUserAccount(companyId, { name, username, password, role }) {
  const clean = username.trim();
  const existing = await sb(`employer_accounts?username=eq.${encodeURIComponent(clean)}&select=id`, {}, "super_admin");
  if (sbOk(existing) && existing.length > 0) {
    return { __error: true, message: "این نام کاربری قبلاً استفاده شده است" };
  }
  const payload = {
    name: name.trim(), username: clean, password, can_edit: true,
    role: role === "admin" ? "admin" : "employer", company_id: companyId,
  };
  const rows = await sb("employer_accounts", { method: "POST", body: JSON.stringify([payload]) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت حساب" };
  return rows[0];
}

export async function loadCompanyUserAccounts(companyId) {
  const [employers, contractorRows] = await Promise.all([
    sb(`employer_accounts?company_id=eq.${companyId}&select=id,name,username,role&order=name.asc`, {}, "super_admin"),
    sb(`contractors?company_id=eq.${companyId}&select=id,name,username&order=name.asc`, {}, "super_admin"),
  ]);
  const emp = (sbOk(employers) ? employers : []).map((a) => ({ ...a, type: "employer" }));
  const con = (sbOk(contractorRows) ? contractorRows : []).map((a) => ({ ...a, type: "contractor" }));
  return [...emp, ...con];
}

// ---------- بخش D: مدیریت واقعی پلن‌ها و اشتراک ----------

function planFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    priceMonthly: Number(r.price_monthly) || 0,
    priceYearly: Number(r.price_yearly) || 0,
    maxUsers: r.max_users,
    maxPersonnel: r.max_personnel,
    maxStorageMb: r.max_storage_mb,
    features: Array.isArray(r.features) ? r.features : [],
    isActive: !!r.is_active,
    sortOrder: r.sort_order ?? 0,
  };
}

// فهرست فیچرهایی که یک پلن می‌تواند فعال/غیرفعال کند — کلیدها با HSE_MODULES هماهنگ‌اند
// درخت واقعی ماژول/زیرماژول اپ — دقیقاً منطبق با HSE_MODULES در App.jsx،
// تا انتخاب فیچر هر پلن با ساختار واقعی منوها همخوانی داشته باشد.
export const PLAN_FEATURES = [
  { key: "chat", label: "چت" },
  {
    key: "archiveManagement", label: "آرشیو فایل‌ها",
    sub: [
      { key: "archivePersonnel", label: "آرشیو پرسنل" },
      { key: "archiveAnomaly", label: "آرشیو آنومالی" },
      { key: "archiveMachinery", label: "آرشیو ماشین‌آلات" },
      { key: "archiveScaffold", label: "آرشیو داربست" },
    ],
  },
  {
    key: "anomalyReport", label: "مدیریت عدم انطباق‌ها",
    sub: [
      { key: "anomalyForm", label: "ثبت آنومالی" },
      { key: "anomalyList", label: "لیست آنومالی‌ها" },
      { key: "correctiveActionsList", label: "لیست اقدامات اصلاحی" },
    ],
  },
  {
    key: "riskAssessment", label: "مدیریت ارزیابی ریسک",
    sub: [
      { key: "bowtieDashboard", label: "BowTie Risk Analysis" },
      { key: "hcmsDashboard", label: "HCMS - مدیریت و کنترل خطرات" },
      { key: "riskKnowledgeManagement", label: "بانک اطلاعاتی ارزیابی ریسک" },
    ],
  },
  {
    key: "personnelAccess", label: "مدیریت ورود و تردد پرسنل",
    sub: [
      { key: "personnelDashboard", label: "لیست پرسنل" },
      { key: "personnelForm", label: "ثبت پرسنل جدید" },
    ],
  },
  {
    key: "proactiveIndicators", label: "اندازه‌گیری شاخص‌های Proactive HSE",
    sub: [
      { key: "accidentProneness", label: "استعداد حادثه‌پذیری (Accident Proneness)" },
      { key: "hseClimate", label: "HSE Climate" },
    ],
  },
  {
    key: "incidentManagement", label: "مدیریت حوادث",
    sub: [
      { key: "incidentsList", label: "فهرست حوادث" },
      { key: "tripodBetaAnalysis", label: "تحلیل حادثه Tripod Beta" },
    ],
  },
  {
    key: "machineryManagement", label: "مدیریت ماشین‌آلات و تجهیزات",
    sub: [{ key: "machineryDashboard", label: "لیست ماشین‌آلات" }],
  },
  {
    key: "scaffoldManagement", label: "مدیریت داربست",
    sub: [{ key: "scaffoldDashboard", label: "لیست تگ داربست" }],
  },
  { key: "managementDashboard", label: "داشبورد مدیریتی و گزارش‌های تحلیلی" },
  { key: "adminAnalytics", label: "داشبورد فعالیت کاربران" },
  {
    key: "systemManagement", label: "مدیریت سیستم",
    sub: [
      { key: "permissionManagement", label: "مدیریت دسترسی‌ها" },
      { key: "jobPositionManagement", label: "مدیریت عناوین شغلی" },
      { key: "scaffoldCodeManagement", label: "مدیریت کدهای داربست" },
      { key: "trainingManagement", label: "مدیریت آموزش" },
      { key: "chatAccessManagement", label: "مدیریت دسترسی چت" },
      { key: "hcmsMatrixManagement", label: "مدیریت ماتریس HCMS" },
      { key: "effectivenessThresholds", label: "Threshold اثربخشی Barrier" },
      { key: "anomalyCategoryManagement", label: "مدیریت دسته‌بندی آنومالی" },
    ],
  },
];

export async function loadPlans(includeInactive = true) {
  const filter = includeInactive ? "" : "&is_active=eq.true";
  const rows = await sb(`plans?select=*&order=sort_order.asc.nullslast,price_monthly.asc${filter}`, {}, "super_admin");
  return (sbOk(rows) ? rows : []).map(planFromRow);
}

export async function createPlan(rec) {
  const existing = await sb("plans?select=sort_order&order=sort_order.desc.nullslast&limit=1", {}, "super_admin");
  const nextOrder = sbOk(existing) && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 1;
  const payload = {
    name: rec.name, price_monthly: rec.priceMonthly || 0, price_yearly: rec.priceYearly || 0,
    max_users: rec.maxUsers || null, max_personnel: rec.maxPersonnel || null, max_storage_mb: rec.maxStorageMb || null,
    features: rec.features || [], is_active: true, sort_order: nextOrder,
  };
  const rows = await sb("plans", { method: "POST", body: JSON.stringify([payload]) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت پلن" };
  return planFromRow(rows[0]);
}

export async function updatePlan(id, patch) {
  const dbPatch = { updated_at: new Date().toISOString() };
  if ("name" in patch) dbPatch.name = patch.name;
  if ("priceMonthly" in patch) dbPatch.price_monthly = patch.priceMonthly;
  if ("priceYearly" in patch) dbPatch.price_yearly = patch.priceYearly;
  if ("maxUsers" in patch) dbPatch.max_users = patch.maxUsers || null;
  if ("maxPersonnel" in patch) dbPatch.max_personnel = patch.maxPersonnel || null;
  if ("maxStorageMb" in patch) dbPatch.max_storage_mb = patch.maxStorageMb || null;
  if ("features" in patch) dbPatch.features = patch.features;
  if ("isActive" in patch) dbPatch.is_active = patch.isActive;
  const rows = await sb(`plans?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی پلن" };
  return planFromRow(rows[0]);
}

// حذف واقعی نمی‌کنیم — پلنی که به شرکت‌های واقعی وصل بوده نباید ناپدید شود
// و تاریخچه‌اش را بی‌معنا کند؛ فقط غیرفعال می‌شود تا دیگر قابل‌انتخاب نباشد
export async function deactivatePlan(id) {
  return updatePlan(id, { isActive: false });
}

// جابه‌جایی یک پلن به بالا/پایین — با جابه‌جا کردن sort_order با همسایه‌اش
export async function movePlan(plans, planId, direction) {
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((p) => p.id === planId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return { ok: true }; // در لبه‌ی لیست — کاری لازم نیست
  const a = sorted[idx], b = sorted[swapIdx];
  await Promise.all([
    sb(`plans?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: b.sortOrder }) }, "super_admin"),
    sb(`plans?id=eq.${b.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: a.sortOrder }) }, "super_admin"),
  ]);
  return { ok: true };
}

// حذف واقعی — اگر شرکتی هنوز روی این پلن است، حذف مسدود می‌شود (پیام
// واضح، نه خطای مبهم foreign key) تا اول جابه‌جا/غیرفعال کند
export async function deletePlan(id) {
  const usedBy = await sb(`companies?plan_id=eq.${id}&select=id,name&limit=5`, {}, "super_admin");
  if (sbOk(usedBy) && usedBy.length > 0) {
    const names = usedBy.map((c) => c.name).join("، ");
    return { __error: true, message: `این پلن هنوز برای این شرکت‌ها فعال است: ${names} — اول پلن آن‌ها را عوض کنید یا این پلن را فقط غیرفعال کنید.` };
  }
  const result = await sb(`plans?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }, "super_admin");
  if (!sbOk(result)) return { __error: true, message: "خطا در حذف پلن" };
  return { ok: true };
}

// ---------- تخصیص پلن به شرکت + ثبت تاریخچه ----------

// ---------- محاسبات مالی اشتراک — هیچ عددی هاردکد نیست، همه از پلن/ورودی سوپرادمین می‌آید ----------

// تاریخ پایان خودکار بر اساس نوع اشتراک — ماهانه/سالانه دقیقاً یک ماه/سال
// از امروز جلو می‌روند؛ روزانه دقیقاً به تعداد روزی که سوپرادمین وارد کرده.
// آزمایشی/دائمی تاریخ پایان خودکار ندارند (سوپرادمین خودش دستی مدیریت می‌کند).
export function computeSubscriptionEndDate(type, days, fromDate = new Date()) {
  const start = new Date(fromDate);
  if (type === "monthly") { const d = new Date(start); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); }
  if (type === "yearly" || type === "monthly_and_yearly") { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); }
  if (type === "daily") { const d = new Date(start); d.setDate(d.getDate() + (Number(days) || 0)); return d.toISOString().slice(0, 10); }
  return null;
}

// مبلغ قرارداد از قیمت پایه‌ی خودِ پلن محاسبه می‌شود — نه یک عدد ثابت.
// برای نوع «روزانه»، چون پلن نرخ روزانه‌ی جداگانه ندارد، نرخ روزانه از
// تقسیم قیمت ماهانه بر ۳۰ به دست می‌آید (یک انتخاب طراحی صریح، نه حدس پنهان).
// «هر دو» یعنی شرکت هم‌زمان قیمت ماهانه و سالانه‌ی همان پلن را می‌پردازد —
// مثلاً وقتی می‌خواهد یک پلن دوم/تکمیلی را هم‌زمان با پلن اصلی بخرد.
// مبلغ یک‌باره‌ی ابتدای قرارداد — برای «سالانه» و «هر دو»، این همان قیمت
// سالانه است (چون طبق تعریف صریح، سالانه فقط یک‌بار اول قرارداد پرداخت
// می‌شود). برای «ماهانه» به‌تنهایی، مبلغ یک‌باره‌ی ابتدایی وجود ندارد —
// چون کل مبلغ به‌صورت مستمر هرماه اخذ می‌شود (نگاه کنید به
// computeMonthlyRecurringAmount).
export function computeContractAmount(plan, type, days) {
  if (!plan) return 0;
  if (type === "yearly" || type === "monthly_and_yearly") return plan.priceYearly || 0;
  if (type === "daily") return Math.round(((plan.priceMonthly || 0) / 30) * (Number(days) || 0));
  return 0; // monthly تنها → مبلغ یک‌باره ندارد؛ trial/permanent → رایگان یا قرارداد جدا
}

// مبلغ مستمری که هرماه جداگانه از شرکت اخذ می‌شود — مستقل از مبلغ یک‌باره‌ی
// بالا. فقط وقتی نوع اشتراک شامل ماهانه باشد («ماهانه» یا «هر دو») غیرصفر است.
export function computeMonthlyRecurringAmount(plan, type) {
  if (!plan) return 0;
  if (type === "monthly" || type === "monthly_and_yearly") return plan.priceMonthly || 0;
  return 0;
}

export async function assignPlanToCompany(companyId, planId, action, changedBy, note, subscriptionType, days, discountAmount) {
  const companyRows = await sb(`companies?id=eq.${companyId}&select=plan_id`, {}, "super_admin");
  const previousPlanId = sbOk(companyRows) && companyRows.length > 0 ? companyRows[0].plan_id : null;

  const plans = await loadPlans();
  const plan = plans.find((p) => p.id === planId);
  const contractAmount = computeContractAmount(plan, subscriptionType, days);
  const monthlyRecurringAmount = computeMonthlyRecurringAmount(plan, subscriptionType);
  const discount = Number(discountAmount) || 0;
  // تخفیف فقط روی مبلغ یک‌باره اعمال می‌شود؛ مبلغ ماهانه‌ی مستمر مستقل و
  // دست‌نخورده می‌ماند، چون هرماه جدا محاسبه/اخذ می‌شود.
  const finalAmount = Math.max(0, contractAmount - discount);
  const endDate = computeSubscriptionEndDate(subscriptionType, days);

  const updatePayload = {
    plan_id: planId,
    subscription_type: subscriptionType,
    subscription_days: subscriptionType === "daily" ? Number(days) || null : null,
    contract_amount: contractAmount,
    discount_amount: discount,
    final_amount: finalAmount,
    monthly_recurring_amount: monthlyRecurringAmount,
  };
  if (endDate) updatePayload.subscription_end_date = endDate;

  const updateResult = await sb(`companies?id=eq.${companyId}`, { method: "PATCH", body: JSON.stringify(updatePayload) }, "super_admin");
  if (!sbOk(updateResult)) return { __error: true, message: "خطا در تغییر پلن شرکت" };

  const historyPayload = {
    company_id: companyId, plan_id: planId, previous_plan_id: previousPlanId,
    action: action || "assigned", note: note || "", changed_by: changedBy || "",
    contract_amount: contractAmount, discount_amount: discount, final_amount: finalAmount,
  };
  await sb("company_subscription_history", { method: "POST", body: JSON.stringify([historyPayload]), prefer: "return=minimal" }, "super_admin");
  return { ok: true };
}

export async function loadCompanySubscriptionHistory(companyId) {
  const rows = await sb(`company_subscription_history?company_id=eq.${companyId}&select=*&order=changed_at.desc`, {}, "super_admin");
  return sbOk(rows) ? rows : [];
}

// عناوین شغلی یک شرکت خاص — برخلاف loadActiveJobPositions در ماژول عادی
// (که به company_id همان کاربر واردشده وابسته است)، اینجا سوپرادمین باید
// بتواند عناوین شغلی هر شرکتی که در فرم انتخاب کرده را ببیند.
export async function loadJobPositionsForCompany(companyId) {
  if (!companyId) return [];
  const rows = await sb(`job_positions?company_id=eq.${companyId}&is_active=eq.true&select=id,title&order=order_index.asc`, {}, "super_admin");
  return sbOk(rows) ? rows : [];
}

// ---------- مدیریت حساب‌ها (Admin/Employer/Contractor) — فقط Super Admin ----------
// این توابع مستقیم به دیتابیس نمی‌نویسند؛ همه از طریق Edge Function
// manage-account رد می‌شوند که خودش امضای توکن فراخوان را بررسی می‌کند و
// اگر is_super_admin نباشد، درخواست را رد می‌کند — یعنی محدودیت «Admin
// نمی‌تواند حساب بسازد» در Backend enforce می‌شود، نه فقط با مخفی‌کردن UI.

async function callManageAccount(payload) {
  const token = getSessionToken("super_admin");
  if (!token) return { __error: true, message: "نشست نامعتبر است — لطفاً دوباره وارد شوید." };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { __error: true, message: data?.error || "خطا در انجام عملیات" };
    return data;
  } catch {
    return { __error: true, message: "خطا در برقراری ارتباط با سرور" };
  }
}

// targetType: "admin" | "employer" | "contractor"
export async function loadAccountsByType(targetType, companyId) {
  const table = targetType === "contractor" ? "contractors" : "employer_accounts";
  const roleFilter = targetType === "admin" ? "&role=eq.admin" : targetType === "employer" ? "&role=eq.employer" : "";
  const companyFilter = companyId ? `&company_id=eq.${companyId}` : "";
  const selectCols = targetType === "contractor"
    ? "id,name,username,company_id,job_position_id,contact_person_name,start_date,contract_details,phone,email,is_active"
    : "id,name,username,company_id,job_position_id,role,can_edit,phone,email,is_active";
  const rows = await sb(`${table}?select=${selectCols}&order=name.asc${roleFilter}${companyFilter}`, {}, "super_admin");
  return sbOk(rows) ? rows : [];
}

export async function createAccount(targetType, fields) {
  return callManageAccount({ action: "create", targetType, fields });
}
export async function updateAccount(targetType, targetId, fields) {
  return callManageAccount({ action: "update", targetType, targetId, fields });
}
export async function setAccountActive(targetType, targetId, active) {
  return callManageAccount({ action: active ? "reactivate" : "deactivate", targetType, targetId });
}
export async function resetAccountPassword(targetType, targetId, newPassword) {
  return callManageAccount({ action: "reset_password", targetType, targetId, newPassword });
}
export async function deleteAccount(targetType, targetId) {
  return callManageAccount({ action: "delete", targetType, targetId });
}

export async function loadAuditLog(limit = 50) {
  const token = getSessionToken("super_admin");
  if (!token) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log?select=*&order=created_at.desc&limit=${limit}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ---------- آمار مصرف واقعی هر شرکت — بعد از تکمیل مهاجرت company_id ----------
// هر شمارنده مستقیم از همان جدول واقعی می‌آید؛ هیچ عددی تخمینی یا ساختگی نیست.
// اگر داده‌ای برای یک شرکت نباشد، همان صفر واقعی نشان داده می‌شود، نه یک مقدار جعلی.

function countByCompany(rows) {
  const counts = {};
  rows.forEach((r) => {
    if (!r.company_id) return;
    counts[r.company_id] = (counts[r.company_id] || 0) + 1;
  });
  return counts;
}

export async function loadCompanyUsageStats() {
  const [personnel, anomalies, anomalyPhotos, personnelDocs, machineryDocs, scaffoldPhotos] = await Promise.all([
    sb("personnel?select=company_id"),
    sb("anomalies?select=company_id"),
    sb("anomaly_photos?select=company_id"),
    sb("personnel_documents?select=company_id"),
    sb("machinery_documents?select=company_id"),
    sb("scaffold_tag_photos?select=company_id"),
  ]);
  const personnelByCompany = countByCompany(sbOk(personnel) ? personnel : []);
  const anomalyByCompany = countByCompany(sbOk(anomalies) ? anomalies : []);
  const attachmentRows = [
    ...(sbOk(anomalyPhotos) ? anomalyPhotos : []),
    ...(sbOk(personnelDocs) ? personnelDocs : []),
    ...(sbOk(machineryDocs) ? machineryDocs : []),
    ...(sbOk(scaffoldPhotos) ? scaffoldPhotos : []),
  ];
  const attachmentByCompany = countByCompany(attachmentRows);

  return { personnelByCompany, anomalyByCompany, attachmentByCompany };
}

// ---------- مانیتورینگ سیستم — از همان جدول واقعی user_activity ----------

export async function loadRecentLogins(limit = 20) {
  const rows = await sb(`user_activity?event_type=eq.login&select=*&order=created_at.desc&limit=${limit}`, {}, "super_admin");
  return sbOk(rows) ? rows : [];
}

export async function loadRecentFailedLogins(limit = 20) {
  const rows = await sb(`user_activity?event_type=eq.failed_login&select=*&order=created_at.desc&limit=${limit}`, {}, "super_admin");
  return sbOk(rows) ? rows : [];
}

// ---------- تحلیل هوشمند — فقط قواعد ساده روی داده‌ی واقعی موجود ----------
// طبق خواسته‌ی صریح: اگر داده کافی نیست، چیزی ساخته نمی‌شود؛ فقط لیست خالی برمی‌گردد.

export function computeExpiringCompanies(companies, withinDays = 14) {
  const now = Date.now();
  const limit = now + withinDays * 24 * 60 * 60 * 1000;
  return companies.filter((c) => {
    if (!c.subscriptionEndDate) return false;
    const end = new Date(c.subscriptionEndDate).getTime();
    return end >= now && end <= limit;
  });
}

export async function computeInactiveCompanies(companies, sinceDays = 30) {
  const rows = await sb(`user_activity?event_type=eq.login&select=company_id,created_at&order=created_at.desc`, {}, "super_admin");
  const lastLoginByCompany = {};
  if (sbOk(rows)) {
    rows.forEach((r) => {
      if (r.company_id && !lastLoginByCompany[r.company_id]) lastLoginByCompany[r.company_id] = r.created_at;
    });
  }
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  return companies.filter((c) => {
    const last = lastLoginByCompany[c.id];
    if (!last) return true; // اصلاً هیچ لاگینی ثبت نشده — قطعاً بی‌فعالیت
    return new Date(last).getTime() < cutoff;
  });
}

// ---------- مانیتورینگ واقعی Storage — فقط Super Admin، از طریق Edge Function ----------

async function callStorageUsage(payload) {
  const token = getSessionToken("super_admin");
  if (!token) return { __error: true, message: "نشست نامعتبر است — لطفاً دوباره وارد شوید." };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/storage-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { __error: true, message: data?.error || "خطا در دریافت اطلاعات Storage" };
    return data;
  } catch {
    return { __error: true, message: "خطا در برقراری ارتباط با سرور" };
  }
}

export async function loadStorageUsage() {
  return callStorageUsage({ action: "read" });
}

export async function setStorageCapacity(capacityMb) {
  return callStorageUsage({ action: "set_capacity", capacityMb });
}

// وضعیت رنگی مصرف — دقیقاً همان سه آستانه‌ی درخواست‌شده
export function storageUsageStatus(percent) {
  if (percent >= 90) return { label: "بحرانی", color: "#b91c1c", bg: "#fee2e2" };
  if (percent >= 80) return { label: "هشدار", color: "#92400e", bg: "#fef3c7" };
  return { label: "عادی", color: "#166534", bg: "#dcfce7" };
}

// ---------- کپی محتوای آماده بین شرکت‌ها — فقط Super Admin ----------
// وقتی یک شرکت جدید می‌خواهد همان بانک دانش ریسک یا مدل‌های BowTie شرکت
// دیگری (مثلاً شرکت مرجع/نمونه) را داشته باشد. هرچیزی که کپی می‌شود یک
// نسخه‌ی کاملاً مستقل با شناسه‌ی جدید است — ویرایش نسخه‌ی شرکت مقصد هیچ
// اثری روی نسخه‌ی مبدأ ندارد.

export async function copyRiskKnowledgeToCompany(sourceCompanyId, targetCompanyId) {
  const rows = await sb(`risk_knowledge_base?company_id=eq.${sourceCompanyId}&select=*`, {}, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در خواندن بانک دانش ریسک مبدأ" };
  if (rows.length === 0) return { ok: true, count: 0 };

  // نکته‌ی مهم: برخلاف جدول‌های BowTie (که id متنی و ساخت‌شده در برنامه
  // دارند)، ستون id این جدول از نوع uuid با مقدار پیش‌فرض خودِ دیتابیس است
  // — دقیقاً مثل مسیر عادی createKnowledgeRecord. اگر اینجا هم مثل قبل یک
  // رشته‌ی متنی (uid("kb")) به آن بدهیم، با خطای type casting رد می‌شود؛
  // برای همین اصلاً id فرستاده نمی‌شود، خودِ دیتابیس یک UUID تازه می‌سازد.
  const payload = rows.map((r) => {
    const { id, created_at, updated_at, ...rest } = r;
    return { ...rest, company_id: targetCompanyId };
  });
  const inserted = await sb("risk_knowledge_base", { method: "POST", body: JSON.stringify(payload) }, "super_admin");
  if (!sbOk(inserted)) return { __error: true, message: "خطا در نوشتن نسخه‌ی جدید" };
  return { ok: true, count: inserted.length };
}

export async function copyBowtiesToCompany(sourceCompanyId, targetCompanyId) {
  const bowties = await sb(`bowties?company_id=eq.${sourceCompanyId}&select=*`, {}, "super_admin");
  if (!sbOk(bowties)) return { __error: true, message: "خطا در خواندن مدل‌های BowTie مبدأ" };
  if (bowties.length === 0) return { ok: true, count: 0 };

  let copiedCount = 0;
  for (const bt of bowties) {
    const newBowtieId = uid("bowtie");
    const { id: oldBowtieId, created_at, updated_at, ...btRest } = bt;
    const btInsert = await sb("bowties", { method: "POST", body: JSON.stringify([{ ...btRest, id: newBowtieId, company_id: targetCompanyId }]) }, "super_admin");
    if (!sbOk(btInsert)) continue;

    // تهدیدها — نگاشت شناسه‌ی قدیم به جدید تا بعداً بریرها درست وصل شوند
    const threats = await sb(`bowtie_threats?bowtie_id=eq.${oldBowtieId}&select=*`, {}, "super_admin");
    const threatIdMap = {};
    if (sbOk(threats) && threats.length > 0) {
      const payload = threats.map((t) => {
        const newId = uid("threat");
        threatIdMap[t.id] = newId;
        const { id, created_at: ca, ...rest } = t;
        return { ...rest, id: newId, bowtie_id: newBowtieId, company_id: targetCompanyId };
      });
      await sb("bowtie_threats", { method: "POST", body: JSON.stringify(payload) }, "super_admin");
    }

    // پیامدها
    const consequences = await sb(`bowtie_consequences?bowtie_id=eq.${oldBowtieId}&select=*`, {}, "super_admin");
    const consIdMap = {};
    if (sbOk(consequences) && consequences.length > 0) {
      const payload = consequences.map((c) => {
        const newId = uid("cons");
        consIdMap[c.id] = newId;
        const { id, created_at: ca, ...rest } = c;
        return { ...rest, id: newId, bowtie_id: newBowtieId, company_id: targetCompanyId };
      });
      await sb("bowtie_consequences", { method: "POST", body: JSON.stringify(payload) }, "super_admin");
    }

    // بریرها — threat_id/consequence_id با نگاشت بالا به شناسه‌ی جدید اصلاح می‌شوند
    const barriers = await sb(`bowtie_barriers?bowtie_id=eq.${oldBowtieId}&select=*`, {}, "super_admin");
    const barrierIdMap = {};
    if (sbOk(barriers) && barriers.length > 0) {
      const payload = barriers.map((b) => {
        const newId = uid("barrier");
        barrierIdMap[b.id] = newId;
        const { id, created_at: ca, updated_at: ua, ...rest } = b;
        return {
          ...rest, id: newId, bowtie_id: newBowtieId, company_id: targetCompanyId,
          threat_id: b.threat_id ? threatIdMap[b.threat_id] || null : null,
          consequence_id: b.consequence_id ? consIdMap[b.consequence_id] || null : null,
          // اثربخشی محاسبه‌شده مخصوص شواهد همان شرکت مبدأ است — برای نسخه‌ی
          // جدید معنا ندارد؛ روی «ارزیابی‌نشده» ریست می‌شود
          effectiveness_status: "not_assessed", effectiveness_score: null, effectiveness_calculated_at: null,
        };
      });
      await sb("bowtie_barriers", { method: "POST", body: JSON.stringify(payload) }, "super_admin");
    }

    // فاکتورهای تشدید
    const barrierIds = Object.keys(barrierIdMap);
    let factorIdMap = {};
    if (barrierIds.length > 0) {
      const oldBarrierIdList = barrierIds.join(",");
      const factors = await sb(`bowtie_escalation_factors?barrier_id=in.(${oldBarrierIdList})&select=*`, {}, "super_admin");
      if (sbOk(factors) && factors.length > 0) {
        const payload = factors.map((f) => {
          const newId = uid("escf");
          factorIdMap[f.id] = newId;
          const { id, created_at: ca, ...rest } = f;
          return { ...rest, id: newId, barrier_id: barrierIdMap[f.barrier_id], company_id: targetCompanyId };
        });
        await sb("bowtie_escalation_factors", { method: "POST", body: JSON.stringify(payload) }, "super_admin");
      }
    }

    // کنترل‌های تشدید
    const factorIds = Object.keys(factorIdMap);
    if (factorIds.length > 0) {
      const oldFactorIdList = factorIds.join(",");
      const controls = await sb(`bowtie_escalation_controls?escalation_factor_id=in.(${oldFactorIdList})&select=*`, {}, "super_admin");
      if (sbOk(controls) && controls.length > 0) {
        const payload = controls.map((c) => {
          const { id, created_at: ca, ...rest } = c;
          return { ...rest, id: uid("escc"), escalation_factor_id: factorIdMap[c.escalation_factor_id], company_id: targetCompanyId };
        });
        await sb("bowtie_escalation_controls", { method: "POST", body: JSON.stringify(payload) }, "super_admin");
      }
    }

    copiedCount++;
  }

  return { ok: true, count: copiedCount };
}

// ---------- تنظیمات شاخص‌های Proactive HSE به‌ازای شرکت — فقط Super Admin ----------
// استعداد حادثه‌پذیری و HSE Climate باید مستقل از هم، برای هر شرکت جدا
// فعال/غیرفعال شوند — یک شرکت می‌تواند هیچ‌کدام، یکی، یا هر دو را داشته باشد.

export async function loadCompanyProactiveSettingsForAdmin(companyId) {
  const rows = await sb(`company_proactive_settings?company_id=eq.${companyId}&select=*`, {}, "super_admin");
  if (sbOk(rows) && rows.length > 0) {
    return { accidentPronenessEnabled: rows[0].accident_proneness_enabled, hseClimateEnabled: rows[0].hse_climate_enabled };
  }
  return { accidentPronenessEnabled: true, hseClimateEnabled: false };
}

export async function setCompanyProactiveSettings(companyId, patch, updatedBy) {
  const existing = await sb(`company_proactive_settings?company_id=eq.${companyId}&select=id`, {}, "super_admin");
  const payload = { company_id: companyId, updated_at: new Date().toISOString(), updated_by: updatedBy || "" };
  if ("accidentPronenessEnabled" in patch) payload.accident_proneness_enabled = patch.accidentPronenessEnabled;
  if ("hseClimateEnabled" in patch) payload.hse_climate_enabled = patch.hseClimateEnabled;

  const rows = sbOk(existing) && existing.length > 0
    ? await sb(`company_proactive_settings?company_id=eq.${companyId}`, { method: "PATCH", body: JSON.stringify(payload) }, "super_admin")
    : await sb("company_proactive_settings", { method: "POST", body: JSON.stringify([payload]) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی تنظیمات" };
  return { ok: true };
}
