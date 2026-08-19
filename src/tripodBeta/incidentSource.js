import { loadIncidentById } from "../incidents/incidentsApi.js";

/**
 * معادل services/incident_source.py در پکیج اصلی — می‌خواند از جدول
 * واقعی incidents ماژول مدیریت حوادث IHMS (نه جدول استاب زیرماژول)،
 * دقیقاً با همان قرارداد فیلدها که services/workflow.py و tree.py انتظار
 * دارند: id, incident_no, occurred_at, location, incident_type,
 * is_disabling, injured_person_name, lost_days, financial_cost,
 * description, employer_org, contractor_org.
 */
export async function getIncidentForTripod(incidentId) {
  return loadIncidentById(incidentId);
}

// قانون فعال‌سازی خودکار — عیناً از services/workflow.py::compute_candidate_flag:
// حادثه‌ی ناتوان‌کننده + بیش از ۳ روز از‌کارافتادگی => کاندید تحلیل Tripod Beta
export function computeTripodCandidateFlag(incident) {
  return !!incident?.isDisabling && (Number(incident?.lostDays) || 0) > 3;
}
