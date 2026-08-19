/**
 * Network / reachability detection.
 *
 * navigator.onLine only reflects the device's network *interface* state —
 * it can report "online" even when the actual backend (Supabase) is
 * unreachable (this project has already hit exactly that in production:
 * Supabase being blocked/unreachable from certain networks while the
 * device itself has internet). So real status = browser online AND a
 * lightweight reachability probe against Supabase succeeding.
 */

import { SUPABASE_PING_URL } from "../shared.js";

const listeners = new Set();
let currentStatus = { browserOnline: navigator.onLine, reachable: null, online: navigator.onLine };
let pollTimer = null;

function notify() {
  listeners.forEach((cb) => cb(currentStatus));
}

async function pingSupabase() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(SUPABASE_PING_URL, { method: "HEAD", signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    // any HTTP response (even 401/404) proves the network path is reachable
    return res.status >= 200 && res.status < 600;
  } catch {
    return false;
  }
}

async function refreshStatus() {
  const browserOnline = navigator.onLine;
  const reachable = browserOnline ? await pingSupabase() : false;
  const online = browserOnline && reachable;
  const changed = online !== currentStatus.online || browserOnline !== currentStatus.browserOnline;
  currentStatus = { browserOnline, reachable, online };
  if (changed) notify();
  return currentStatus;
}

export function getStatus() {
  return currentStatus;
}

export function isOnline() {
  return currentStatus.online;
}

export function subscribeNetworkStatus(callback) {
  listeners.add(callback);
  callback(currentStatus);
  return () => listeners.delete(callback);
}

let started = false;
export function startNetworkMonitor(pollIntervalMs = 20000) {
  if (started) return;
  started = true;
  window.addEventListener("online", refreshStatus);
  window.addEventListener("offline", refreshStatus);
  refreshStatus();
  pollTimer = setInterval(refreshStatus, pollIntervalMs);
}

export function stopNetworkMonitor() {
  if (!started) return;
  started = false;
  window.removeEventListener("online", refreshStatus);
  window.removeEventListener("offline", refreshStatus);
  if (pollTimer) clearInterval(pollTimer);
}

// exposed for "retry now" buttons
export { refreshStatus as checkNow };
