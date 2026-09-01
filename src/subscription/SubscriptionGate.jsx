import React, { useState, useEffect } from "react";
import { CreditCard, Clock, CheckCircle2, XCircle, LogOut, Loader2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliDateTime } from "../personnel/jalaliDate.jsx";
import {
  computeSubscriptionAccess, loadMySubscriptionInfo, loadPurchasablePlans,
  initiatePayment, verifyPayment,
} from "../subscriptionApi.js";

/**
 * گیت اشتراک — درست بعد از ورود موفق (و بیومتریک، اگر فعال باشد) و قبل
 * از رندر داشبورد اصلی قرار می‌گیرد. کاربر همیشه با موفقیت لاگین می‌کند
 * (طبق تصمیم تأییدشده) — فقط اگر Trial/اشتراک منقضی باشد، به‌جای
 * داشبورد، صفحه‌ی انتخاب پلن می‌بیند؛ نه یک داشبورد محدودشده‌ی موازی.
 *
 * همچنین بازگشت از درگاه زرین‌پال را همین‌جا مدیریت می‌کند — چون بعد از
 * ریدایرکت، اپ از صفر لود می‌شود و تنها نشانه‌ی «این یک بازگشت از پرداخت
 * است» همان Query String صفحه (?orderId=...&Authority=...) است.
 */
export default function SubscriptionGate({ currentUser, onLogout, children }) {
  const [info, setInfo] = useState(undefined); // undefined = در حال بارگذاری
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [verifying, setVerifying] = useState(() => !!new URLSearchParams(window.location.search).get("orderId"));
  const [verifyResult, setVerifyResult] = useState(null);

  const load = () => loadMySubscriptionInfo().then(setInfo);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const orderId = params.get("orderId");
    if (!orderId) return;
    const authority = params.get("Authority") || "";
    verifyPayment(authority, orderId).then((result) => {
      setVerifyResult(result);
      setVerifying(false);
      // پاک‌کردن Query String از URL — اگر کاربر صفحه را Refresh کند، دیگر
      // دوباره Verify صدا زده نشود (idempotency سمت Frontend؛ سمت Backend
      // هم مستقل و قطعی همین را تضمین می‌کند).
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (verifying) {
    return (
      <div style={styles.centerScreen}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={32} color={THEME.teal} />
          <p style={{ marginTop: 16, color: THEME.text2, fontSize: 13.5 }}>در حال بررسی نتیجه‌ی پرداخت...</p>
        </div>
      </div>
    );
  }

  if (verifyResult) {
    return <PaymentResultScreen result={verifyResult} onContinue={() => setVerifyResult(null)} onLogout={onLogout} />;
  }

  if (info === undefined) {
    return <div style={styles.centerScreen}><p style={{ color: THEME.text3 }}>در حال بارگذاری...</p></div>;
  }

  const access = computeSubscriptionAccess(info);

  if (access.isLocked) {
    return <PlanSelectionScreen currentUser={currentUser} company={info} access={access} onLogout={onLogout} />;
  }

  return (
    <>
      {access.status === "trial_active" && (access.daysLeft === undefined || access.daysLeft <= 3) && <TrialWarningBanner access={access} />}
      {children}
    </>
  );
}

function TrialWarningBanner({ access }) {
  return (
    <div style={{ background: "#fef3c7", borderBottom: "1px solid #f59e0b", padding: "8px 20px", textAlign: "center", fontSize: 12.5, color: "#92400e", fontWeight: 600 }}>
      <Clock size={13} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 5 }} />
      {access.label}
      {access.trialEnd && <span style={{ fontWeight: 500 }}> — پایان دوره‌ی آزمایشی: {toJalaliDateTime(access.trialEnd)}</span>}
    </div>
  );
}

function PaymentResultScreen({ result, onContinue, onLogout }) {
  const success = result?.activated;
  return (
    <div style={styles.centerScreen}>
      <div style={{ ...styles.card, width: 380, textAlign: "center" }}>
        {success ? (
          <>
            <CheckCircle2 size={48} color="#166534" style={{ margin: "0 auto 14px" }} />
            <h2 style={{ fontSize: 17, color: THEME.navy, fontWeight: 800, margin: "0 0 8px" }}>پرداخت با موفقیت انجام شد</h2>
            <p style={{ fontSize: 12.5, color: THEME.text2, lineHeight: 1.9, marginBottom: 6 }}>پلن شما فعال شد و اکنون می‌توانید از امکانات سامانه استفاده کنید.</p>
            {result.refId && <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 18 }}>کد رهگیری: {result.refId}</p>}
          </>
        ) : (
          <>
            <XCircle size={48} color={THEME.danger} style={{ margin: "0 auto 14px" }} />
            <h2 style={{ fontSize: 17, color: THEME.navy, fontWeight: 800, margin: "0 0 8px" }}>پرداخت ناموفق بود</h2>
            <p style={{ fontSize: 12.5, color: THEME.text2, lineHeight: 1.9, marginBottom: 18 }}>{result.error || "تراکنش تکمیل نشد یا توسط شما لغو شد. می‌توانید دوباره تلاش کنید."}</p>
          </>
        )}
        <button type="button" style={styles.button} onClick={onContinue}>{success ? "ادامه" : "بازگشت به انتخاب پلن"}</button>
      </div>
    </div>
  );
}

function PlanSelectionScreen({ currentUser, company, access, onLogout }) {
  const [plans, setPlans] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("yearly");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadPurchasablePlans().then(setPlans); }, []);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);
  const amount = selectedPlan ? (billingCycle === "monthly" ? selectedPlan.priceMonthly : selectedPlan.priceYearly) : 0;

  const handleSelectPlan = (p, cycle) => {
    setSelectedPlanId(p.id);
    setBillingCycle(cycle);
  };

  const handlePay = async () => {
    if (!selectedPlanId) { setError("لطفاً یک پلن را انتخاب کنید"); return; }
    setPaying(true); setError("");
    const result = await initiatePayment(selectedPlanId, billingCycle);
    setPaying(false);
    if (result?.__error) { setError(result.message); return; }
    window.location.href = result.redirectUrl; // انتقال کامل به درگاه زرین‌پال
  };

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, padding: "40px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: THEME.navy, margin: "0 0 6px" }}>{access.label}</h1>
            {access.trialStart && access.trialEnd && (
              <p style={{ fontSize: 12, color: THEME.text3, margin: "0 0 6px" }}>
                از {toJalaliDateTime(access.trialStart)} تا {toJalaliDateTime(access.trialEnd)}
              </p>
            )}
            {access.subscriptionEndDate && (
              <p style={{ fontSize: 12, color: THEME.text3, margin: "0 0 6px" }}>پایان اشتراک: {toJalaliDateTime(access.subscriptionEndDate)}</p>
            )}
            <p style={{ fontSize: 13, color: THEME.text2, margin: 0 }}>برای ادامه‌ی استفاده از سامانه، یکی از پلن‌های زیر را انتخاب کنید.</p>
          </div>
          <button type="button" onClick={onLogout} style={{ ...styles.smallButton, background: THEME.text3, display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={13} /> خروج
          </button>
        </div>

        {plans === null && <p style={{ textAlign: "center", color: THEME.text3 }}>در حال بارگذاری پلن‌ها...</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
          {plans?.map((p) => {
            const hasMonthly = p.priceMonthly > 0;
            const hasYearly = p.priceYearly > 0;
            const isThisPlanSelected = selectedPlanId === p.id;
            return (
              <div
                key={p.id}
                style={{
                  background: THEME.surface, border: `2px solid ${isThisPlanSelected ? THEME.teal : THEME.border}`, borderRadius: 14,
                  padding: 20, position: "relative",
                }}
              >
                {isThisPlanSelected && <CheckCircle2 size={18} color={THEME.teal} style={{ position: "absolute", top: 14, insetInlineStart: 14 }} />}
                <h3 style={{ fontSize: 15, fontWeight: 800, color: THEME.navy, margin: "0 0 10px" }}>{p.name}</h3>

                {/* هر دو قیمت (ماهانه و سالانه) با هم نمایش داده می‌شوند — نه پشت یک Toggle سراسری */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {hasMonthly && (
                    <button
                      type="button" onClick={() => handleSelectPlan(p, "monthly")}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                        padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: THEME.font, textAlign: "start",
                        border: `1.5px solid ${isThisPlanSelected && billingCycle === "monthly" ? THEME.teal : THEME.border}`,
                        background: isThisPlanSelected && billingCycle === "monthly" ? THEME.tealSoft : "transparent",
                      }}
                    >
                      <span style={{ fontSize: 11.5, color: THEME.text2, fontWeight: 600 }}>ماهانه</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: THEME.navy }}>{p.priceMonthly.toLocaleString("fa-IR")} تومان</span>
                    </button>
                  )}
                  {hasYearly && (
                    <button
                      type="button" onClick={() => handleSelectPlan(p, "yearly")}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                        padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: THEME.font, textAlign: "start",
                        border: `1.5px solid ${isThisPlanSelected && billingCycle === "yearly" ? THEME.teal : THEME.border}`,
                        background: isThisPlanSelected && billingCycle === "yearly" ? THEME.tealSoft : "transparent",
                      }}
                    >
                      <span style={{ fontSize: 11.5, color: THEME.text2, fontWeight: 600 }}>سالانه</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: THEME.navy }}>{p.priceYearly.toLocaleString("fa-IR")} تومان</span>
                    </button>
                  )}
                  {!hasMonthly && !hasYearly && <span style={{ fontSize: 12, color: THEME.text3 }}>قیمتی تعریف نشده</span>}
                </div>

                {p.maxPersonnel && <p style={{ fontSize: 11.5, color: THEME.text2, margin: "0 0 4px" }}>سقف پرسنل: {p.maxPersonnel.toLocaleString("fa-IR")} نفر</p>}
                {p.maxUsers && <p style={{ fontSize: 11.5, color: THEME.text2, margin: "0 0 4px" }}>سقف کاربر: {p.maxUsers.toLocaleString("fa-IR")}</p>}
                <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0 }}>{p.features.length.toLocaleString("fa-IR")} ماژول فعال</p>
              </div>
            );
          })}
        </div>

        {selectedPlan && (
          <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 20, maxWidth: 420, margin: "0 auto" }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: THEME.navy, margin: "0 0 10px" }}>خلاصه‌ی خرید</h4>
            <p style={{ fontSize: 12.5, color: THEME.text2, margin: "0 0 4px" }}>پلن: <b>{selectedPlan.name}</b></p>
            <p style={{ fontSize: 12.5, color: THEME.text2, margin: "0 0 4px" }}>دوره: <b>{billingCycle === "monthly" ? "ماهانه" : "سالانه"}</b></p>
            <p style={{ fontSize: 15, fontWeight: 800, color: THEME.teal, margin: "10px 0" }}>مبلغ نهایی: {amount.toLocaleString("fa-IR")} تومان</p>
            {error && <p style={styles.error}>{error}</p>}
            <button type="button" style={{ ...styles.button, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={handlePay} disabled={paying}>
              <CreditCard size={15} /> {paying ? "در حال انتقال به درگاه..." : "پرداخت و فعال‌سازی"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
