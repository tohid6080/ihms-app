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

export function trackPageView(user, page) {
  if (!page) return;
  track("page_view", { username: user?.username || "", full_name: user?.name || "", role: user?.role || "", page });
}

// ---------- خواندن برای داشبورد فعالیت ادمین ----------

export async function loadActivitySummary() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  // ۳۰ روز اخیر کافیست؛ محاسبات (روزانه، پرکاربردترین صفحات، فعال‌ها) سمت کلاینت انجام می‌شود
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sb(`user_activity?created_at=gte.${since}&select=*&order=created_at.desc&limit=2000${filter}`);
  return sbOk(rows) ? rows : [];
}
