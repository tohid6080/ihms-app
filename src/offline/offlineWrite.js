/**
 * offlineWrite — the single entry point a module's data layer should call
 * for any create/update/delete once it's wired for offline support (Phase 2+).
 *
 * Online:  writes straight to Supabase (same behavior as today) and caches
 *          the result locally as "synced".
 * Offline: writes optimistically to the local cache as "pending" and queues
 *          the operation — the record is immediately usable in the UI, and
 *          syncEngine.processQueue() will push it once connectivity returns.
 *
 * ROOT-CAUSE FIX (was: any online failure — including a real server
 * rejection like a missing Storage bucket, an RLS policy denial, or a
 * schema mismatch — was silently swallowed and treated as "offline, will
 * sync later". The record then sat in the local queue retrying the exact
 * same broken request forever, eventually surfacing only as a bare
 * "ناموفق" badge with no visible reason, while the UI had already shown
 * the user a false "success"). Now a genuine server rejection (Supabase
 * responded with a real HTTP status) is surfaced to the caller immediately
 * — retrying an identical rejected request would only fail the same way
 * again. Only a true network-level failure (no response at all — status
 * 0, or fetch throwing before any response) falls back to the offline
 * queue, which is the only case where "will sync later" is actually true.
 */

import { sb, sbOk, getCurrentCompanyId } from "../shared.js";
import { putRecord, getRecord, enqueueSync, newLocalId } from "./offlineDb.js";
import { isOnline } from "./networkStatus.js";
import { processQueue } from "./syncEngine.js";
import { uploadBase64ToStorage } from "./storageUpload.js";

// true فقط برای قطعی واقعی شبکه (هیچ پاسخی از سرور نیامده) — نه برای موردی
// که سرور واقعاً پاسخ داد و رد کرد (که آن یک خطای واقعی و قابل‌نمایش است)
function isNetworkLevelFailure(err) {
  if (err && typeof err.status === "number") return err.status === 0;
  return true; // خطایی که اصلاً status نداشت یعنی قبل از رسیدن پاسخ پرتاب شده
}

export async function offlineWrite({ module, table, idField = "id", action, id, payload, includeIdInPayload = true }) {
  const recordId = id || newLocalId(module);

  if (isOnline()) {
    if (action === "insert") {
      const insertPayload = includeIdInPayload ? { ...payload, [idField]: recordId } : payload;
      const rows = await sb(table, { method: "POST", body: JSON.stringify([insertPayload]) });
      if (sbOk(rows)) {
        await putRecord(module, rows[0][idField] || recordId, rows[0], "synced");
        return { ok: true, record: rows[0], offline: false };
      }
      if (rows?.status !== 0) return { ok: false, error: rows?.message || "خطای درج" };
      // status 0 → قطعی واقعی شبکه، برو به مسیر آفلاین پایین
    } else if (action === "update") {
      const rows = await sb(`${table}?${idField}=eq.${recordId}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (sbOk(rows)) {
        await putRecord(module, recordId, rows[0], "synced");
        return { ok: true, record: rows[0], offline: false };
      }
      if (rows?.status !== 0) return { ok: false, error: rows?.message || "خطای به‌روزرسانی" };
    } else if (action === "delete") {
      const result = await sb(`${table}?${idField}=eq.${recordId}`, { method: "DELETE", prefer: "return=minimal" });
      if (!result?.__error) return { ok: true, offline: false };
      if (result?.status !== 0) return { ok: false, error: result?.message || "خطای حذف" };
    }
  }

  // ---- مسیر آفلاین واقعی (یا قطعی واقعی شبکه در تلاش آنلاین بالا) ----
  const existing = action === "update" ? await getRecord(module, recordId) : null;
  const optimisticData = action === "delete" ? null : { ...(existing?.data || {}), ...payload, [idField]: recordId };

  if (action === "delete") {
    await putRecord(module, recordId, { deleted: true }, "pending");
  } else {
    await putRecord(module, recordId, optimisticData, "pending");
  }

  await enqueueSync({
    module,
    recordId,
    action,
    payload: action === "insert" ? (includeIdInPayload ? { ...payload, [idField]: recordId } : payload) : payload,
  });

  // opportunistic: if a sync happens to be running or comes back mid-call, don't block on it
  processQueue();

  return { ok: true, record: optimisticData, offline: true };
}

/**
 * offlineWriteFile — like offlineWrite, but for records that carry a photo
 * or document as base64. The actual file goes to Supabase Storage (not the
 * database) — only a short URL string ends up in the row, which is what
 * keeps the 500MB free-tier database quota from filling up with photos.
 *
 * Online: uploads to Storage immediately, then inserts the row with the
 *         resulting URL.
 * Offline: keeps the base64 locally (IndexedDB has plenty of room) and
 *         defers the actual Storage upload until the sync engine runs —
 *         see the fileUpload handling in syncEngine.js.
 *
 * Same root-cause fix as offlineWrite above: a real Storage/DB rejection
 * (bad bucket, RLS, schema) is surfaced immediately instead of being
 * disguised as "queued for later".
 */
export async function offlineWriteFile({ module, table, idField = "id", bucket, id, base64Data, contentType, extraFields = {}, fileFieldName, includeIdInPayload = true }) {
  const recordId = id || newLocalId(module);
  const ext = (contentType || "").includes("pdf") ? "pdf" : "jpg";
  const storagePath = `${recordId}.${ext}`;
  // اضافه‌شدن company_id به‌صورت مرکزی، اینجا — نه در هر سه محل فراخوانی
  // جداگانه — چون تا امروز هیچ‌کدام این را نمی‌فرستادند، و بدون آن، بعد از
  // فعال‌سازی RLS واقعی روی این جدول‌ها، آپلود مدرک/عکس جدید رد می‌شد.
  const extraFieldsWithCompany = { ...extraFields, company_id: getCurrentCompanyId() };

  if (isOnline()) {
    try {
      const publicUrl = await uploadBase64ToStorage(bucket, storagePath, base64Data, contentType);
      const dbPayload = includeIdInPayload ? { ...extraFieldsWithCompany, [fileFieldName]: publicUrl, [idField]: recordId } : { ...extraFieldsWithCompany, [fileFieldName]: publicUrl };
      const rows = await sb(table, { method: "POST", body: JSON.stringify([dbPayload]) });
      if (sbOk(rows)) {
        await putRecord(module, rows[0][idField] || recordId, rows[0], "synced");
        return { ok: true, record: rows[0], offline: false };
      }
      if (rows?.status !== 0) return { ok: false, error: rows?.message || "خطای درج مدرک" };
      // status 0 روی درجِ دیتابیس بعد از آپلود موفق فایل — نادر، ولی باز هم برو صف آفلاین
    } catch (e) {
      if (!isNetworkLevelFailure(e)) {
        return { ok: false, error: e?.message || "خطا در آپلود فایل" };
      }
      // قطعی واقعی شبکه حین آپلود → برو مسیر آفلاین پایین
    }
  }

  const optimisticData = { ...extraFieldsWithCompany, [fileFieldName]: base64Data, [idField]: recordId };
  await putRecord(module, recordId, optimisticData, "pending");
  await enqueueSync({
    module,
    recordId,
    action: "insert",
    payload: includeIdInPayload ? { ...extraFieldsWithCompany, [idField]: recordId } : { ...extraFieldsWithCompany },
    fileUpload: { bucket, path: storagePath, base64Data, contentType, fieldName: fileFieldName },
  });
  processQueue();

  return { ok: true, record: optimisticData, offline: true };
}
