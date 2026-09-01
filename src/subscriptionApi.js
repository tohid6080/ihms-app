import { sb, sbOk, SUPABASE_URL, SUPABASE_ANON_KEY, getCurrentCompanyId } from "./shared.js";
import { getSessionToken } from "./sessionToken.js";

/**
 * محاسبه‌ی وضعیت واقعی دسترسی شرکت — طبق اصل صریح «Frontend فقط
 * نمایش‌دهنده باشد»: این تابع هیچ تصمیم نهایی نمی‌گیرد؛ فقط همان منطقی
 * را که تابع SQL is_company_subscription_active() سمت دیتابیس اجرا
 * می‌کند، اینجا هم برای نمایش لحظه‌ای (بدون نیاز به رفت‌وبرگشت شبکه)
 * تکرار می‌کند. اگر این دو یک‌روز از هم واگرا شوند، دیتابیس همیشه
 * تصمیم‌گیرنده‌ی نهایی است — این فقط برای UI سریع است.
 */
export function computeSubscriptionAccess(company) {
  if (!company) return { status: "unknown", isLocked: true, label: "نامشخص" };

  if (company.subscriptionStatus === "disabled") {
    return { status: "disabled", isLocked: true, label: "حساب شرکت غیرفعال شده است" };
  }
  if (company.subscriptionStatus === "pending_payment") {
    return { status: "pending_payment", isLocked: true, label: "در انتظار تکمیل پرداخت" };
  }

  const now = new Date();

  if (company.subscriptionType === "trial") {
    if (!company.trialEnd) return { status: "trial_expired", isLocked: true, label: "دوره‌ی آزمایشی تنظیم نشده است" };
    const end = new Date(company.trialEnd);
    const msLeft = end.getTime() - now.getTime();
    if (msLeft <= 0) return { status: "trial_expired", isLocked: true, label: "دوره‌ی آزمایشی شما به پایان رسیده است", trialStart: company.trialStart, trialEnd: company.trialEnd };
    const daysLeft = Math.floor(msLeft / (24 * 3600 * 1000));
    const hoursLeft = Math.floor(msLeft / (3600 * 1000));
    const base = { status: "trial_active", isLocked: false, trialStart: company.trialStart, trialEnd: company.trialEnd };
    if (daysLeft >= 1) return { ...base, daysLeft, label: `${daysLeft.toLocaleString("fa-IR")} روز از دوره‌ی آزمایشی شما باقی مانده است` };
    return { ...base, hoursLeft, label: `${hoursLeft.toLocaleString("fa-IR")} ساعت از دوره‌ی آزمایشی شما باقی مانده است` };
  }

  if (company.subscriptionType === "permanent") {
    return { status: "active", isLocked: false, label: "اشتراک دائمی" };
  }

  if (!company.subscriptionEndDate) return { status: "expired", isLocked: true, label: "اشتراک شما به پایان رسیده است" };
  const end = new Date(company.subscriptionEndDate);
  const msLeft = end.getTime() - now.getTime();
  if (msLeft <= 0) return { status: "expired", isLocked: true, label: "اشتراک شما به پایان رسیده است", subscriptionStartDate: company.subscriptionStartDate, subscriptionEndDate: company.subscriptionEndDate };
  const daysLeft = Math.floor(msLeft / (24 * 3600 * 1000));
  return { status: "active", isLocked: false, daysLeft, subscriptionStartDate: company.subscriptionStartDate, subscriptionEndDate: company.subscriptionEndDate, label: daysLeft <= 7 ? `${daysLeft.toLocaleString("fa-IR")} روز تا پایان اشتراک شما باقی مانده است` : "اشتراک فعال" };
}

// اطلاعات اشتراک شرکت جاری — customer scope عادی (RLS خودش company
// isolation را تضمین می‌کند)؛ این همان چیزی است که بلافاصله بعد از ورود
// خوانده می‌شود تا مشخص شود کاربر باید به داشبورد برود یا صفحه‌ی انتخاب پلن.
export async function loadMySubscriptionInfo() {
  const companyId = getCurrentCompanyId();
  if (!companyId) return null;
  const rows = await sb(`companies?id=eq.${companyId}&select=id,name,plan_id,subscription_type,subscription_status,subscription_start_date,subscription_end_date,trial_start,trial_end`);
  if (!sbOk(rows) || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, name: r.name, planId: r.plan_id || "",
    subscriptionType: r.subscription_type || "trial", subscriptionStatus: r.subscription_status || "active",
    subscriptionStartDate: r.subscription_start_date || "", subscriptionEndDate: r.subscription_end_date || "",
    trialStart: r.trial_start || "", trialEnd: r.trial_end || "",
  };
}

// پلن‌های قابل‌خرید — customer scope؛ فقط پلن‌های فعال، برای نمایش در
// صفحه‌ی انتخاب پلن. قیمت مستقیم از همین رکورد خوانده می‌شود (نه
// Hard-code در Frontend).
export async function loadPurchasablePlans() {
  const rows = await sb("plans?is_active=eq.true&select=*&order=sort_order.asc.nullslast,price_monthly.asc");
  if (!sbOk(rows)) return [];
  return rows.map((r) => ({
    id: r.id, name: r.name, priceMonthly: Number(r.price_monthly) || 0, priceYearly: Number(r.price_yearly) || 0,
    maxUsers: r.max_users, maxPersonnel: r.max_personnel, maxStorageMb: r.max_storage_mb,
    features: Array.isArray(r.features) ? r.features : [], trialDays: r.trial_days || null,
  }));
}

// تاریخچه‌ی پرداخت‌های آنلاین شرکت جاری — برای نمایش در پنل شرکت
export async function loadMyPayments() {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  const rows = await sb(`payments?company_id=eq.${companyId}&select=*&order=created_at.desc`);
  return sbOk(rows) ? rows.map(paymentFromRow) : [];
}

// نسخه‌ی سوپرادمین — پرداخت‌های آنلاین هر شرکتی، نه فقط شرکت خودش
export async function loadOnlinePaymentsForCompany(companyId) {
  if (!companyId) return [];
  const rows = await sb(`payments?company_id=eq.${companyId}&select=*&order=created_at.desc`, {}, "super_admin");
  return sbOk(rows) ? rows.map(paymentFromRow) : [];
}

function paymentFromRow(r) {
  return {
    id: r.id, companyId: r.company_id, planId: r.plan_id, billingCycle: r.billing_cycle,
    amount: Number(r.amount) || 0, orderId: r.order_id, status: r.status, refId: r.ref_id || "",
    createdAt: r.created_at, verifiedAt: r.verified_at,
  };
}

// ---------- پرداخت آنلاین زرین‌پال — همه‌ی منطق حساس سمت Edge Function ----------
// طبق الزام امنیتی صریح: هیچ کلید/Merchant ID زرین‌پالی اینجا نیست؛
// این تابع فقط Edge Function را با توکن نشست معتبر صدا می‌زند.

async function callPaymentFunction(body) {
  const token = getSessionToken("customer");
  if (!token) return { __error: true, message: "نشست شما نامعتبر است — لطفاً دوباره وارد شوید." };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/zarinpal-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { __error: true, message: data?.error || "خطا در ارتباط با درگاه پرداخت" };
    return data;
  } catch {
    return { __error: true, message: "خطا در برقراری ارتباط با سرور" };
  }
}

// شروع پرداخت — پلن و دوره را می‌فرستد، سرور قیمت واقعی را از دیتابیس
// می‌خواند (نه از Frontend)، رکورد payments می‌سازد، و لینک انتقال به
// زرین‌پال را برمی‌گرداند.
export async function initiatePayment(planId, billingCycle) {
  const result = await callPaymentFunction({ action: "request", planId, billingCycle });
  if (result?.__error) return result;
  return { ok: true, redirectUrl: result.url };
}

// تأیید پرداخت بعد از بازگشت از زرین‌پال — Authority و orderId از همان
// Query String صفحه‌ی بازگشت خوانده می‌شوند (نه از حافظه‌ی مرورگر که
// می‌تواند با Refresh یا ارسال مجدد دستکاری شود).
export async function verifyPayment(authority, orderId) {
  const result = await callPaymentFunction({ action: "verify", authority, orderId });
  if (result?.__error) return result;
  return { ok: true, activated: !!result.activated, refId: result.refId || "" };
}

// ---------- سوپرادمین — فعال‌سازی Trial ----------
// طبق تصمیم تأییدشده: مدت Trial از خودِ پلن خوانده می‌شود، نه Hard-code.
export async function activateTrialForCompany(companyId, planId, changedBy, startDateIso) {
  const planRows = await sb(`plans?id=eq.${planId}&select=trial_days`, {}, "super_admin");
  const trialDays = sbOk(planRows) && planRows.length > 0 ? Number(planRows[0].trial_days) || 0 : 0;
  if (trialDays <= 0) return { __error: true, message: "این پلن مدت Trial تعریف‌شده‌ای ندارد" };

  const start = startDateIso ? new Date(startDateIso) : new Date();
  const end = new Date(start.getTime() + trialDays * 24 * 3600 * 1000);
  const payload = {
    plan_id: planId, subscription_type: "trial", subscription_status: "active",
    trial_start: start.toISOString(), trial_end: end.toISOString(),
  };
  const rows = await sb(`companies?id=eq.${companyId}`, { method: "PATCH", body: JSON.stringify(payload) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در فعال‌سازی دوره‌ی آزمایشی" };

  await sb("company_subscription_history", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify([{ company_id: companyId, plan_id: planId, action: "trial_activated", changed_by: changedBy || "", note: `Trial ${trialDays} روزه فعال شد` }]),
  }, "super_admin");

  return { ok: true, trialEnd: end.toISOString() };
}
