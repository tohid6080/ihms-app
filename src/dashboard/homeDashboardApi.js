import { sb, sbOk } from "../shared.js";

/**
 * Home Dashboard — data layer.
 * Self-contained: reads directly from the existing `anomalies` and
 * `contractors` tables via the shared sb() helper, without touching or
 * duplicating App.jsx's AnomalyList business logic. Personnel data is
 * reused directly from personnelApi.js (already exists).
 */

function anomalyFromRow(r) {
  return {
    id: r.id,
    trackingNumber: r.tracking_number || "",
    project: r.project || "",
    contractor: r.contractor || "",
    area: r.area || "",
    date: r.date || "",
    riskLevel: r.risk_level || "Med",
    status: r.status || "open",
    createdAt: r.created_at,
  };
}

export async function loadDashboardAnomalies() {
  const rows = await sb("anomalies?select=id,tracking_number,project,contractor,area,date,risk_level,status,created_at&order=created_at.desc&limit=1000");
  return (sbOk(rows) ? rows : []).map(anomalyFromRow);
}

export async function loadDashboardContractors() {
  const rows = await sb("contractors?select=*&order=name.asc");
  return sbOk(rows) ? rows : [];
}
