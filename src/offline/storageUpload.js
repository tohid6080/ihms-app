import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../shared.js";

/**
 * Uploads base64 image/document data to a Supabase Storage bucket instead
 * of storing it inline in a Postgres column — the fix for the 500MB free
 * database quota filling up with photo/document base64.
 *
 * Called from two places:
 *  - offlineWrite.js's offlineWriteFile(), on the ONLINE path (upload
 *    happens immediately, before the row is even inserted).
 *  - syncEngine.js's applyQueueItem(), when a queued item carries a
 *    fileUpload (i.e. it was captured OFFLINE) — the upload happens once
 *    connectivity returns, right before the deferred insert/update runs.
 */

function base64ToBlob(base64Data, mimeType) {
  const clean = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const byteChars = atob(clean);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

export async function uploadBase64ToStorage(bucket, path, base64Data, contentType) {
  const blob = base64ToBlob(base64Data, contentType);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // status ثبت می‌شود تا فراخوان بتواند «سرور واقعاً رد کرد» (مثلاً باکت
    // وجود ندارد یا policy اجازه نمی‌دهد) را از «قطعی واقعی شبکه» تشخیص
    // بدهد — این دو باید رفتار کاملاً متفاوتی داشته باشند.
    const err = new Error(`خطا در آپلود فایل: ${text || res.status}`);
    err.status = res.status;
    throw err;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// از یک آدرس عمومیِ ذخیره‌شده (که خودمان موقع آپلود ساختیم)، نام bucket و مسیر
// داخلش را استخراج می‌کند — لازم برای حذف واقعی فایل هنگام آرشیو.
export function parseStorageUrl(url) {
  if (typeof url !== "string") return null;
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length); // "<bucket>/<path...>"
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) return null;
  return { bucket: rest.slice(0, slashIdx), path: rest.slice(slashIdx + 1) };
}

export async function deleteFromStorage(bucket, path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`خطا در حذف فایل از Storage: ${text || res.status}`);
  }
}
