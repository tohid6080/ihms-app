import { sb, sbOk, sbErrMsg, uid } from "../shared.js";

/**
 * BowTie Risk Analysis — data access layer.
 *
 * Phase 2 scope: metadata CRUD only (title, hazard, top event, site,
 * department, status, version). The interactive canvas (threats,
 * consequences, barriers, node positions...) is Phase 3 and will add
 * its own tables + API functions here without touching this file's
 * existing exports.
 */

export const BOWTIE_STATUSES = [
  { value: "draft", label: "پیش‌نویس", color: "#5b6b7d", bg: "#eef1f5" },
  { value: "in_review", label: "در حال بررسی", color: "#b45309", bg: "#fef3c7" },
  { value: "approved", label: "تأیید شده", color: "#166534", bg: "#dcfce7" },
  { value: "archived", label: "بایگانی", color: "#475569", bg: "#f1f5f9" },
];

export function bowtieStatusMeta(status) {
  return BOWTIE_STATUSES.find((s) => s.value === status) || BOWTIE_STATUSES[0];
}

function bowtieFromRow(r) {
  return {
    id: r.id,
    title: r.title || "",
    hazard: r.hazard || "",
    topEvent: r.top_event || "",
    site: r.site || "",
    department: r.department || "",
    status: r.status || "draft",
    version: r.version || 1,
    createdBy: r.created_by || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function loadBowties() {
  const rows = await sb("bowties?select=*&order=updated_at.desc");
  return (sbOk(rows) ? rows : []).map(bowtieFromRow);
}

export async function insertBowtie(rec) {
  const id = uid("bowtie");
  const body = [{
    id,
    title: rec.title,
    hazard: rec.hazard || "",
    top_event: rec.topEvent || "",
    site: rec.site || "",
    department: rec.department || "",
    status: "draft",
    version: 1,
    created_by: rec.createdBy || "",
  }];
  const rows = await sb("bowties", { method: "POST", body: JSON.stringify(body) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return bowtieFromRow(rows[0]);
}

export async function updateBowtieDB(id, patch) {
  const dbPatch = { updated_at: new Date().toISOString() };
  if ("title" in patch) dbPatch.title = patch.title;
  if ("hazard" in patch) dbPatch.hazard = patch.hazard;
  if ("topEvent" in patch) dbPatch.top_event = patch.topEvent;
  if ("site" in patch) dbPatch.site = patch.site;
  if ("department" in patch) dbPatch.department = patch.department;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("version" in patch) dbPatch.version = patch.version;
  const rows = await sb(`bowties?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return bowtieFromRow(rows[0]);
}

export async function deleteBowtieDB(id) {
  await sb(`bowties?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

// ==========================================================
// Phase 3 — Canvas: Threats, Consequences, Barriers
// ==========================================================

export const CRITICALITY_LEVELS = [
  { value: "low", label: "پایین", color: "#166534" },
  { value: "medium", label: "متوسط", color: "#b45309" },
  { value: "high", label: "بالا", color: "#c92a2a" },
];

export const BARRIER_STATUS = [
  { value: "green", label: "سالم", color: "#16a34a" },
  { value: "yellow", label: "نیازمند بررسی", color: "#d97706" },
  { value: "red", label: "ناقص/خراب", color: "#dc2626" },
];

function threatFromRow(r) {
  return { id: r.id, bowtieId: r.bowtie_id, label: r.label || "", orderIndex: r.order_index || 0, posX: r.pos_x || 0, posY: r.pos_y || 0 };
}
function consequenceFromRow(r) {
  return { id: r.id, bowtieId: r.bowtie_id, label: r.label || "", orderIndex: r.order_index || 0, posX: r.pos_x || 0, posY: r.pos_y || 0 };
}
function barrierFromRow(r) {
  return {
    id: r.id,
    bowtieId: r.bowtie_id,
    side: r.side,
    threatId: r.threat_id || null,
    consequenceId: r.consequence_id || null,
    orderIndex: r.order_index || 0,
    label: r.label || "",
    owner: r.owner || "",
    criticality: r.criticality || "medium",
    status: r.status || "green",
    verificationDate: r.verification_date || "",
    isCriticalControl: !!r.is_critical_control,
    posX: r.pos_x || 0,
    posY: r.pos_y || 0,
  };
}

export async function loadBowtieCanvas(bowtieId) {
  const [threatRows, consRows, barrierRows] = await Promise.all([
    sb(`bowtie_threats?bowtie_id=eq.${bowtieId}&select=*&order=order_index.asc`),
    sb(`bowtie_consequences?bowtie_id=eq.${bowtieId}&select=*&order=order_index.asc`),
    sb(`bowtie_barriers?bowtie_id=eq.${bowtieId}&select=*&order=order_index.asc`),
  ]);
  const barriers = (sbOk(barrierRows) ? barrierRows : []).map(barrierFromRow);
  const barrierIds = barriers.map((b) => b.id);

  let escFactors = [];
  let escControls = [];
  if (barrierIds.length > 0) {
    const idList = barrierIds.join(",");
    const escFactorRows = await sb(`bowtie_escalation_factors?barrier_id=in.(${idList})&select=*&order=order_index.asc`);
    escFactors = (sbOk(escFactorRows) ? escFactorRows : []).map(escFactorFromRow);
    const factorIds = escFactors.map((f) => f.id);
    if (factorIds.length > 0) {
      const escControlRows = await sb(`bowtie_escalation_controls?escalation_factor_id=in.(${factorIds.join(",")})&select=*&order=order_index.asc`);
      escControls = (sbOk(escControlRows) ? escControlRows : []).map(escControlFromRow);
    }
  }

  return {
    threats: (sbOk(threatRows) ? threatRows : []).map(threatFromRow),
    consequences: (sbOk(consRows) ? consRows : []).map(consequenceFromRow),
    barriers,
    escalationFactors: escFactors,
    escalationControls: escControls,
  };
}

export async function insertThreat(bowtieId, label, orderIndex) {
  const id = uid("threat");
  const rows = await sb("bowtie_threats", { method: "POST", body: JSON.stringify([{ id, bowtie_id: bowtieId, label, order_index: orderIndex }]) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return threatFromRow(rows[0]);
}
export async function updateThreatDB(id, patch) {
  const dbPatch = {};
  if ("label" in patch) dbPatch.label = patch.label;
  if ("posX" in patch) dbPatch.pos_x = patch.posX;
  if ("posY" in patch) dbPatch.pos_y = patch.posY;
  const rows = await sb(`bowtie_threats?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return threatFromRow(rows[0]);
}
export async function deleteThreatDB(id) {
  await sb(`bowtie_threats?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function insertConsequence(bowtieId, label, orderIndex) {
  const id = uid("cons");
  const rows = await sb("bowtie_consequences", { method: "POST", body: JSON.stringify([{ id, bowtie_id: bowtieId, label, order_index: orderIndex }]) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return consequenceFromRow(rows[0]);
}
export async function updateConsequenceDB(id, patch) {
  const dbPatch = {};
  if ("label" in patch) dbPatch.label = patch.label;
  if ("posX" in patch) dbPatch.pos_x = patch.posX;
  if ("posY" in patch) dbPatch.pos_y = patch.posY;
  const rows = await sb(`bowtie_consequences?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return consequenceFromRow(rows[0]);
}
export async function deleteConsequenceDB(id) {
  await sb(`bowtie_consequences?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function insertBarrier(rec) {
  const id = uid("barrier");
  const body = [{
    id,
    bowtie_id: rec.bowtieId,
    side: rec.side,
    threat_id: rec.threatId || null,
    consequence_id: rec.consequenceId || null,
    order_index: rec.orderIndex || 0,
    label: rec.label,
    owner: rec.owner || "",
    criticality: rec.criticality || "medium",
    status: rec.status || "green",
    verification_date: rec.verificationDate || null,
    is_critical_control: !!rec.isCriticalControl,
  }];
  const rows = await sb("bowtie_barriers", { method: "POST", body: JSON.stringify(body) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return barrierFromRow(rows[0]);
}
export async function updateBarrierDB(id, patch) {
  const dbPatch = {};
  if ("label" in patch) dbPatch.label = patch.label;
  if ("owner" in patch) dbPatch.owner = patch.owner;
  if ("criticality" in patch) dbPatch.criticality = patch.criticality;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("verificationDate" in patch) dbPatch.verification_date = patch.verificationDate || null;
  if ("isCriticalControl" in patch) dbPatch.is_critical_control = patch.isCriticalControl;
  if ("posX" in patch) dbPatch.pos_x = patch.posX;
  if ("posY" in patch) dbPatch.pos_y = patch.posY;
  const rows = await sb(`bowtie_barriers?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return barrierFromRow(rows[0]);
}
export async function deleteBarrierDB(id) {
  await sb(`bowtie_barriers?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

// ==========================================================
// Phase 4 — Escalation Factors & Escalation Controls
// ==========================================================

function escFactorFromRow(r) {
  return { id: r.id, barrierId: r.barrier_id, label: r.label || "", orderIndex: r.order_index || 0, posX: r.pos_x || 0, posY: r.pos_y || 0 };
}
function escControlFromRow(r) {
  return {
    id: r.id, escalationFactorId: r.escalation_factor_id, label: r.label || "",
    owner: r.owner || "", status: r.status || "green", orderIndex: r.order_index || 0,
    posX: r.pos_x || 0, posY: r.pos_y || 0,
  };
}

export async function insertEscalationFactor(barrierId, label, orderIndex) {
  const id = uid("escf");
  const rows = await sb("bowtie_escalation_factors", { method: "POST", body: JSON.stringify([{ id, barrier_id: barrierId, label, order_index: orderIndex }]) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return escFactorFromRow(rows[0]);
}
export async function updateEscalationFactorDB(id, patch) {
  const dbPatch = {};
  if ("label" in patch) dbPatch.label = patch.label;
  if ("posX" in patch) dbPatch.pos_x = patch.posX;
  if ("posY" in patch) dbPatch.pos_y = patch.posY;
  const rows = await sb(`bowtie_escalation_factors?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return escFactorFromRow(rows[0]);
}
export async function deleteEscalationFactorDB(id) {
  await sb(`bowtie_escalation_factors?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function insertEscalationControl(escalationFactorId, label, orderIndex) {
  const id = uid("escc");
  const rows = await sb("bowtie_escalation_controls", { method: "POST", body: JSON.stringify([{ id, escalation_factor_id: escalationFactorId, label, order_index: orderIndex }]) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return escControlFromRow(rows[0]);
}
export async function updateEscalationControlDB(id, patch) {
  const dbPatch = {};
  if ("label" in patch) dbPatch.label = patch.label;
  if ("owner" in patch) dbPatch.owner = patch.owner;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("posX" in patch) dbPatch.pos_x = patch.posX;
  if ("posY" in patch) dbPatch.pos_y = patch.posY;
  const rows = await sb(`bowtie_escalation_controls?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return escControlFromRow(rows[0]);
}
export async function deleteEscalationControlDB(id) {
  await sb(`bowtie_escalation_controls?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}
