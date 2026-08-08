import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

/**
 * Local, in-house activity tracking — no external service, no secrets, no
 * Edge Function. Just rows in `user_activity` on the same Supabase project
 * everything else already uses. This replaced an earlier GA4 integration
 * that added real operational complexity (a service account, an Edge
 * Function, Google Cloud setup) for a need this simpler approach covers.
 *
 * Tracking calls are fire-and-forget (never block/await in the UI, never
 * throw) — a logging failure should never be able to break login or
 * navigation.
 */

function track(eventType, extra = {}) {
  const payload = {
    event_type: eventType,
    company_id: getCurrentCompanyId(),
    ...extra,
  };
  // fire-and-forget — عمداً await نمی‌شود و خطا را قورت می‌دهد
  sb("user_activity", { method: "POST", body: JSON.stringify([payload]), prefer: "return=minimal" }).catch(() => {});
}

export function trackLogin(user) {
  track("login", { username: user?.username || "", full_name: user?.name || "", role: user?.role || "" });
}

export function trackLogout(user) {
  track("logout", { username: user?.username || "", full_name: user?.name || "", role: user?.role || "" });
}

// تلاش ناموفق ورود — برای اینکه ادمین در «حضور و فعالیت کاربران» بتواند
// الگوهای مشکوک (چند تلاش پشت‌سرهم ناموفق روی یک حساب) را ببیند
export function trackFailedLogin(username) {
  track("failed_login", { username: username || "", full_name: "", role: "" });
}

export function trackPageView(user, page) {
  if (!page) return;
  track("page_view", { username: user?.username || "", full_name: user?.name || "", role: user?.role || "", page });
}

// ---------- خواندن برای داشبورد فعالیت ادمین ----------

// bازه‌ی پیش‌فرض ۳۰ روز اخیر؛ می‌توان با fromDate/toDate (رشته‌ی ISO تاریخ،
// بدون زمان) محدوده‌ی دیگری خواست. محاسبه‌ی جفت‌شدن ورود/خروج و مدت حضور
// سمت کلاینت انجام می‌شود (در AdminAnalytics.jsx)، نه اینجا.
export async function loadActivitySummary(fromDate, toDate) {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const since = fromDate ? `${fromDate}T00:00:00` : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const until = toDate ? `${toDate}T23:59:59` : null;
  const untilFilter = until ? `&created_at=lte.${until}` : "";
  const rows = await sb(`user_activity?created_at=gte.${since}${untilFilter}&select=*&order=created_at.asc&limit=5000${filter}`);
  return sbOk(rows) ? rows : [];
}
