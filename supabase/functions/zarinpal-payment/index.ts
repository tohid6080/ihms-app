// supabase/functions/zarinpal-payment/index.ts
//
// تمام منطق حساس پرداخت زرین‌پال (ساخت درخواست، Verify، فعال‌سازی خودکار
// اشتراک) اینجا و فقط اینجا انجام می‌شود — طبق الزام امنیتی صریح، هیچ
// Merchant ID یا Secret ای در Frontend/Repository قرار نمی‌گیرد؛ فقط از
// Environment Variable خوانده می‌شود.
//
// Deploy:
//   supabase functions deploy zarinpal-payment
// Environment Variables لازم (در Supabase Dashboard → Edge Functions → Secrets):
//   ZARINPAL_MERCHANT_ID   — Merchant ID واقعی زرین‌پال
//   ZARINPAL_CALLBACK_URL  — آدرس صفحه‌ی بازگشت در همین اپ، مثلاً:
//                            https://<دامنه‌ی-شما>/#/payment-callback
//   ZARINPAL_SANDBOX       — اختیاری: "true" برای تست با درگاه Sandbox
//
// نکته‌ی واحد پول: قیمت پلن‌ها (price_monthly/price_yearly) در این پروژه
// به «تومان» ذخیره می‌شوند (طبق برچسب فرم موجود در SuperAdminPanel)، ولی
// API زرین‌پال مبلغ را به «ریال» می‌خواهد — همین‌جا ضربدر ۱۰ می‌شود.
// لطفاً قبل از اتصال نهایی این فرض را با واحد واقعی حساب زرین‌پال خودتان
// تطبیق دهید.

import { getCallerClaims } from "../_shared/jwtUtils.ts";
import { SUPABASE_URL, SERVICE_ROLE_KEY, CORS_HEADERS, json, restFetch } from "../_shared/supabaseAdmin.ts";

// طبق درخواست صریح کاربر (هنوز احراز هویت زرین‌پال واقعی آماده نیست):
// یک Merchant ID پیش‌فرض تستی — طبق مستندات زرین‌پال، محیط Sandbox هر
// شناسه‌ای با فرمت معتبر UUID را می‌پذیرد و آن را به یک حساب واقعی
// اعتبارسنجی نمی‌کند؛ یعنی با همین مقدار می‌توانید کل مسیر (ساخت
// پرداخت → انتقال به درگاه → Verify → فعال‌سازی خودکار) را همین الان
// تست کنید. وقتی مرچنت واقعی را از زرین‌پال گرفتید، فقط کافی است
// ZARINPAL_MERCHANT_ID را در Supabase Secrets تنظیم کنید — این مقدار
// پیش‌فرض خودکار override می‌شود، نیازی به تغییر این فایل نیست.
const DEFAULT_TEST_MERCHANT_ID = "c9aeaaa8-4c2a-4040-a3d7-db8ea22470e3";
const MERCHANT_ID = Deno.env.get("ZARINPAL_MERCHANT_ID") ?? DEFAULT_TEST_MERCHANT_ID;
const CALLBACK_URL = Deno.env.get("ZARINPAL_CALLBACK_URL") ?? "";
// طبق درخواست صریح: تا وقتی احراز هویت زرین‌پال واقعی کاربر آماده نشده،
// پیش‌فرض روی محیط Sandbox (تستی) است — نه Production. یعنی اگر
// ZARINPAL_SANDBOX اصلاً تنظیم نشود، سیستم خودکار در حالت امن/تستی کار
// می‌کند (نمی‌تواند به‌اشتباه پول واقعی جابه‌جا کند). وقتی مرچنت واقعی
// آماده شد، کافی است ZARINPAL_SANDBOX=false و ZARINPAL_MERCHANT_ID
// واقعی را در Supabase Secrets تنظیم کنید — هیچ تغییر کدی لازم نیست.
const IS_SANDBOX = (Deno.env.get("ZARINPAL_SANDBOX") ?? "true").toLowerCase() !== "false";

const ZP_REQUEST_URL = IS_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
  : "https://api.zarinpal.com/pg/v4/payment/request.json";
const ZP_VERIFY_URL = IS_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
  : "https://api.zarinpal.com/pg/v4/payment/verify.json";
const ZP_STARTPAY_BASE = IS_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/StartPay/"
  : "https://www.zarinpal.com/pg/StartPay/";

const TOMAN_TO_RIAL = 10;

function computeSubscriptionEndDate(billingCycle: string, fromDate = new Date()): string {
  const d = new Date(fromDate);
  if (billingCycle === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1); // yearly
  return d.toISOString().slice(0, 10);
}

async function activateSubscription(companyId: string, planId: string, billingCycle: string) {
  const endDate = computeSubscriptionEndDate(billingCycle);
  const companyRows = await restFetch(`companies?id=eq.${companyId}&select=plan_id`);
  const previousPlanId = companyRows.ok && Array.isArray(companyRows.data) && companyRows.data.length > 0 ? companyRows.data[0].plan_id : null;

  await restFetch(`companies?id=eq.${companyId}`, {
    method: "PATCH",
    body: JSON.stringify({
      plan_id: planId, subscription_type: billingCycle, subscription_status: "active",
      subscription_start_date: new Date().toISOString(), subscription_end_date: endDate,
    }),
  });

  await restFetch("company_subscription_history", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{
      company_id: companyId, plan_id: planId, previous_plan_id: previousPlanId,
      action: "auto_activated_online_payment", note: `پرداخت آنلاین زرین‌پال — دوره‌ی ${billingCycle === "monthly" ? "ماهانه" : "سالانه"}`,
      changed_by: "zarinpal-payment (system)",
    }]),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!CALLBACK_URL) {
    return json({ error: "درگاه پرداخت هنوز کامل پیکربندی نشده است: ZARINPAL_CALLBACK_URL در Supabase Secrets تنظیم نشده است." }, 500);
  }

  const claims = await getCallerClaims(req);
  if (!claims || !claims.company_id) {
    return json({ error: "نشست نامعتبر است — لطفاً دوباره وارد شوید." }, 401);
  }
  const companyId = String(claims.company_id);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "درخواست نامعتبر است" }, 400);
  }

  // ============================================================
  // action: request — ساخت یک پرداخت جدید
  // ============================================================
  if (body.action === "request") {
    const planId = String(body.planId || "");
    const billingCycle = String(body.billingCycle || "");
    if (!planId || (billingCycle !== "monthly" && billingCycle !== "yearly")) {
      return json({ error: "پلن یا دوره‌ی پرداخت نامعتبر است" }, 400);
    }

    // قیمت همیشه از خودِ دیتابیس خوانده می‌شود — هرگز از Client، دقیقاً
    // طبق الزام صریح «تغییر مبلغ از سمت Client» را نپذیرد.
    const planRes = await restFetch(`plans?id=eq.${planId}&select=id,name,price_monthly,price_yearly,is_active`);
    if (!planRes.ok || !Array.isArray(planRes.data) || planRes.data.length === 0) {
      return json({ error: "پلن موردنظر پیدا نشد" }, 404);
    }
    const plan = planRes.data[0];
    if (!plan.is_active) return json({ error: "این پلن دیگر قابل‌خرید نیست" }, 400);

    const amountToman = billingCycle === "monthly" ? Number(plan.price_monthly) || 0 : Number(plan.price_yearly) || 0;
    if (amountToman <= 0) return json({ error: "قیمت این پلن برای این دوره تعریف نشده است" }, 400);
    const amountRial = amountToman * TOMAN_TO_RIAL;

    const orderId = `pay-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const insertRes = await restFetch("payments", {
      method: "POST",
      body: JSON.stringify([{
        id: orderId, company_id: companyId, plan_id: planId, billing_cycle: billingCycle,
        amount: amountToman, order_id: orderId, status: "pending", requested_by: String(claims.username || ""),
      }]),
    });
    if (!insertRes.ok) return json({ error: "خطا در ثبت درخواست پرداخت" }, 500);

    // ساخت درخواست پرداخت نزد زرین‌پال
    let zpRes: Response;
    try {
      zpRes = await fetch(ZP_REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: MERCHANT_ID,
          amount: amountRial,
          callback_url: `${CALLBACK_URL}?orderId=${orderId}`,
          description: `خرید پلن ${plan.name} — دوره‌ی ${billingCycle === "monthly" ? "ماهانه" : "سالانه"} — IHMS`,
        }),
      });
    } catch {
      await restFetch(`payments?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) });
      return json({ error: "خطا در برقراری ارتباط با درگاه پرداخت" }, 502);
    }

    const zpData = await zpRes.json().catch(() => null);
    const authority = zpData?.data?.authority;
    const code = zpData?.data?.code;

    if (!authority || code !== 100) {
      await restFetch(`payments?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) });
      return json({ error: zpData?.errors?.message || "درگاه پرداخت درخواست را رد کرد" }, 502);
    }

    await restFetch(`payments?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ authority }) });

    return json({ url: `${ZP_STARTPAY_BASE}${authority}`, orderId });
  }

  // ============================================================
  // action: verify — تأیید پرداخت بعد از بازگشت از زرین‌پال
  // ============================================================
  if (body.action === "verify") {
    const orderId = String(body.orderId || "");
    const clientAuthority = String(body.authority || "");
    if (!orderId) return json({ error: "شناسه‌ی پرداخت نامعتبر است" }, 400);

    const payRes = await restFetch(`payments?id=eq.${orderId}&select=*`);
    if (!payRes.ok || !Array.isArray(payRes.data) || payRes.data.length === 0) {
      return json({ error: "پرداخت پیدا نشد" }, 404);
    }
    const payment = payRes.data[0];

    // این پرداخت باید متعلق به همان شرکتی باشد که الان درخواست را زده —
    // جلوگیری از کنجکاوی/دستکاری company_id سمت Client.
    if (payment.company_id !== companyId) {
      return json({ error: "این پرداخت متعلق به شرکت شما نیست" }, 403);
    }

    // ایمن در برابر Refresh/ارسال مجدد Callback و Verify چندباره: اگر قبلاً
    // نهایی شده، بدون تماس دوباره با زرین‌پال همان نتیجه برگردانده می‌شود
    // — یک Payment موفق هرگز دوباره اشتراک جدید فعال نمی‌کند.
    if (payment.status === "paid") {
      return json({ activated: true, refId: payment.ref_id || "", alreadyProcessed: true });
    }
    if (payment.status === "failed" || payment.status === "cancelled") {
      return json({ activated: false, alreadyProcessed: true });
    }

    // Authority باید با همانی که موقع ساخت درخواست ذخیره شده بود یکی باشد
    if (clientAuthority && payment.authority && clientAuthority !== payment.authority) {
      return json({ error: "Authority نامعتبر است" }, 400);
    }

    const amountRial = (Number(payment.amount) || 0) * TOMAN_TO_RIAL;

    let zpRes: Response;
    try {
      zpRes = await fetch(ZP_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_id: MERCHANT_ID, amount: amountRial, authority: payment.authority }),
      });
    } catch {
      return json({ error: "خطا در برقراری ارتباط با درگاه پرداخت برای تأیید" }, 502);
    }

    const zpData = await zpRes.json().catch(() => null);
    const code = zpData?.data?.code;
    const refId = zpData?.data?.ref_id ? String(zpData.data.ref_id) : "";
    const cardPan = zpData?.data?.card_pan || null;

    // ۱۰۰ = موفق تازه؛ ۱۰۱ = قبلاً نزد خودِ زرین‌پال هم Verify شده (idempotent)
    if (code === 100 || code === 101) {
      await restFetch(`payments?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", ref_id: refId, card_pan: cardPan, verified_at: new Date().toISOString() }),
      });
      await activateSubscription(payment.company_id, payment.plan_id, payment.billing_cycle);
      return json({ activated: true, refId });
    }

    await restFetch(`payments?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) });
    return json({ activated: false, error: zpData?.errors?.message || "پرداخت تأیید نشد" });
  }

  return json({ error: "action نامعتبر است" }, 400);
});
