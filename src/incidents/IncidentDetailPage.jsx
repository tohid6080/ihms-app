import React, { useState, useEffect } from "react";
import { AlertTriangle, GitBranch, Send } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { INCIDENT_TYPES, loadIncidentById } from "./incidentsApi.js";
import { createOrGetAnalysis, loadAnalysisForIncident, requestTripodAnalysis, TRIPOD_STATUS_LABELS } from "../tripodBeta/tripodAnalysesApi.js";
import { computeTripodCandidateFlag } from "../tripodBeta/incidentSource.js";
import TripodAnalysisWorkspace from "../tripodBeta/TripodAnalysisWorkspace.jsx";
import BarrierMappingPicker from "../bowtie/BarrierMappingPicker.jsx";

/**
 * صفحه‌ی جزئیات حادثه — شامل دکمه‌ی «درخواست تحلیل Tripod Beta» طبق بخش ۳
 * TRIPOD_BETA_INTEGRATION.md. به‌محض ایجاد/درخواست تحلیل، کاربر مستقیم
 * وارد فضای کار کامل تحلیل (مسیرها، درخت، علل ریشه‌ای) می‌شود.
 */
export default function IncidentDetailPage({ incidentId, currentUser, role, readOnly, onBack }) {
  const [incident, setIncident] = useState(undefined);
  const [analysis, setAnalysis] = useState(undefined);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [openWorkspace, setOpenWorkspace] = useState(false);

  const isEmployerSide = role === "EMPLOYER" || role === "ADMIN";

  const load = async () => {
    const [inc, a] = await Promise.all([loadIncidentById(incidentId), loadAnalysisForIncident(incidentId)]);
    setIncident(inc);
    setAnalysis(a);
  };
  useEffect(() => { load(); }, [incidentId]);

  if (incident === undefined || analysis === undefined) return <p style={{ color: THEME.text3, textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>;
  if (!incident) return <p style={{ color: THEME.danger, textAlign: "center", padding: 40 }}>حادثه یافت نشد.</p>;

  if (openWorkspace && analysis) {
    return <TripodAnalysisWorkspace analysisId={analysis.id} incident={incident} currentUser={currentUser} role={role} onBack={() => { setOpenWorkspace(false); load(); }} />;
  }

  const isCandidate = computeTripodCandidateFlag(incident);
  const typeLabel = INCIDENT_TYPES.find((t) => t.value === incident.incidentType)?.label || incident.incidentType;

  const handleRequestAnalysis = async () => {
    setError("");
    setRequesting(true);
    let a = analysis;
    if (!a) {
      const created = await createOrGetAnalysis(incidentId);
      if (created?.__error) { setError(created.message); setRequesting(false); return; }
      a = created;
    }
    if (a.status === "NOT_REQUIRED" || a.status === "CANDIDATE") {
      const result = await requestTripodAnalysis(a.id, currentUser?.name);
      if (result?.__error) { setError(result.message); setRequesting(false); return; }
      a = result;
    }
    setAnalysis(a);
    setRequesting(false);
    setOpenWorkspace(true);
  };

  // دکمه‌ی درخواست فقط وقتی نشان داده می‌شود که هنوز تحلیلی درخواست نشده
  const showRequestButton = isEmployerSide && !readOnly && (!analysis || analysis.status === "NOT_REQUIRED" || analysis.status === "CANDIDATE");
  // اگر تحلیل از قبل درخواست/شروع شده، دکمه‌ی ورود به فضای کار نشان داده می‌شود
  const showOpenButton = !!analysis && analysis.status !== "NOT_REQUIRED" && analysis.status !== "CANDIDATE";

  return (
    <div>
      <div style={styles.backLink} onClick={onBack}>بازگشت</div>
      <h2 style={{ fontSize: 18, color: THEME.navy, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={20} color={THEME.teal} /> حادثه‌ی {incident.incidentNo}
      </h2>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18 }}>{toJalaliSafe(incident.occurredAt)} — {typeLabel}</p>

      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, fontSize: 13 }}>
          <Field label="محل وقوع" value={incident.location} />
          <Field label="ناتوان‌کننده" value={incident.isDisabling ? "بله" : "خیر"} />
          <Field label="روزهای از‌کارافتادگی" value={incident.lostDays} />
          <Field label="نام مصدوم" value={incident.injuredPersonName} />
          <Field label="هزینه مالی" value={incident.financialCost != null ? incident.financialCost.toLocaleString("fa-IR") : ""} />
          <Field label="شرکت کارفرما" value={incident.employerOrg} />
          <Field label="شرکت پیمانکار" value={incident.contractorOrg} />
        </div>
        {incident.description && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: THEME.text3, marginBottom: 4 }}>شرح حادثه</div>
            <p style={{ fontSize: 13, color: THEME.text, lineHeight: 1.9, margin: 0 }}>{incident.description}</p>
          </div>
        )}
      </div>

      <div style={{ background: isCandidate ? "#fff7ed" : THEME.surface, border: `1px solid ${isCandidate ? "#fdba74" : THEME.border}`, borderRadius: 12, padding: 18 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <GitBranch size={15} /> تحلیل حادثه Tripod Beta
        </h3>
        {isCandidate && !analysis && (
          <p style={{ fontSize: 12, color: "#7c2d12", marginBottom: 10, lineHeight: 1.8 }}>
            این حادثه ناتوان‌کننده با بیش از ۳ روز از‌کارافتادگی است — طبق روش تریپاد بتا، کاندید تحلیل ریشه‌ای است.
          </p>
        )}
        {analysis && (
          <p style={{ fontSize: 13, color: THEME.text2, marginBottom: 10 }}>
            وضعیت فعلی: <b style={{ color: THEME.navy }}>{TRIPOD_STATUS_LABELS[analysis.status] || analysis.status}</b>
          </p>
        )}
        {error && <p style={styles.error}>{error}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {showRequestButton && (
            <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6, background: THEME.teal }} onClick={handleRequestAnalysis} disabled={requesting}>
              <Send size={13} /> {requesting ? "در حال ثبت..." : "درخواست تحلیل Tripod Beta"}
            </button>
          )}
          {showOpenButton && (
            <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpenWorkspace(true)}>
              <GitBranch size={13} /> ورود به فضای کار تحلیل
            </button>
          )}
        </div>
        {!showRequestButton && !analysis && !isEmployerSide && (
          <p style={{ fontSize: 12, color: THEME.text3 }}>درخواست تحلیل فقط توسط کارفرما/ادمین انجام می‌شود.</p>
        )}
      </div>

      {isEmployerSide && <BarrierMappingPicker sourceType="incident" sourceId={incidentId} currentUser={currentUser} readOnly={readOnly} />}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: THEME.text3, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: THEME.text, fontWeight: 600 }}>{value || "—"}</div>
    </div>
  );
}
