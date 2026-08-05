import { sb, sbOk, getCurrentCompanyId } from "../shared.js";

/**
 * Training matrix — a course × job-position grid, same shape as the paper
 * matrix (ردیف = دوره، ستون = عنوان شغلی، خانه‌ی خاکستری = الزامی).
 * Requirements are looked up LIVE by job title text match against
 * job_positions.title (personnel.job_title is free text, matching the
 * existing pattern the app already uses — see CLAUDE.md), not stored on
 * the personnel row. That way, editing the matrix later is immediately
 * reflected for every existing person with that job title — nothing goes
 * stale or needs a manual "recalculate" step.
 */

function courseFromRow(r) {
  return { id: r.id, title: r.title, description: r.description || "", isActive: r.is_active !== false, orderIndex: r.order_index || 0 };
}

export async function loadTrainingCourses(includeInactive = true) {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const activeFilter = includeInactive ? "" : "&is_active=eq.true";
  const rows = await sb(`training_courses?select=*&order=order_index.asc${filter}${activeFilter}`);
  return (sbOk(rows) ? rows : []).map(courseFromRow);
}

export async function createTrainingCourse(title, description) {
  const companyId = getCurrentCompanyId();
  const existing = await sb(`training_courses?select=order_index&order=order_index.desc&limit=1${companyId ? `&company_id=eq.${companyId}` : ""}`);
  const nextOrder = sbOk(existing) && existing.length > 0 ? (existing[0].order_index || 0) + 1 : 1;
  const rows = await sb("training_courses", { method: "POST", body: JSON.stringify([{ title: title.trim(), description: description || "", order_index: nextOrder, company_id: companyId }]) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت دوره" };
  return courseFromRow(rows[0]);
}

export async function updateTrainingCourse(id, patch) {
  const dbPatch = {};
  if ("title" in patch) dbPatch.title = patch.title;
  if ("description" in patch) dbPatch.description = patch.description;
  if ("isActive" in patch) dbPatch.is_active = patch.isActive;
  const rows = await sb(`training_courses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌سازی" };
  return courseFromRow(rows[0]);
}

export async function deleteTrainingCourse(id) {
  await sb(`training_requirements?training_id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  const result = await sb(`training_courses?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
  if (result?.__error) return { __error: true, message: result.message || "خطا در حذف" };
  return { ok: true };
}

// ---------- ماتریس دوره × عنوان شغلی ----------

export async function loadRequirementsMatrix() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`training_requirements?select=training_id,job_position_id${filter}`);
  return sbOk(rows) ? rows.map((r) => ({ trainingId: r.training_id, jobPositionId: r.job_position_id })) : [];
}

export async function setRequirement(trainingId, jobPositionId, required) {
  if (required) {
    const existing = await sb(`training_requirements?training_id=eq.${trainingId}&job_position_id=eq.${jobPositionId}&select=id`);
    if (sbOk(existing) && existing.length > 0) return { ok: true };
    const result = await sb("training_requirements", { method: "POST", body: JSON.stringify([{ training_id: trainingId, job_position_id: jobPositionId, company_id: getCurrentCompanyId() }]), prefer: "return=minimal" });
    if (result?.__error) return { __error: true, message: "خطا در ذخیره‌سازی" };
    return { ok: true };
  }
  await sb(`training_requirements?training_id=eq.${trainingId}&job_position_id=eq.${jobPositionId}`, { method: "DELETE", prefer: "return=minimal" });
  return { ok: true };
}

// ---------- آموزش‌های موردنیاز یک عنوان شغلی خاص (برای ماژول پرسنل) ----------

export async function loadRequiredTrainingsForJobTitle(jobTitle) {
  if (!jobTitle) return [];
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const posRows = await sb(`job_positions?title=eq.${encodeURIComponent(jobTitle)}&select=id${filter}`);
  if (!sbOk(posRows) || posRows.length === 0) return [];
  const positionId = posRows[0].id;
  const reqRows = await sb(`training_requirements?job_position_id=eq.${positionId}&select=training_courses(id,title,description,is_active)`);
  if (!sbOk(reqRows)) return [];
  return reqRows
    .map((r) => r.training_courses)
    .filter((c) => c && c.is_active !== false)
    .map((c) => ({ id: c.id, title: c.title, description: c.description || "" }));
}
