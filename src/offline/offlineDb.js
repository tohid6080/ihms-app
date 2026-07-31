/**
 * Offline-first local database layer.
 *
 * Uses IndexedDB — the real, browser-native transactional database available
 * inside a WebView (unlike SQLite, which requires a native bridge this
 * WebIntoApp-wrapped PWA does not have). Three object stores:
 *
 *   records     — local cache of every module's records, keyed by
 *                 "<module>:<id>", tagged with a sync status.
 *   sync_queue  — pending write operations waiting to reach Supabase.
 *   files       — photo/document blobs captured offline, referenced by id
 *                 from a record's payload until they're uploaded.
 *
 * This file has zero knowledge of any specific IHMS module — every module
 * (existing or future) uses the same generic API, which is what makes the
 * architecture scalable without per-module rework.
 */

const DB_NAME = "ihms-offline";
const DB_VERSION = 1;

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("records")) {
        const records = db.createObjectStore("records", { keyPath: "key" });
        records.createIndex("module", "module", { unique: false });
        records.createIndex("syncStatus", "syncStatus", { unique: false });
      }

      if (!db.objectStoreNames.contains("sync_queue")) {
        const queue = db.createObjectStore("sync_queue", { keyPath: "queueId", autoIncrement: true });
        queue.createIndex("status", "status", { unique: false });
        queue.createIndex("module", "module", { unique: false });
      }

      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "fileId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, storeNames, mode) {
  return db.transaction(storeNames, mode);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------- records ----------

export async function putRecord(module, id, data, syncStatus = "synced") {
  const db = await openDb();
  const t = tx(db, ["records"], "readwrite");
  const key = `${module}:${id}`;
  await promisify(t.objectStore("records").put({ key, module, id, data, syncStatus, localUpdatedAt: new Date().toISOString() }));
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); });
}

export async function getRecord(module, id) {
  const db = await openDb();
  const t = tx(db, ["records"], "readonly");
  const row = await promisify(t.objectStore("records").get(`${module}:${id}`));
  return row || null;
}

export async function getRecordsByModule(module) {
  const db = await openDb();
  const t = tx(db, ["records"], "readonly");
  const idx = t.objectStore("records").index("module");
  const rows = await promisify(idx.getAll(module));
  return rows || [];
}

export async function deleteRecord(module, id) {
  const db = await openDb();
  const t = tx(db, ["records"], "readwrite");
  await promisify(t.objectStore("records").delete(`${module}:${id}`));
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); });
}

// ---------- sync queue ----------

// action: "insert" | "update" | "delete"
// fileUpload (اختیاری): { bucket, path, base64Data, contentType, fieldName } — وقتی این
// آیتم شامل یک فایل base64 است که باید قبل از insert به Storage آپلود شود
export async function enqueueSync({ module, recordId, action, payload, fileUpload }) {
  const db = await openDb();
  const t = tx(db, ["sync_queue"], "readwrite");
  const item = {
    module, recordId, action, payload, fileUpload: fileUpload || null,
    status: "pending", attempts: 0, lastError: "",
    createdAt: new Date().toISOString(), nextRetryAt: new Date().toISOString(),
  };
  const queueId = await promisify(t.objectStore("sync_queue").add(item));
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve({ ...item, queueId });
    t.onerror = () => reject(t.error);
  });
}

export async function getQueue() {
  const db = await openDb();
  const t = tx(db, ["sync_queue"], "readonly");
  const rows = await promisify(t.objectStore("sync_queue").getAll());
  return (rows || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateQueueItem(queueId, patch) {
  const db = await openDb();
  const t = tx(db, ["sync_queue"], "readwrite");
  const store = t.objectStore("sync_queue");
  const existing = await promisify(store.get(queueId));
  if (existing) await promisify(store.put({ ...existing, ...patch }));
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); });
}

export async function removeQueueItem(queueId) {
  const db = await openDb();
  const t = tx(db, ["sync_queue"], "readwrite");
  await promisify(t.objectStore("sync_queue").delete(queueId));
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); });
}

// ---------- files (photos/documents captured offline) ----------

export async function putFile(fileId, blob, meta = {}) {
  const db = await openDb();
  const t = tx(db, ["files"], "readwrite");
  await promisify(t.objectStore("files").put({ fileId, blob, ...meta, createdAt: new Date().toISOString() }));
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); });
}

export async function getFile(fileId) {
  const db = await openDb();
  const t = tx(db, ["files"], "readonly");
  return (await promisify(t.objectStore("files").get(fileId))) || null;
}

export async function deleteFile(fileId) {
  const db = await openDb();
  const t = tx(db, ["files"], "readwrite");
  await promisify(t.objectStore("files").delete(fileId));
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); });
}

export function newLocalId(prefix = "local") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
