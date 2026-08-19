import { sb, sbOk, uid, getCurrentCompanyId } from "../shared.js";
import { getIncidentForTripod, computeTripodCandidateFlag } from "./incidentSource.js";

/**
 * پورت وفادار از routes/analyses.py + services/workflow.py + services/tree.py.
 * هیچ منطقی (گردش‌کار، فیلتر آبشاری گروه، آستانه‌های خروجی علل ریشه‌ای)
 * تغییر نکرده — فقط از SQLite/Flask به Supabase/React منتقل شده.
 */

const PATH_COUNT = 4;

// ---------- گردش‌کار — عیناً از services/workflow.py ----------

export const TRANSITIONS = {
  "NOT_REQUIRED|request": "REQUESTED",
  "CANDIDATE|request": "REQUESTED",
  "REQUESTED|start": "IN_PROGRESS",
  "IN_PROGRESS|submit": "SUBMITTED",
  "SUBMITTED|_auto_forward": "EMPLOYER_REVIEW",
  "EMPLOYER_REVIEW|approve": "APPROVED",
  "EMPLOYER_REVIEW|reject": "REJECTED",
  "REJECTED|revise": "IN_PROGRESS",
  "APPROVED|_auto_finalize": "FINAL",
};
export const ACTION_REQUIRED_ROLE = { request: "EMPLOYER", start: "CONTRACTOR", submit: "CONTRACTOR", approve: "EMPLOYER", reject: "EMPLOYER", revise: "CONTRACTOR" };
export const EDITABLE_STATUSES = new Set(["NOT_REQUIRED", "CANDIDATE", "REQUESTED", "IN_PROGRESS"]);
export const TRIPOD_STATUS_LABELS = {
  NOT_REQUIRED: "نیازی نیست", CANDIDATE: "کاندید تحلیل", REQUESTED: "درخواست‌شده",
  IN_PROGRESS: "در حال تحلیل", SUBMITTED: "ارسال‌شده", EMPLOYER_REVIEW: "در حال بازبینی کارفرما",
  APPROVED: "تأییدشده", REJECTED: "ردشده", FINAL: "نهایی",
};

function analysisFromRow(r) {
  return {
    id: r.id,
    incidentId: r.incident_id,
    status: r.status,
    isLocked: !!r.is_locked,
    eventDescription: r.event_description || "",
    hazardDescription: r.hazard_description || "",
    requestedBy: r.requested_by || "",
    requestedAt: r.requested_at,
    contractorOrg: r.contractor_org || "",
    submittedBy: r.submitted_by || "",
    submittedAt: r.submitted_at,
    employerReviewedBy: r.employer_reviewed_by || "",
    employerReviewedAt: r.employer_reviewed_at,
    rejectionReason: r.rejection_reason || "",
    approvedBy: r.approved_by || "",
    approvedAt: r.approved_at,
    createdAt: r.created_at,
  };
}

export async function loadAnalysisForIncident(incidentId) {
  const rows = await sb(`tripod_analyses?incident_id=eq.${incidentId}&select=*`);
  return sbOk(rows) && rows.length > 0 ? analysisFromRow(rows[0]) : null;
}

export async function loadAnalysisById(analysisId) {
  const rows = await sb(`tripod_analyses?id=eq.${analysisId}&select=*`);
  return sbOk(rows) && rows.length > 0 ? analysisFromRow(rows[0]) : null;
}

// معادل create_analysis
export async function createOrGetAnalysis(incidentId) {
  const existing = await loadAnalysisForIncident(incidentId);
  if (existing) return existing;

  const incident = await getIncidentForTripod(incidentId);
  if (!incident) return { __error: true, message: "حادثه یافت نشد" };

  const companyId = getCurrentCompanyId();
  const status = computeTripodCandidateFlag(incident) ? "CANDIDATE" : "NOT_REQUIRED";
  const analysisId = uid("tripod");

  const payload = {
    id: analysisId, incident_id: incidentId, company_id: companyId, status,
    event_description: incident.description || null, contractor_org: incident.contractorOrg || null,
  };
  const rows = await sb("tripod_analyses", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ایجاد تحلیل" };

  const branchPayload = Array.from({ length: PATH_COUNT }, (_, i) => ({
    id: uid("branch"), analysis_id: analysisId, company_id: companyId, path_no: i + 1,
  }));
  await sb("tripod_branches", { method: "POST", body: JSON.stringify(branchPayload), prefer: "return=minimal" });

  await logHistory(analysisId, null, status, null, "ایجاد خودکار تحلیل بر اساس گزارش حادثه");
  return analysisFromRow(rows[0]);
}

async function logHistory(analysisId, fromStatus, toStatus, changedBy, note) {
  await sb("tripod_status_history", {
    method: "POST",
    body: JSON.stringify([{ id: uid("hist"), analysis_id: analysisId, company_id: getCurrentCompanyId(), from_status: fromStatus, to_status: toStatus, changed_by: changedBy || "", note: note || null }]),
    prefer: "return=minimal",
  });
}

// ---------- انتقال‌های گردش‌کار — عیناً از _do_transition در routes/analyses.py ----------

export async function transitionAnalysis(analysisId, action, role, actorName, reason) {
  const current = await loadAnalysisById(analysisId);
  if (!current) return { __error: true, message: "تحلیل یافت نشد" };

  const requiredRole = ACTION_REQUIRED_ROLE[action];
  if (requiredRole && role !== requiredRole && role !== "ADMIN") {
    return { __error: true, message: `این عملیات فقط توسط نقش «${requiredRole === "EMPLOYER" ? "کارفرما" : "پیمانکار"}» قابل انجام است.` };
  }
  const toStatus = TRANSITIONS[`${current.status}|${action}`];
  if (!toStatus) {
    return { __error: true, message: `انتقال نامعتبر: نمی‌توان از وضعیت «${TRIPOD_STATUS_LABELS[current.status]}» با این عملیات حرکت کرد.` };
  }
  if (action === "reject" && !reason) {
    return { __error: true, message: "ثبت علت رد الزامی است." };
  }

  const nowIso = new Date().toISOString();
  const updates = { status: toStatus, updated_at: nowIso };
  if (action === "request") { updates.requested_by = actorName; updates.requested_at = nowIso; }
  else if (action === "submit") { updates.submitted_by = actorName; updates.submitted_at = nowIso; }
  else if (action === "approve") { updates.employer_reviewed_by = actorName; updates.employer_reviewed_at = nowIso; updates.approved_by = actorName; updates.approved_at = nowIso; updates.is_locked = true; }
  else if (action === "reject") { updates.employer_reviewed_by = actorName; updates.employer_reviewed_at = nowIso; updates.rejection_reason = reason; }

  const rows = await sb(`tripod_analyses?id=eq.${analysisId}`, { method: "PATCH", body: JSON.stringify(updates) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در انجام عملیات" };
  await logHistory(analysisId, current.status, toStatus, actorName);

  // پرش‌های خودکار — دقیقاً مثل نسخه‌ی اصلی
  if (toStatus === "SUBMITTED") {
    const auto = TRANSITIONS["SUBMITTED|_auto_forward"];
    await sb(`tripod_analyses?id=eq.${analysisId}`, { method: "PATCH", body: JSON.stringify({ status: auto, updated_at: new Date().toISOString() }) });
    await logHistory(analysisId, "SUBMITTED", auto, null, "ارجاع خودکار جهت بازبینی کارفرما");
    return loadAnalysisById(analysisId);
  }
  if (toStatus === "APPROVED") {
    const auto = TRANSITIONS["APPROVED|_auto_finalize"];
    await sb(`tripod_analyses?id=eq.${analysisId}`, { method: "PATCH", body: JSON.stringify({ status: auto, is_locked: true, updated_at: new Date().toISOString() }) });
    await logHistory(analysisId, "APPROVED", auto, actorName, "نهایی‌سازی و قفل شدن تحلیل");
    return loadAnalysisById(analysisId);
  }
  return loadAnalysisById(analysisId);
}

export async function loadHistory(analysisId) {
  const rows = await sb(`tripod_status_history?analysis_id=eq.${analysisId}&select=*&order=changed_at.asc`);
  return sbOk(rows) ? rows.map((r) => ({ id: r.id, fromStatus: r.from_status, toStatus: r.to_status, changedBy: r.changed_by || "", changedAt: r.changed_at, note: r.note || "" })) : [];
}

// ---------- ویرایش رویداد/خطر ----------

export async function updateAnalysisFields(analysisId, fields) {
  const rows = await sb(`tripod_analyses?id=eq.${analysisId}`, { method: "PATCH", body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی" };
  return analysisFromRow(rows[0]);
}

// ---------- اهداف (Targets) ----------

export async function loadTargets(analysisId) {
  const rows = await sb(`tripod_targets?analysis_id=eq.${analysisId}&select=*,tripod_ref_target_category(title_fa)`);
  return sbOk(rows) ? rows.map((r) => ({ id: r.id, categoryCode: r.category_code, categoryTitle: r.tripod_ref_target_category?.title_fa || r.category_code, description: r.description || "" })) : [];
}
export async function addTarget(analysisId, categoryCode, description) {
  const rows = await sb("tripod_targets", { method: "POST", body: JSON.stringify([{ id: uid("target"), analysis_id: analysisId, company_id: getCurrentCompanyId(), category_code: categoryCode, description: description || null }]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در افزودن هدف" };
  return { ok: true };
}
export async function deleteTarget(targetId) {
  await sb(`tripod_targets?id=eq.${targetId}`, { method: "DELETE", prefer: "return=minimal" });
  return { ok: true };
}

// ---------- مسیرها (Branches) — همیشه دقیقاً ۴ عدد، فقط ویرایش می‌شوند ----------

export async function loadBranchesWithDetails(analysisId) {
  const branches = await sb(`tripod_branches?analysis_id=eq.${analysisId}&select=*&order=path_no.asc`);
  if (!sbOk(branches)) return [];
  const result = [];
  for (const b of branches) {
    const preconds = await sb(`tripod_branch_preconditions?branch_id=eq.${b.id}&select=*,tripod_ref_precondition(code,text_fa,group_no)`);
    const preList = sbOk(preconds) ? preconds.map((p) => ({
      id: p.id, preconditionId: p.precondition_id, note: p.note || "",
      code: p.tripod_ref_precondition?.code, text: p.tripod_ref_precondition?.text_fa, groupNo: p.tripod_ref_precondition?.group_no,
    })) : [];

    const hiddens = await sb(`tripod_branch_hidden_failures?branch_id=eq.${b.id}&select=*,tripod_ref_hidden_failure(code,text_fa,group_no,brf_code)`);
    const hidList = sbOk(hiddens) ? hiddens.map((h) => ({
      id: h.id, hiddenFailureId: h.hidden_failure_id, preconditionLinkId: h.precondition_link_id, note: h.note || "",
      code: h.tripod_ref_hidden_failure?.code, text: h.tripod_ref_hidden_failure?.text_fa, groupNo: h.tripod_ref_hidden_failure?.group_no, brfCode: h.tripod_ref_hidden_failure?.brf_code,
    })) : [];

    for (const p of preList) p.hiddenFailures = hidList.filter((h) => h.preconditionLinkId === p.id);

    result.push({
      id: b.id, pathNo: b.path_no, surfaceFailureType: b.surface_failure_type || "", surfaceFailureText: b.surface_failure_text || "",
      preconditions: preList,
    });
  }
  return result;
}

export async function updateBranch(branchId, fields) {
  const payload = {};
  if ("surfaceFailureType" in fields) payload.surface_failure_type = fields.surfaceFailureType || null;
  if ("surfaceFailureText" in fields) payload.surface_failure_text = fields.surfaceFailureText || null;
  const rows = await sb(`tripod_branches?id=eq.${branchId}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی مسیر" };
  return { ok: true };
}

export async function addBranchPrecondition(branchId, preconditionId, note) {
  const rows = await sb("tripod_branch_preconditions", { method: "POST", body: JSON.stringify([{ id: uid("bp"), branch_id: branchId, company_id: getCurrentCompanyId(), precondition_id: preconditionId, note: note || null }]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در افزودن پیش‌شرط" };
  return { ok: true };
}
export async function deleteBranchPrecondition(bpId) {
  await sb(`tripod_branch_preconditions?id=eq.${bpId}`, { method: "DELETE", prefer: "return=minimal" });
  return { ok: true };
}

// معادل add_hidden_failure_for_precondition — قید هم‌گروه‌بودن سمت
// کلاینت هم چک می‌شود (سمت UI اصلاً گزینه‌ی گروه دیگر را نشان نمی‌دهد)،
// ولی همین‌جا هم دوباره صریح چک می‌شود تا از هر مسیر ارسال داده‌ی نامعتبر جلوگیری شود.
export async function addBranchHiddenFailure(branchId, preconditionLinkId, hiddenFailureId, preconditionGroupNo, hiddenFailureGroupNo, note) {
  if (preconditionGroupNo !== hiddenFailureGroupNo) {
    return { __error: true, message: "اشکال پنهان انتخابی باید از همان دسته (گروه) پیش‌شرط باشد." };
  }
  const rows = await sb("tripod_branch_hidden_failures", {
    method: "POST",
    body: JSON.stringify([{ id: uid("bhf"), branch_id: branchId, company_id: getCurrentCompanyId(), hidden_failure_id: hiddenFailureId, precondition_link_id: preconditionLinkId, note: note || null }]),
  });
  if (!sbOk(rows)) return { __error: true, message: "خطا در افزودن اشکال پنهان" };
  return { ok: true };
}
export async function deleteBranchHiddenFailure(bhfId) {
  await sb(`tripod_branch_hidden_failures?id=eq.${bhfId}`, { method: "DELETE", prefer: "return=minimal" });
  return { ok: true };
}

// ---------- خروجی‌های علل ریشه‌ای — عیناً از services/tree.py::root_cause_summary ----------

export async function loadRootCauseSummary(analysisId) {
  const branches = await loadBranchesWithDetails(analysisId);
  // شمارش تعداد مسیرهای مستقلی که هر کد اشکال پنهان در آن‌ها تکرار شده
  const codeCount = new Map(); // code -> {text, brfCode, groupNo, branchIds:Set}
  const brfCount = new Map(); // brfCode -> {count, nameEn}

  for (const b of branches) {
    for (const p of b.preconditions) {
      for (const h of p.hiddenFailures) {
        if (!codeCount.has(h.code)) codeCount.set(h.code, { text: h.text, brfCode: h.brfCode, groupNo: h.groupNo, branchIds: new Set() });
        codeCount.get(h.code).branchIds.add(b.id);

        const brf = h.brfCode || null;
        if (!brfCount.has(brf)) brfCount.set(brf, 0);
        brfCount.set(brf, brfCount.get(brf) + 1);
      }
    }
  }

  // خروجی ۲: فقط کدهایی که در >=۲ مسیر مستقل تکرار شده‌اند
  const byHiddenFailureCode = [];
  for (const [code, info] of codeCount.entries()) {
    const branchCount = info.branchIds.size;
    if (branchCount < 2) continue;
    const classification = branchCount >= 4 ? "root_cause" : branchCount === 3 ? "major_issue" : "hidden_issue";
    const classificationFa = { root_cause: "علت ریشه‌ای", major_issue: "اشکال مهم", hidden_issue: "اشکال پنهان" }[classification];
    byHiddenFailureCode.push({ code, textFa: info.text, brfCode: info.brfCode, groupNo: info.groupNo, branchCount, classification, classificationFa });
  }
  byHiddenFailureCode.sort((a, b) => b.branchCount - a.branchCount || a.code.localeCompare(b.code));

  // خروجی ۱: مجموع تکرار هر دسته BRF — مستقل از خروجی ۲
  const brfRefRows = await sb("tripod_ref_brf_category?select=*");
  const brfMap = sbOk(brfRefRows) ? Object.fromEntries(brfRefRows.map((r) => [r.code, r])) : {};
  const byBrfCategory = [...brfCount.entries()]
    .map(([code, occurrences]) => ({ brfCode: code, occurrences, brfNameFa: brfMap[code]?.name_fa || code, brfNameEn: brfMap[code]?.name_en || "" }))
    .sort((a, b) => b.occurrences - a.occurrences);

  return { byHiddenFailureCode, byBrfCategory };
}

// ---------- اقدام اصلاحی مخصوص همین تحلیل (snapshot) — عیناً از routes/corrective_actions.py ----------

export async function loadTripodCorrectiveActions(analysisId) {
  const rows = await sb(`tripod_corrective_actions?analysis_id=eq.${analysisId}&select=*&order=created_at.desc`);
  return sbOk(rows) ? rows.map((r) => ({
    id: r.id, sourceType: r.source_type, brfCode: r.brf_code || "", hiddenFailureCode: r.hidden_failure_code || "",
    titleFa: r.title_fa, repeatCount: r.repeat_count, classification: r.classification || "",
    description: r.description, responsiblePerson: r.responsible_person, dueDate: r.due_date, status: r.status, createdAt: r.created_at,
  })) : [];
}

export async function createTripodCorrectiveAction(analysisId, rec, createdBy) {
  if (!rec.description?.trim() || !rec.responsiblePerson?.trim()) {
    return { __error: true, message: "شرح اقدام و مسئول اقدام الزامی است" };
  }
  const payload = {
    id: uid("tca"), analysis_id: analysisId, company_id: getCurrentCompanyId(),
    source_type: rec.sourceType, brf_code: rec.brfCode || null, hidden_failure_code: rec.hiddenFailureCode || null,
    title_fa: rec.titleFa, repeat_count: rec.repeatCount, classification: rec.classification || null,
    description: rec.description.trim(), responsible_person: rec.responsiblePerson.trim(),
    due_date: rec.dueDate || null, status: "OPEN", created_by: createdBy || "",
  };
  const rows = await sb("tripod_corrective_actions", { method: "POST", body: JSON.stringify([payload]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت اقدام اصلاحی" };
  return { ok: true };
}

export async function updateTripodCorrectiveActionStatus(caId, status) {
  const rows = await sb(`tripod_corrective_actions?id=eq.${caId}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در بروزرسانی وضعیت" };
  return { ok: true };
}

export const CA_STATUS_LABELS = { OPEN: "باز", IN_PROGRESS: "در حال انجام", DONE: "انجام‌شده", CANCELLED: "لغوشده" };

// معادل تابع قدیمی «درخواست» — نگه داشته شده برای سازگاری با صفحه‌ی جزئیات حادثه
export async function requestTripodAnalysis(analysisId, requestedBy) {
  return transitionAnalysis(analysisId, "request", "EMPLOYER", requestedBy);
}
