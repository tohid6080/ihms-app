import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

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
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`anomalies?select=id,tracking_number,project,contractor,area,date,risk_level,status,created_at&order=created_at.desc&limit=1000${filter}`);
  return (sbOk(rows) ? rows : []).map(anomalyFromRow);
}

export async function loadDashboardContractors() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`contractors?select=*&order=name.asc${filter}`);
  return sbOk(rows) ? rows : [];
}

export async function loadDashboardMachinery() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`machinery?select=id,contractor_id,contractor_name,machine_name,machine_type,approval_status,insurance_expiry,inspection_expiry,created_at${filter}`);
  return sbOk(rows) ? rows : [];
}

export async function loadDashboardScaffold() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`scaffold_tags?select=id,contractor_id,contractor_name,tag_number,status,issue_date,created_at${filter}`);
  return sbOk(rows) ? rows : [];
}

export async function loadDashboardBowties() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`bowties?select=id,status,site,department,created_at${filter}`);
  return sbOk(rows) ? rows : [];
}
