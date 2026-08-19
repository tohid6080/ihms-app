// supabase/functions/_shared/jwtUtils.ts
//
// عمداً هیچ کتابخانه‌ی خارجی import نمی‌شود — امضا/بررسی JWT با Web Crypto
// API استاندارد خودِ Deno انجام می‌شود، تا هیچ وابستگی به دریافت موفق یک
// ماژول از شبکه در لحظه‌ی cold start وجود نداشته باشد (علت یک خطای واقعی
// و شناخته‌شده‌ی ۵۰۰ در این پروژه بود).

const JWT_SECRET = Deno.env.get("APP_JWT_SECRET") ?? "";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

async function getKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function hasJwtSecret() {
  return !!JWT_SECRET;
}

export async function signToken(claims: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;
}

export function numericDateInSeconds(secondsFromNow: number) {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

// امضای توکن ارسالی در هدر Authorization را بررسی می‌کند و claimsاش را
// برمی‌گرداند — یا null اگر امضا نامعتبر/منقضی بود. این پایه‌ی «چه کسی این
// درخواست را زده و چه نقشی دارد» برای بقیه‌ی Edge Functionهاست.
export async function verifyToken(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const key = await getKey();
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlDecode(encodedSignature) as BufferSource, new TextEncoder().encode(signingInput));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// از هدر Authorization: Bearer <token> خودِ درخواست، claims کاربر فعلی را
// استخراج می‌کند — استفاده‌ی مشترک در همه‌ی Edge Functionهایی که نیاز به
// دانستن «چه کسی صدا زده» دارند (نه فقط apikey عمومی anon).
export async function getCallerClaims(req: Request): Promise<Record<string, any> | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return verifyToken(token);
}
