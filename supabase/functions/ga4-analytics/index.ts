// supabase/functions/ga4-analytics/index.ts
//
// Server-side proxy to the Google Analytics Data API. This is the ONLY
// place the Google service-account private key ever exists — it lives in
// Edge Function secrets (`supabase secrets set ...`), never in the React
// bundle, so it's never visible to anyone opening browser dev tools.
//
// Auth model: this app doesn't use Supabase Auth (see CLAUDE.md — accounts
// are plain rows in `employer_accounts` / `contractors`, checked by direct
// password comparison). To stay consistent with that model instead of
// bolting on a different auth system just for this one feature, the
// function re-verifies the caller's username+password server-side (using
// the Supabase *service role* key, kept in Edge Function secrets) against
// `employer_accounts` and requires role = 'admin' before calling GA4.
//
// Deploy:
//   supabase functions deploy ga4-analytics
// Secrets (set once, see the setup guide in the chat response):
//   supabase secrets set GA4_PROPERTY_ID=... \
//     GA4_SERVICE_ACCOUNT_EMAIL=... \
//     GA4_SERVICE_ACCOUNT_PRIVATE_KEY="..." \
//     SUPABASE_URL=... \
//     SUPABASE_SERVICE_ROLE_KEY=...

import { GoogleAuth } from "npm:google-auth-library@9";

const GA4_PROPERTY_ID = Deno.env.get("GA4_PROPERTY_ID") ?? "";
const GA4_SA_EMAIL = Deno.env.get("GA4_SERVICE_ACCOUNT_EMAIL") ?? "";
const GA4_SA_KEY = (Deno.env.get("GA4_SERVICE_ACCOUNT_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// --- تأیید هویت ادمین، سمت سرور، با کلید service_role (هرگز به مرورگر نمی‌رود) ---
async function verifyAdmin(username: string, password: string): Promise<boolean> {
  if (!username || !password) return false;
  const url = `${SUPABASE_URL}/rest/v1/employer_accounts?username=eq.${encodeURIComponent(username)}&select=password,role`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) return false;
  const rows = await res.json();
  const match = Array.isArray(rows) ? rows[0] : null;
  return !!match && match.password === password && match.role === "admin";
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    credentials: { client_email: GA4_SA_EMAIL, private_key: GA4_SA_KEY },
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("خطا در دریافت توکن گوگل — سرویس‌اکانت را بررسی کنید");
  return token.token;
}

async function runReport(accessToken: string, body: Record<string, unknown>) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function runRealtimeReport(accessToken: string, body: Record<string, unknown>) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runRealtimeReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GA4 runRealtimeReport failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// یک ردیف {dimensionValues, metricValues} از پاسخ GA4 را به [{label, value}] ساده تبدیل می‌کند
function flatten(report: any, labelIndex = 0, metricIndex = 0) {
  const rows = report?.rows ?? [];
  return rows.map((r: any) => ({
    label: r.dimensionValues?.[labelIndex]?.value ?? "—",
    value: Number(r.metricValues?.[metricIndex]?.value ?? 0),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!GA4_PROPERTY_ID || !GA4_SA_EMAIL || !GA4_SA_KEY) {
    return json({ error: "سرویس هنوز روی سرور تنظیم نشده — GA4_PROPERTY_ID / SERVICE_ACCOUNT را در Edge Function secrets تنظیم کنید" }, 500);
  }

  let username = "", password = "";
  try {
    const body = await req.json();
    username = body?.username ?? "";
    password = body?.password ?? "";
  } catch {
    return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
  }

  const isAdmin = await verifyAdmin(username, password);
  if (!isAdmin) return json({ error: "دسترسی غیرمجاز" }, 401);

  try {
    const accessToken = await getAccessToken();
    const dateRanges = [{ startDate: "28daysAgo", endDate: "today" }];

    const [totals, sources, devices, browsers, os, geoCountry, geoCity, pages, realtime, realtimeCountry] = await Promise.all([
      runReport(accessToken, { dateRanges, metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }, { name: "activeUsers" }] }),
      runReport(accessToken, { dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], limit: 10, orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
      runReport(accessToken, { dateRanges, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "activeUsers" }], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] }),
      runReport(accessToken, { dateRanges, dimensions: [{ name: "browser" }], metrics: [{ name: "activeUsers" }], limit: 8, orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] }),
      runReport(accessToken, { dateRanges, dimensions: [{ name: "operatingSystem" }], metrics: [{ name: "activeUsers" }], limit: 8, orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] }),
      runReport(accessToken, { dateRanges, dimensions: [{ name: "country" }], metrics: [{ name: "activeUsers" }], limit: 10, orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] }),
      runReport(accessToken, { dateRanges, dimensions: [{ name: "city" }], metrics: [{ name: "activeUsers" }], limit: 10, orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] }),
      runReport(accessToken, { dateRanges, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], limit: 10, orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }] }),
      runRealtimeReport(accessToken, { metrics: [{ name: "activeUsers" }] }),
      runRealtimeReport(accessToken, { dimensions: [{ name: "country" }], metrics: [{ name: "activeUsers" }], limit: 5 }),
    ]);

    const totalsRow = totals?.rows?.[0]?.metricValues ?? [];

    return json({
      totalVisits: Number(totalsRow[0]?.value ?? 0),
      uniqueVisitors: Number(totalsRow[1]?.value ?? 0),
      activeUsers: Number(totalsRow[2]?.value ?? 0),
      realtimeUsers: Number(realtime?.rows?.[0]?.metricValues?.[0]?.value ?? 0),
      realtimeByCountry: flatten(realtimeCountry),
      countries: flatten(geoCountry),
      cities: flatten(geoCity),
      trafficSources: flatten(sources),
      devices: flatten(devices),
      browsers: flatten(browsers),
      operatingSystems: flatten(os),
      topPages: flatten(pages),
      periodLabel: "۲۸ روز اخیر",
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
