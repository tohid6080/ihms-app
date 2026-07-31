import { sb } from "../shared.js";
import { insertNotification, loadNotifications } from "../personnel/personnelApi.js";

// Supabase پلن رایگان سقف ۵۰۰ مگابایتی برای دیتابیس دارد؛ هشدار را زودتر
// (۳۰۰ مگابایت) نشان می‌دهیم تا ادمین وقت کافی برای آرشیو/پاک‌سازی داشته باشد.
export const DB_SIZE_WARNING_MB = 300;
export const DB_SIZE_FREE_TIER_LIMIT_MB = 500;

// بعد از انتقال مدارک/عکس‌ها به Storage، رشد اصلی دیگر توی همین قسمت اتفاق
// می‌افتد (نه خودِ دیتابیس) — همین سقف ۵۰۰ مگابایتی را برای Storage هم به‌عنوان
// آستانه‌ی «دیگر مدرک/عکس جدید ثبت نشود» در نظر می‌گیریم (با فاصله‌ی امن از
// سقف واقعی ۱ گیگابایتیِ Storage در پلن رایگان).
export const UPLOAD_BLOCK_MB = 500;

export async function fetchDatabaseSizeMB() {
  const result = await sb("rpc/get_db_size_mb", { method: "POST", body: JSON.stringify({}) });
  if (typeof result === "number") return result;
  return null;
}

export async function fetchStorageSizeMB() {
  const result = await sb("rpc/get_storage_size_mb", { method: "POST", body: JSON.stringify({}) });
  if (typeof result === "number") return result;
  return null;
}

/**
 * Checked right before any document/photo upload. Returns whether the
 * upload should be blocked, plus the current storage usage for the message.
 * Also fires a one-time (per day) system notification so admins see it in
 * the notification bell, not just when they happen to open the menu.
 */
export async function checkUploadAllowed() {
  const storageMb = await fetchStorageSizeMB();
  if (storageMb === null) return { allowed: true, storageMb: null }; // نمی‌دانیم → مسدود نکن، فقط اجازه بده

  const blocked = storageMb >= UPLOAD_BLOCK_MB;
  if (blocked) {
    await maybeNotifyStorageFull(storageMb);
  }
  return { allowed: !blocked, storageMb };
}

async function maybeNotifyStorageFull(storageMb) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await loadNotifications("both");
    const alreadyNotifiedToday = existing.some((n) => n.type === "storage_full" && (n.created_at || "").slice(0, 10) === today);
    if (alreadyNotifiedToday) return;
    await insertNotification(
      null,
      "storage_full",
      `فضای ذخیره‌سازی به ${storageMb} مگابایت رسیده و از سقف مجاز عبور کرده است. ثبت مدرک/عکس جدید متوقف شده — لطفاً از بخش «آرشیو فایل‌ها» مدارک قدیمی را دانلود و حذف کنید.`,
      "both"
    );
  } catch {
    // اعلان صرفاً کمکیه؛ اگر ثبتش شکست خورد، جلوی خودِ پیام خطای آپلود را نگیرد
  }
}
