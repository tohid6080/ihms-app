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
 * This is intentionally the ONLY new code path — nothing here changes any
 * existing module today, since nothing calls it yet.
 */

import { sb, sbOk } from "../shared.js";
import { putRecord, getRecord, enqueueSync, newLocalId } from "./offlineDb.js";
import { isOnline } from "./networkStatus.js";
import { processQueue } from "./syncEngine.js";
import { uploadBase64ToStorage } from "./storageUpload.js";

export async function offlineWrite({ module, table, idField = "id", action, id, payload, includeIdInPayload = true }) {
  const recordId = id || newLocalId(module);

  if (isOnline()) {
    try {
      if (action === "insert") {
        const insertPayload = includeIdInPayload ? { ...payload, [idField]: recordId } : payload;
        const rows = await sb(table, { method: "POST", body: JSON.stringify([insertPayload]) });
        if (!sbOk(rows)) throw new Error(rows?.message || "خطای درج");
        await putRecord(module, rows[0][idField] || recordId, rows[0], "synced");
        return { ok: true, record: rows[0], offline: false };
      }
      if (action === "update") {
        const rows = await sb(`${table}?${idField}=eq.${recordId}`, { method: "PATCH", body: JSON.stringify(payload) });
        if (!sbOk(rows)) throw new Error(rows?.message || "خطای به‌روزرسانی");
        await putRecord(module, recordId, rows[0], "synced");
        return { ok: true, record: rows[0], offline: false };
      }
      if (action === "delete") {
        await sb(`${table}?${idField}=eq.${recordId}`, { method: "DELETE", prefer: "return=minimal" });
        return { ok: true, offline: false };
      }
    } catch (e) {
      // fall through to offline queueing — network looked fine but the
      // request itself failed (timeout, dropped mid-flight, etc.)
    }
  }

  // ---- offline path (or online write failed) ----
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
 */
export async function offlineWriteFile({ module, table, idField = "id", bucket, id, base64Data, contentType, extraFields = {}, fileFieldName, includeIdInPayload = true }) {
  const recordId = id || newLocalId(module);
  const ext = (contentType || "").includes("pdf") ? "pdf" : "jpg";
  const storagePath = `${recordId}.${ext}`;

  if (isOnline()) {
    try {
      const publicUrl = await uploadBase64ToStorage(bucket, storagePath, base64Data, contentType);
      const dbPayload = includeIdInPayload ? { ...extraFields, [fileFieldName]: publicUrl, [idField]: recordId } : { ...extraFields, [fileFieldName]: publicUrl };
      const rows = await sb(table, { method: "POST", body: JSON.stringify([dbPayload]) });
      if (!sbOk(rows)) throw new Error(rows?.message || "خطای درج");
      await putRecord(module, rows[0][idField] || recordId, rows[0], "synced");
      return { ok: true, record: rows[0], offline: false };
    } catch (e) {
      // fall through to offline queueing
    }
  }

  const optimisticData = { ...extraFields, [fileFieldName]: base64Data, [idField]: recordId };
  await putRecord(module, recordId, optimisticData, "pending");
  await enqueueSync({
    module,
    recordId,
    action: "insert",
    payload: includeIdInPayload ? { ...extraFields, [idField]: recordId } : { ...extraFields },
    fileUpload: { bucket, path: storagePath, base64Data, contentType, fieldName: fileFieldName },
  });
  processQueue();

  return { ok: true, record: optimisticData, offline: true };
}
