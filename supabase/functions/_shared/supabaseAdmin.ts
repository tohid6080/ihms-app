// supabase/functions/_shared/supabaseAdmin.ts

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// فراخوانی یک Postgres RPC با service_role — برای توابع verify_*/set_* که
// عمداً از anon/authenticated بسته شده‌اند (بخش ۱ SQL)
export async function callRpc(fnName: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) return { ok: false, status: res.status, data: null };
  // توابعی مثل set_employer_password با «returns void» تعریف شده‌اند — برای
  // این‌ها PostgREST بدنه‌ی کاملاً خالی برمی‌گرداند، حتی وقتی موفق بوده. اگر
  // مستقیم res.json() صدا زده شود، دقیقاً همین‌جا با «Unexpected end of
  // JSON input» کرش می‌کند. برای همین اول متن خام را می‌خوانیم و فقط اگر
  // چیزی واقعاً برگشته بود، آن را JSON.parse می‌کنیم.
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: true, status: res.status, data };
}

export async function restFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: (options.headers as any)?.Prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
<<<<<<< HEAD
  if (!res.ok) return { ok: false, status: res.status, data: null };
=======
  if (!res.ok) {
    // قبلاً اینجا فقط ok:false برمی‌گشت و متن واقعی خطای Postgres (که دقیقاً
    // می‌گوید کدام جدول/Constraint مانع شده) دور ریخته می‌شد — همین موضوع
    // باعث شد نتوانیم علت واقعی شکست حذف شرکت را پیدا کنیم، فقط حدس بزنیم.
    const errText = await res.text().catch(() => "");
    return { ok: false, status: res.status, data: null, error: errText };
  }
>>>>>>> 62c9c73 (Upload project files)
  const text = await res.text();
  return { ok: true, status: res.status, data: text ? JSON.parse(text) : [] };
}
