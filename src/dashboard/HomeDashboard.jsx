import React, { useState, useEffect, useMemo } from "react";
import {
  Users, AlertTriangle, ShieldCheck, Building2, Truck, Tag, GitBranch,
  FileClock, Bell, TrendingUp, Sparkles, RadioTower,
} from "lucide-react";
import { THEME } from "../shared.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { loadPersonnelList, loadNotifications } from "../personnel/personnelApi.js";
import { loadDashboardAnomalies, loadDashboardContractors, loadDashboardMachinery, loadDashboardScaffold, loadDashboardBowties } from "./homeDashboardApi.js";
import { loadDashboardWidgetConfig } from "../systemConfigApi.js";

/**
 * Executive / management dashboard — rebuilt as a dense, single-screen
 * "Power BI style" overview rather than a long scroll of large cards. The
 * whole point: a project manager should be able to read it in under a
 * minute, on one screen, without opening any module.
 *
 * Every number here is computed from real rows already in the database —
 * "امتیاز HSE" and "تحلیل هوشمند" are rule-based summaries of that same
 * real data (not a separate AI service), described honestly as such if
 * asked, but presented the way the reference design asked for: short,
 * plain-language, decision-ready sentences.
 */

const norm = (s) => (s || "").trim().toLowerCase();
function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function HomeDashboard({ role, currentUser, onNavigate, onBack }) {
  const { t, dir } = useLanguage();
  const [personnel, setPersonnel] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [machinery, setMachinery] = useState([]);
  const [scaffold, setScaffold] = useState([]);
  const [bowties, setBowties] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [widgetVisibility, setWidgetVisibility] = useState(null); // null=هنوز بارگذاری‌نشده => fail-open، همه نمایش داده می‌شوند

  const isContractor = role === "CONTRACTOR";
  const myName = norm(currentUser?.name);

  useEffect(() => {
    (async () => {
      const [p, a, c, m, s, b] = await Promise.all([
        loadPersonnelList(), loadDashboardAnomalies(), loadDashboardContractors(),
        loadDashboardMachinery(), loadDashboardScaffold(), loadDashboardBowties(),
      ]);
      setPersonnel(p); setAnomalies(a); setContractors(c); setMachinery(m); setScaffold(s); setBowties(b);
      setNotifications(await loadNotifications(isContractor ? "contractor" : "employer"));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
    loadDashboardWidgetConfig().then((rows) => {
      if (rows.length > 0) setWidgetVisibility(Object.fromEntries(rows.map((r) => [r.widgetKey, r.isVisible])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // پیش‌فرض «نمایش داده شود» برای هر ویجتی که هنوز پیکربندی نشده (یا در
  // حال بارگذاری است) — تا رفتار فعلی سامانه هرگز رگرسیون نکند.
  const isWidgetVisible = (key) => widgetVisibility === null || widgetVisibility[key] !== false;

  const scopedPersonnel = useMemo(
    () => (isContractor ? personnel.filter((p) => norm(p.contractorName) === myName) : personnel),
    [personnel, isContractor, myName]
  );
  const scopedAnomalies = useMemo(
    () => (isContractor ? anomalies.filter((a) => norm(a.contractor) === myName) : anomalies),
    [anomalies, isContractor, myName]
  );
  const scopedMachinery = useMemo(
    () => (isContractor ? machinery.filter((m) => norm(m.contractor_name) === myName) : machinery),
    [machinery, isContractor, myName]
  );
  const scopedScaffold = useMemo(
    () => (isContractor ? scaffold.filter((t) => norm(t.contractor_name) === myName) : scaffold),
    [scaffold, isContractor, myName]
  );

  // ---------- ردیف بالا: خلاصه‌ی وضعیت پروژه ----------
  const summary = {
    contractors: contractors.length,
    activePersonnel: scopedPersonnel.filter((p) => p.status === "active").length,
    openAnomalies: scopedAnomalies.filter((a) => a.status !== "Closed").length,
    criticalAnomalies: scopedAnomalies.filter((a) => a.status !== "Closed" && a.riskLevel === "High").length,
    activeMachinery: scopedMachinery.filter((m) => m.approval_status === "approved").length,
    activeScaffold: scopedScaffold.filter((t) => t.status === "tag_issued").length,
    bowties: bowties.length,
    pendingDocs:
      scopedPersonnel.filter((p) => p.status === "pending_documents" || p.status === "pending_employer_review" || p.status === "pending_qualification").length +
      scopedMachinery.filter((m) => m.approval_status === "pending").length +
      scopedScaffold.filter((t) => t.status === "pending_initial_approval").length,
    notifications: notifications.length,
  };

  // ---------- جدول وضعیت HSE پیمانکاران ----------
  const contractorRows = useMemo(() => {
    return contractors.map((c) => {
      const cName = norm(c.name);
      const cPersonnel = personnel.filter((p) => p.contractorId === c.id);
      const cAnomaliesAll = anomalies.filter((a) => norm(a.contractor) === cName);
      const cAnomaliesOpen = cAnomaliesAll.filter((a) => a.status !== "Closed");
      const cMachinery = machinery.filter((m) => m.contractor_id === c.id);
      const cScaffold = scaffold.filter((t) => t.contractor_id === c.id);

      const needsHealth = cPersonnel.filter((p) => p.status === "pending_health_visit" || p.status === "pending_health_result" || p.status === "health_expired").length;
      const machineryFaulty = cMachinery.filter((m) => {
        if (m.approval_status === "needs_correction" || m.approval_status === "rejected") return true;
        const d1 = daysUntil(m.insurance_expiry), d2 = daysUntil(m.inspection_expiry);
        return (d1 !== null && d1 <= 0) || (d2 !== null && d2 <= 0);
      }).length;
      const scaffoldNeedsVisit = cScaffold.filter((t) => t.status === "pending_installation" || t.status === "needs_correction").length;

      const personnelRate = cPersonnel.length ? cPersonnel.filter((p) => p.status === "active").length / cPersonnel.length : 1;
      const anomalyRate = cAnomaliesAll.length ? cAnomaliesAll.filter((a) => a.status === "Closed").length / cAnomaliesAll.length : 1;
      const machineryRate = cMachinery.length ? cMachinery.filter((m) => m.approval_status === "approved").length / cMachinery.length : 1;
      const scaffoldRate = cScaffold.length ? cScaffold.filter((t) => t.status === "tag_issued" || t.status === "removed").length / cScaffold.length : 1;
      const score = Math.round((personnelRate * 0.3 + anomalyRate * 0.3 + machineryRate * 0.2 + scaffoldRate * 0.2) * 100);
      const level = score >= 80 ? "green" : score >= 50 ? "yellow" : "red";

      return { id: c.id, name: c.name, score, level, openAnomalies: cAnomaliesOpen.length, needsHealth, machineryFaulty, scaffoldNeedsVisit };
    }).sort((a, b) => a.score - b.score); // ضعیف‌ترین‌ها بالای جدول، جایی که توجه مدیر بیشتر لازمه
  }, [contractors, personnel, anomalies, machinery, scaffold]);

  // ---------- تحلیل هوشمند (قوانین ساده روی داده‌ی واقعی) ----------
  const insights = useMemo(() => {
    const list = [];
    const worstAnomaly = [...contractorRows].sort((a, b) => b.openAnomalies - a.openAnomalies)[0];
    if (worstAnomaly && worstAnomaly.openAnomalies > 0) {
      list.push({ type: "warn", text: `شرکت ${worstAnomaly.name} با ${worstAnomaly.openAnomalies} مورد، بیشترین تعداد آنومالی باز را دارد.` });
    }
    contractorRows.filter((c) => c.needsHealth > 0).slice(0, 2).forEach((c) => {
      list.push({ type: "warn", text: `شرکت ${c.name} دارای ${c.needsHealth} نفر نیازمند پیگیری طب کار است.` });
    });
    const expiredMachines = machinery.filter((m) => {
      const d1 = daysUntil(m.insurance_expiry), d2 = daysUntil(m.inspection_expiry);
      return (d1 !== null && d1 <= 0) || (d2 !== null && d2 <= 0);
    });
    if (expiredMachines.length > 0) {
      list.push({ type: "danger", text: `بیمه‌نامه یا سرتیفیکیت ${expiredMachines.length} دستگاه ماشین‌آلات منقضی شده است.` });
    }
    const best = [...contractorRows].filter((c) => c.score > 0).sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 80) {
      list.push({ type: "good", text: `عملکرد شرکت ${best.name} در رعایت الزامات HSE بسیار مناسب بوده است (امتیاز ${best.score}).` });
    }
    const correctionScaffold = contractorRows.filter((c) => c.scaffoldNeedsVisit > 0);
    if (correctionScaffold.length > 0) {
      list.push({ type: "warn", text: `${correctionScaffold.reduce((s, c) => s + c.scaffoldNeedsVisit, 0)} تگ داربست در انتظار بازدید یا نیازمند اصلاح است.` });
    }
    return list.slice(0, 6);
  }, [contractorRows, machinery]);

  // ---------- هشدارهای فوری (فقط مهم‌ترین‌ها) ----------
  const urgentAlerts = useMemo(() => {
    const list = [];
    scopedAnomalies.filter((a) => a.status !== "Closed" && a.riskLevel === "High").forEach((a) => {
      list.push({ severity: 3, text: `آنومالی بحرانی باز: ${a.trackingNumber || a.area} (${a.contractor})`, onClick: () => onNavigate({ module: "anomaly", riskFilter: "High" }) });
    });
    scopedPersonnel.filter((p) => p.status === "health_expired").forEach((p) => {
      list.push({ severity: 2, text: `طب کار منقضی: ${p.fullName} (${p.contractorName})`, onClick: () => onNavigate({ module: "personnel", statusFilter: "health_expired" }) });
    });
    scopedMachinery.filter((m) => {
      const d1 = daysUntil(m.insurance_expiry), d2 = daysUntil(m.inspection_expiry);
      return (d1 !== null && d1 <= 0) || (d2 !== null && d2 <= 0);
    }).forEach((m) => {
      list.push({ severity: 2, text: `مدارک منقضی‌شده: ${m.machine_name} (${m.contractor_name})`, onClick: () => onNavigate({ module: "machinery" }) });
    });
    return list.sort((a, b) => b.severity - a.severity).slice(0, 6);
  }, [scopedAnomalies, scopedPersonnel, scopedMachinery, onNavigate]);

  // ---------- داده‌ی نمودارها ----------
  const monthlyAnomalyTrend = useMemo(() => {
    const map = {};
    scopedAnomalies.forEach((a) => {
      const k = (a.date || a.createdAt || "").slice(0, 7);
      if (!k) return;
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [scopedAnomalies]);

  const healthStatusData = [
    { label: t("chartActive"), value: scopedPersonnel.filter((p) => p.status === "active").length, color: "#16a34a" },
    { label: t("chartNeedsVisit"), value: scopedPersonnel.filter((p) => p.status === "pending_health_visit" || p.status === "pending_health_result").length, color: "#d97706" },
    { label: t("chartExpired"), value: scopedPersonnel.filter((p) => p.status === "health_expired").length, color: "#c92a2a" },
  ];
  const machineryStatusData = [
    { label: t("chartApproved"), value: scopedMachinery.filter((m) => m.approval_status === "approved").length, color: "#16a34a" },
    { label: t("chartPending"), value: scopedMachinery.filter((m) => m.approval_status === "pending").length, color: "#d97706" },
    { label: t("chartNeedsCorrection"), value: scopedMachinery.filter((m) => m.approval_status === "needs_correction" || m.approval_status === "rejected").length, color: "#c92a2a" },
  ];
  const perfChartData = contractorRows.slice(0, 6).map((c) => ({ label: c.name, value: c.score, color: c.level === "green" ? "#16a34a" : c.level === "yellow" ? "#d97706" : "#c92a2a" }));
  const anomalyRiskData = [
    { label: t("chartHigh"), value: scopedAnomalies.filter((a) => a.riskLevel === "High").length, color: "#c92a2a" },
    { label: t("chartMed"), value: scopedAnomalies.filter((a) => a.riskLevel === "Med").length, color: "#d97706" },
    { label: t("chartLow"), value: scopedAnomalies.filter((a) => a.riskLevel === "Low").length, color: "#16a34a" },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: THEME.text3, direction: dir }}>{t("loadingDashboard")}</div>;

  return (
    <div style={{ background: THEME.bg, minHeight: "100%", direction: dir }}>
      <div style={{ background: THEME.navy, color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && <div style={{ cursor: "pointer", fontSize: 12.5, opacity: 0.85 }} onClick={onBack}>{t("dashboardBack")}</div>}
          <RadioTower size={17} />
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t("dashboardTitle")}</h1>
        </div>
        <span style={{ fontSize: 11, opacity: 0.75 }}>{isContractor ? currentUser?.name : t("dashboardAllContractorsOverview")}</span>
      </div>

      <div style={{ padding: 14, maxWidth: 1600, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, overflow: "hidden", marginBottom: 10 }}>
          <MiniStat icon={Building2} label={t("kpiContractors")} value={summary.contractors} />
          <MiniStat icon={Users} label={t("kpiActivePersonnel")} value={summary.activePersonnel} onClick={() => onNavigate({ module: "personnel", statusFilter: "active" })} />
          <MiniStat icon={AlertTriangle} label={t("kpiOpenAnomalies")} value={summary.openAnomalies} onClick={() => onNavigate({ module: "anomaly", statusFilter: "not_closed" })} />
          <MiniStat icon={AlertTriangle} label={t("kpiCritical")} value={summary.criticalAnomalies} color="#c92a2a" onClick={() => onNavigate({ module: "anomaly", riskFilter: "High" })} />
          <MiniStat icon={Truck} label={t("kpiActiveMachinery")} value={summary.activeMachinery} onClick={() => onNavigate({ module: "machinery", approvalFilter: "approved" })} />
          <MiniStat icon={Tag} label={t("kpiActiveScaffold")} value={summary.activeScaffold} onClick={() => onNavigate({ module: "scaffold", statusFilter: "tag_issued" })} />
          <MiniStat icon={GitBranch} label={t("kpiBowtie")} value={summary.bowties} />
          <MiniStat icon={FileClock} label={t("kpiPendingApproval")} value={summary.pendingDocs} color="#d97706" />
          <MiniStat icon={Bell} label={t("kpiImportantNotifications")} value={summary.notifications} color="#1d4ed8" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 10, marginBottom: 10 }}>
          {isWidgetVisible("contractorHse") && (
          <Panel title={t("panelContractorHse")} icon={ShieldCheck}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 480 }}>
                <thead>
                  <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                    <th style={{ textAlign: "right", padding: "5px 6px", fontWeight: 600 }}>{t("colContractor")}</th>
                    <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600 }}>{t("colScore")}</th>
                    <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600 }}>{t("colOpenAnomalies")}</th>
                    <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600 }}>{t("colNeedsHealthVisit")}</th>
                    <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600 }}>{t("colFaultyMachinery")}</th>
                    <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600 }}>{t("colScaffoldNeedsVisit")}</th>
                    <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600 }}>{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {contractorRows.map((c) => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "6px", fontWeight: 600, color: THEME.text }}>{c.name}</td>
                      <td style={{ padding: "6px", textAlign: "center", fontWeight: 700 }}>{c.score}</td>
                      <td style={{ padding: "6px", textAlign: "center" }}>{c.openAnomalies}</td>
                      <td style={{ padding: "6px", textAlign: "center" }}>{c.needsHealth}</td>
                      <td style={{ padding: "6px", textAlign: "center" }}>{c.machineryFaulty}</td>
                      <td style={{ padding: "6px", textAlign: "center" }}>{c.scaffoldNeedsVisit}</td>
                      <td style={{ padding: "6px", textAlign: "center" }}><Dot level={c.level} /></td>
                    </tr>
                  ))}
                  {contractorRows.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 14, textAlign: "center", color: THEME.text3 }}>{t("noContractorsRegistered")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isWidgetVisible("urgentAlerts") && (
            <Panel title={t("panelUrgentAlerts")} icon={Bell} compact>
              {urgentAlerts.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0 }}>{t("noUrgentAlerts")}</p>}
              {urgentAlerts.map((a, i) => (
                <div key={i} onClick={a.onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: i < urgentAlerts.length - 1 ? `1px solid ${THEME.border}` : "none", cursor: a.onClick ? "pointer" : "default" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.severity === 3 ? "#c92a2a" : "#d97706", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: THEME.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</span>
                </div>
              ))}
            </Panel>

            )}

            {isWidgetVisible("smartInsights") && (
            <Panel title={t("panelSmartInsights")} icon={Sparkles} compact>
              {insights.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0 }}>{t("noSmartInsights")}</p>}
              {insights.map((ins, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 0", fontSize: 11, color: THEME.text2, lineHeight: 1.7 }}>
                  <span style={{ color: ins.type === "danger" ? "#c92a2a" : ins.type === "good" ? "#16a34a" : "#d97706", flexShrink: 0 }}>●</span>
                  {ins.text}
                </div>
              ))}
            </Panel>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <Panel title={t("panelAnomalyTrend")} icon={TrendingUp} compact>
            <MiniBarChart data={monthlyAnomalyTrend.map(([m, c]) => ({ label: m.slice(5), value: c, color: THEME.navy }))} />
          </Panel>
          <Panel title={t("panelHealthStatus")} icon={Users} compact>
            <MiniDonut data={healthStatusData} />
          </Panel>
          <Panel title={t("panelMachineryStatus")} icon={Truck} compact>
            <MiniDonut data={machineryStatusData} />
          </Panel>
          <Panel title={t("panelAnomalyByRisk")} icon={AlertTriangle} compact>
            <MiniDonut data={anomalyRiskData} />
          </Panel>
          <Panel title={t("panelContractorPerformance")} icon={ShieldCheck} compact>
            <MiniBarChart data={perfChartData} suffix="%" />
          </Panel>
          {isWidgetVisible("anomalyTrend") && (
          <Panel title={t("panelAnomalyTrend")} icon={TrendingUp} compact>
            <MiniBarChart data={monthlyAnomalyTrend.map(([m, c]) => ({ label: m.slice(5), value: c, color: THEME.navy }))} />
          </Panel>
          )}
          {isWidgetVisible("healthStatus") && (
          <Panel title={t("panelHealthStatus")} icon={Users} compact>
            <MiniDonut data={healthStatusData} />
          </Panel>
          )}
          {isWidgetVisible("machineryStatus") && (
          <Panel title={t("panelMachineryStatus")} icon={Truck} compact>
            <MiniDonut data={machineryStatusData} />
          </Panel>
          )}
          {isWidgetVisible("anomalyByRisk") && (
          <Panel title={t("panelAnomalyByRisk")} icon={AlertTriangle} compact>
            <MiniDonut data={anomalyRiskData} />
          </Panel>
          )}
          {isWidgetVisible("contractorPerformance") && (
          <Panel title={t("panelContractorPerformance")} icon={ShieldCheck} compact>
            <MiniBarChart data={perfChartData} suffix="%" />
          </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

// ================= اجزای فشرده =================

function MiniStat({ icon: Icon, label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: "1 1 100px", minWidth: 100, padding: "10px 12px", cursor: onClick ? "pointer" : "default",
        borderInlineEnd: `1px solid ${THEME.border}`, display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: THEME.text3 }}>
        <Icon size={12} />
        <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: color || THEME.navy, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children, compact }) {
  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: compact ? "10px 12px" : "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon size={13} color={THEME.teal} />
        <h3 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Dot({ level }) {
  const color = level === "green" ? "#16a34a" : level === "yellow" ? "#d97706" : "#c92a2a";
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color }} />;
}

function MiniBarChart({ data, suffix = "" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p style={{ fontSize: 11, color: THEME.text3, margin: 0 }}>داده‌ای موجود نیست</p>;
  return (
    <div>
      {data.map((d) => (
        <div key={d.label} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: THEME.text2, marginBottom: 2 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>{d.label}</span>
            <span style={{ fontWeight: 700 }}>{d.value}{suffix}</span>
          </div>
          <div style={{ background: "#eef1f5", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// دونات ساده با SVG خام (بدون کتابخانه‌ی نمودار، برای سبک نگه‌داشتن باندل)
function MiniDonut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p style={{ fontSize: 11, color: THEME.text3, margin: 0 }}>داده‌ای موجود نیست</p>;
  const r = 34, cx = 40, cy = 40, circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
        {data.filter((d) => d.value > 0).map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circumference;
          const seg = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="12"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div style={{ flex: 1 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: THEME.text2, marginBottom: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ marginInlineStart: "auto", fontWeight: 700 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
