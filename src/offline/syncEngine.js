/**
 * Sync engine — drains the offline sync_queue against Supabase whenever the
 * app is online. Table-agnostic: each module just needs one entry in
 * MODULE_TABLE_MAP, which is the whole "scalable for future modules" story
 * for the sync layer (the module's own UI code is separate work).
 *
 * Conflict handling: for "update" operations, before writing we re-read the
 * server row's updated_at. If it's newer than the timestamp captured when
 * this device queued the edit, we do NOT silently overwrite — we mark the
 * queue item "conflict" so the user can see and resolve it explicitly
 * (safer than picking a winner automatically and losing someone's work).
 */

import { sb, sbOk } from "../shared.js";
import { getQueue, updateQueueItem, removeQueueItem, putRecord } from "./offlineDb.js";
import { isOnline } from "./networkStatus.js";
import { uploadBase64ToStorage } from "./storageUpload.js";

// module key → { table, idField } — add one line here to support a new module
export const MODULE_TABLE_MAP = {
  personnel: { table: "personnel", idField: "id" },
  personnelDocuments: { table: "personnel_documents", idField: "id" },
  anomalies: { table: "anomalies", idField: "id" },
  anomalyPhotos: { table: "anomaly_photos", idField: "id" },
  bowties: { table: "bowties", idField: "id" },
  machinery: { table: "machinery", idField: "id" },
  machineryDocuments: { table: "machinery_documents", idField: "id" },
  scaffoldTags: { table: "scaffold_tags", idField: "id" },
  scaffoldPhotos: { table: "scaffold_tag_photos", idField: "id" },
  // future modules register here once built
};

const MAX_ATTEMPTS = 6;
const listeners = new Set();
let syncing = false;

function notify(summary) {
  listeners.forEach((cb) => cb(summary));
}
export function subscribeSyncStatus(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function backoffDelayMs(attempts) {
  return Math.min(60000, 1000 * 2 ** attempts); // 1s,2s,4s...capped at 60s
}

async function fetchServerUpdatedAt(table, idField, id) {
  const rows = await sb(`${table}?${idField}=eq.${id}&select=updated_at`);
  if (!sbOk(rows) || rows.length === 0) return null;
  return rows[0].updated_at || null;
}

async function applyQueueItem(item) {
  const mapping = MODULE_TABLE_MAP[item.module];
  if (!mapping) return { ok: false, permanent: true, error: `ماژول «${item.module}» برای همگام‌سازی ثبت نشده است` };
  const { table, idField } = mapping;

  // اگر این آیتم یک فایل base64 معلق دارد (موقع آفلاین‌بودن ذخیره شده)،
  // اول آپلودش کن به Storage و آدرس واقعی را جای base64 در payload بگذار
  if (item.fileUpload) {
    try {
      const url = await uploadBase64ToStorage(item.fileUpload.bucket, item.fileUpload.path, item.fileUpload.base64Data, item.fileUpload.contentType);
      item = { ...item, payload: { ...item.payload, [item.fileUpload.fieldName]: url } };
    } catch (e) {
      return { ok: false, error: `خطا در آپلود فایل: ${String(e?.message || e)}` };
    }
  }

  if (item.action === "insert") {
    const rows = await sb(table, { method: "POST", body: JSON.stringify([item.payload]) });
    if (!sbOk(rows)) return { ok: false, error: rows?.message || "خطای درج" };
    return { ok: true, serverRow: rows[0] };
  }

  if (item.action === "update") {
    if (item.baselineUpdatedAt) {
      const serverUpdatedAt = await fetchServerUpdatedAt(table, idField, item.recordId);
      if (serverUpdatedAt && serverUpdatedAt > item.baselineUpdatedAt) {
        return { ok: false, conflict: true, error: "این رکورد در این‌بین از جای دیگری تغییر کرده است" };
      }
    }
    const rows = await sb(`${table}?${idField}=eq.${item.recordId}`, { method: "PATCH", body: JSON.stringify(item.payload) });
    if (!sbOk(rows)) return { ok: false, error: rows?.message || "خطای به‌روزرسانی" };
    return { ok: true, serverRow: rows[0] };
  }

  if (item.action === "delete") {
    await sb(`${table}?${idField}=eq.${item.recordId}`, { method: "DELETE", prefer: "return=minimal" });
    return { ok: true };
  }

  return { ok: false, permanent: true, error: "نوع عملیات ناشناخته" };
}

export async function processQueue() {
  if (syncing || !isOnline()) return;
  syncing = true;
  const queue = await getQueue();
  const pending = queue.filter((q) => q.status === "pending" || q.status === "failed");

  let done = 0, failed = 0;
  for (const item of pending) {
    if (item.nextRetryAt && item.nextRetryAt > new Date().toISOString()) continue;
    if (!isOnline()) break; // stop draining if we went offline mid-batch

    await updateQueueItem(item.queueId, { status: "syncing" });
    notify({ phase: "syncing", item });

    let result;
    try {
      result = await applyQueueItem(item);
    } catch (e) {
      result = { ok: false, error: String(e?.message || e) };
    }

    if (result.ok) {
      await removeQueueItem(item.queueId);
      if (result.serverRow && MODULE_TABLE_MAP[item.module]) {
        await putRecord(item.module, item.recordId, result.serverRow, "synced");
      } else {
        await putRecord(item.module, item.recordId, item.payload, "synced");
      }
      done++;
      notify({ phase: "synced", item });
    } else if (result.conflict) {
      await updateQueueItem(item.queueId, { status: "conflict", lastError: result.error });
      await putRecord(item.module, item.recordId, item.payload, "failed");
      failed++;
      notify({ phase: "conflict", item, error: result.error });
    } else {
      const attempts = (item.attempts || 0) + 1;
      const permanent = !!result.permanent || attempts >= MAX_ATTEMPTS;
      await updateQueueItem(item.queueId, {
        status: "failed",
        attempts,
        lastError: result.error || "خطای نامشخص",
        nextRetryAt: permanent ? "9999-12-31" : new Date(Date.now() + backoffDelayMs(attempts)).toISOString(),
      });
      await putRecord(item.module, item.recordId, item.payload, "failed");
      failed++;
      notify({ phase: "failed", item, error: result.error, permanent });
    }
  }

  syncing = false;
  notify({ phase: "idle", done, failed });
  return { done, failed };
}

export async function retryItemNow(queueId) {
  await updateQueueItem(queueId, { status: "pending", nextRetryAt: new Date().toISOString() });
  return processQueue();
}

let autoTimer = null;
export function startAutoSync(intervalMs = 15000) {
  if (autoTimer) return;
  processQueue();
  autoTimer = setInterval(() => { if (isOnline()) processQueue(); }, intervalMs);
}
export function stopAutoSync() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}
