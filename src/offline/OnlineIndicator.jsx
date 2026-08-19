import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { subscribeNetworkStatus, startNetworkMonitor, checkNow } from "./networkStatus.js";
import { startAutoSync, subscribeSyncStatus } from "./syncEngine.js";
import { getQueue } from "./offlineDb.js";

/**
 * Drop this once in the app header. It:
 *  - starts the network monitor + auto-sync loop (idempotent, safe to
 *    mount multiple times across dashboards since both guards on `started`)
 *  - shows a small online/offline dot + label
 *  - shows a pending-operations count when there's anything queued
 */
export default function OnlineIndicator() {
  const [status, setStatus] = useState({ online: navigator.onLine });
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    startNetworkMonitor();
    startAutoSync();

    const unsubNet = subscribeNetworkStatus(setStatus);
    const refreshCount = async () => {
      const q = await getQueue();
      setPendingCount(q.filter((i) => i.status !== "syncing").length);
    };
    refreshCount();
    const unsubSync = subscribeSyncStatus((summary) => {
      setSyncing(summary.phase === "syncing");
      refreshCount();
    });
    const interval = setInterval(refreshCount, 10000);

    return () => { unsubNet(); unsubSync(); clearInterval(interval); };
  }, []);

  const color = status.online ? "#34d399" : "#fca5a5";

  return (
    <div
      onClick={() => checkNow()}
      title={status.online ? "متصل به سرور" : "بدون اتصال — تغییرات به‌صورت محلی ذخیره می‌شوند"}
      style={{
        display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 999, padding: "5px 10px", fontSize: 11, color: "#fff", fontWeight: 600,
      }}
    >
      {syncing ? (
        <RefreshCw size={12} style={{ animation: "ihms-spin 1s linear infinite" }} />
      ) : status.online ? (
        <Wifi size={12} color={color} />
      ) : (
        <WifiOff size={12} color={color} />
      )}
      <span>{status.online ? "آنلاین" : "آفلاین"}</span>
      {pendingCount > 0 && (
        <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>
          {pendingCount}
        </span>
      )}
      <style>{`@keyframes ihms-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}
