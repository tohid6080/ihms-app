// supabase/functions/check-login-attempt/index.ts
//
// محدودیت تعداد تلاش ناموفق ورود، واقعاً سمت سرور — نه فقط یک شمارنده‌ی
// localStorage که با پاک‌کردن کش مرورگر یا امتحان از یک دستگاه دیگر دور
// زده می‌شود. این تابع جدول login_attempts را فقط با service_role key
// می‌خواند/می‌نویسد؛ خودِ جدول هیچ policy ای برای anon ندارد.
//
// این Edge Function اعتبار رمز عبور را خودش بررسی نمی‌کند و ساختار فعلی
// ورود (attemptCredentialLogin در App.jsx) دست‌نخورده می‌ماند — این تابع
// فقط دو کار می‌کند: «آیا این نام‌کاربری الان قفل است؟» و «این تلاش را
// به‌عنوان موفق/ناموفق ثبت کن».
//
// Deploy:
//   supabase functions deploy check-login-attempt
// (نیازی به هیچ secret دستی نیست — SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY
// خودکار در دسترس هر Edge Function هستند.)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function getRow(username: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/login_attempts?username=eq.${encodeURIComponent(username)}&select=*`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function upsertRow(username: string, patch: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/login_attempts`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ username, ...patch }]),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "بدنه‌ی درخواست نامعتبر است" }, 400);
  }

  const username = String(body?.username || "").trim().toLowerCase();
  if (!username) return json({ error: "نام‌کاربری ارسال نشده است" }, 400);

  if (body?.action === "check") {
    const row = await getRow(username);
    if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000);
      return json({ locked: true, retryAfterSeconds });
    }
    return json({ locked: false });
  }

  if (body?.action === "record") {
    const success = !!body?.success;
    if (success) {
      await upsertRow(username, { failed_count: 0, locked_until: null, last_attempt_at: new Date().toISOString() });
      return json({ ok: true });
    }
    const row = await getRow(username);
    const nextCount = (row?.failed_count || 0) + 1;
    const patch: Record<string, unknown> = { failed_count: nextCount, last_attempt_at: new Date().toISOString() };
    if (nextCount >= MAX_ATTEMPTS) {
      patch.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    }
    await upsertRow(username, patch);
    return json({ ok: true, failedCount: nextCount, locked: nextCount >= MAX_ATTEMPTS });
  }

  return json({ error: "action نامعتبر است" }, 400);
});
