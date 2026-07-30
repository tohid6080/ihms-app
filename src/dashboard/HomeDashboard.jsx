import React, { useState, useEffect, useMemo } from "react";
import {
  Users, AlertTriangle, ShieldCheck, HeartPulse, Building2, GraduationCap,
  Filter, X, Bell, Clock, ChevronLeft,
} from "lucide-react";
import { styles, THEME } from "../shared.js";
import { JalaliDateInput } from "../personnel/jalaliDate.jsx";
import { loadPersonnelList, personnelStatusMeta, loadNotifications } from "../personnel/personnelApi.js";
import { loadDashboardAnomalies, loadDashboardContractors } from "./homeDashboardApi.js";

/**
 * IHMS Home Dashboard — enterprise overview (Power BI / Fiori / Grafana style).
 * Aggregates real data from Personnel, Anomaly, and Contractor modules.
 *
 * Honest scope notes (no fabricated data):
 * - Training has no module/table anywhere in this project yet, so those 3
 *   cards are shown as explicit "not yet implemented" placeholders — not
 *   fake numbers.
 * - "Overdue Corrective Actions" uses a 14-day-since-reported heuristic
 *   (anomalies don't have a stored due-date field).
 * - "Contractor Performance Score" is a derived score (personnel compliance
 *   rate + anomaly closure rate), not a separately stored metric.
 * - "Expired Qualifications" maps to qualificationStatus === "rejected"
 *   (qualifications don't have an expiry date field, only approval state).
 * - A single cross-domain "Status" filter isn't meaningful (Personnel and
 *   Anomaly have unrelated status vocabularies) — Contractor / Project /
 *   Date Range are the global filters; per-domain status filtering happens
 *   via the KPI/alert click-throughs themselves.
 */

const OVERDUE_DAYS = 14;
const HEALTH_SOON_DAYS = 30;

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}
function daysSince(iso) {
  if (!iso) return null;
  return Math.ceil((new Date() - new Date(iso)) / (1000 * 60 * 60 * 24));
}
function monthKey(iso) {
  if (!iso) return null;
  return iso.slice(0, 7);
}

export default function HomeDashboard({ role, currentUser, onNavigate, onBack }) {
  const [personnel, setPersonnel] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [contractorFilter, setContractorFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const isContractor = role === "CONTRACTOR";

  useEffect(() => {
    (async () => {
      const [p, a, c] = await Promise.all([loadPersonnelList(), loadDashboardAnomalies(), loadDashboardContractors()]);
      setPersonnel(p);
      setAnomalies(a);
      setContractors(c);
      setNotifications(await loadNotifications(isContractor ? "contractor" : "employer"));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myName = (currentUser?.name || "").trim().toLowerCase();

  const scopedPersonnel = useMemo(() => {
    let list = isContractor ? personnel.filter((p) => (p.contractorName || "").trim().toLowerCase() === myName) : personnel;
    if (!isContractor && contractorFilter !== "all") list = list.filter((p) => p.contractorId === contractorFilter);
    if (dateFrom) list = list.filter((p) => !p.startDate || p.startDate >= dateFrom);
    if (dateTo) list = list.filter((p) => !p.startDate || p.startDate <= dateTo);
    return list;
  }, [personnel, isContractor, myName, contractorFilter, dateFrom, dateTo]);

  const scopedAnomalies = useMemo(() => {
    let list = isContractor ? anomalies.filter((a) => (a.contractor || "").trim().toLowerCase() === myName) : anomalies;
    if (!isContractor && contractorFilter !== "all") {
      const cName = (contractors.find((c) => c.id === contractorFilter)?.name || "").trim().toLowerCase();
      list = list.filter((a) => (a.contractor || "").trim().toLowerCase() === cName);
    }
    if (projectFilter !== "all") list = list.filter((a) => a.project === projectFilter);
    if (dateFrom) list = list.filter((a) => !a.date || a.date >= dateFrom);
    if (dateTo) list = list.filter((a) => !a.date || a.date <= dateTo);
    return list;
  }, [anomalies, isContractor, myName, contractorFilter, contractors, projectFilter, dateFrom, dateTo]);

  const projectOptions = useMemo(() => Array.from(new Set(anomalies.map((a) => a.project).filter(Boolean))).sort(), [anomalies]);
  const notifFiltered = isContractor ? notifications.filter((n) => scopedPersonnel.some((p) => p.id === n.personnel_id)) : notifications;

  const personnelKpi = {
    total: scopedPersonnel.length,
    active: scopedPersonnel.filter((p) => p.status === "active").length,
    pendingEmployer: scopedPersonnel.filter((p) => p.status === "pending_employer_review").length,
    pendingQualification: scopedPersonnel.filter((p) => p.status === "pending_qualification").length,
    healthExpired: scopedPersonnel.filter((p) => p.status === "health_expired").length,
    healthSoon: scopedPersonnel.filter((p) => {
      if (p.status !== "active" || !p.occHealthExpiry) return false;
      const d = daysUntil(p.occHealthExpiry);
      return d !== null && d >= 0 && d <= HEALTH_SOON_DAYS;
    }).length,
  };

  const anomalyKpi = {
    total: scopedAnomalies.length,
    open: scopedAnomalies.filter((a) => a.status === "open").length,
    closed: scopedAnomalies.filter((a) => a.status === "Closed").length,
    high: scopedAnomalies.filter((a) => a.riskLevel === "High").length,
    med: scopedAnomalies.filter((a) => a.riskLevel === "Med").length,
    low: scopedAnomalies.filter((a) => a.riskLevel === "Low").length,
    overdue: scopedAnomalies.filter((a) => a.status !== "Closed" && daysSince(a.date) !== null && daysSince(a.date) > OVERDUE_DAYS).length,
  };

  const contractorPerf = contractors.map((c) => {
    const cPersonnel = personnel.filter((p) => p.contractorId === c.id);
    const cAnomalies = anomalies.filter((a) => (a.contractor || "").trim().toLowerCase() === (c.name || "").trim().toLowerCase());
    const complianceRate = cPersonnel.length ? cPersonnel.filter((p) => p.status === "active").length / cPersonnel.length : 1;
    const closureRate = cAnomalies.length ? cAnomalies.filter((a) => a.status === "Closed").length / cAnomalies.length : 1;
    const score = Math.round((complianceRate * 0.6 + closureRate * 0.4) * 100);
    return { name: c.name, score, personnelCount: cPersonnel.length, anomalyCount: cAnomalies.length };
  });
  const avgPerf = contractorPerf.length ? Math.round(contractorPerf.reduce((s, c) => s + c.score, 0) / contractorPerf.length) : 0;
  const activeContractors = contractors.filter((c) => personnel.some((p) => p.contractorId === c.id) || anomalies.some((a) => (a.contractor || "").toLowerCase() === (c.name || "").toLowerCase())).length;

  const countBy = (list, keyFn) => {
    const map = {};
    list.forEach((item) => { const k = keyFn(item) || "نامشخص"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const personnelByContractor = countBy(scopedPersonnel, (p) => p.contractorName);
  const personnelByStatus = countBy(scopedPersonnel, (p) => personnelStatusMeta(p.status).label);
  const anomaliesByContractor = countBy(scopedAnomalies, (a) => a.contractor);
  const anomaliesByRisk = [
    { label: "بالا (High)", count: anomalyKpi.high, color: "#c92a2a" },
    { label: "متوسط (Med)", count: anomalyKpi.med, color: "#d97706" },
    { label: "پایین (Low)", count: anomalyKpi.low, color: "#16a34a" },
  ].filter((r) => r.count > 0);
  const monthlyTrend = useMemo(() => {
    const map = {};
    scopedAnomalies.forEach((a) => { const k = monthKey(a.date || a.createdAt); if (k) map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [scopedAnomalies]);
  const healthStatusChart = [
    { label: "فعال", count: personnelKpi.active - personnelKpi.healthSoon, color: "#16a34a" },
    { label: "در آستانه انقضا", count: personnelKpi.healthSoon, color: "#d97706" },
    { label: "منقضی‌شده", count: personnelKpi.healthExpired, color: THEME.danger },
  ].filter((r) => r.count > 0);
  const perfChart = contractorPerf.filter((c) => c.personnelCount > 0 || c.anomalyCount > 0).sort((a, b) => b.score - a.score).slice(0, 8);

  const latestPersonnel = [...scopedPersonnel].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  const latestAnomalies = [...scopedAnomalies].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  const latestNotifications = [...notifFiltered].slice(0, 5);

  const expiredQualifications = scopedPersonnel.filter((p) => p.qualificationRequired && p.qualificationStatus === "rejected").length;
  const alerts = [
    { key: "healthExpired", label: "طب کار منقضی‌شده", count: personnelKpi.healthExpired, nav: { module: "personnel", statusFilter: "health_expired" } },
    { key: "pendingEmployer", label: "در انتظار تأیید کارفرما", count: personnelKpi.pendingEmployer, nav: { module: "personnel", statusFilter: "pending_employer_review" } },
    { key: "highRiskOpen", label: "آنومالی‌های پرریسک باز", count: scopedAnomalies.filter((a) => a.riskLevel === "High" && a.status !== "Closed").length, nav: { module: "anomaly", riskFilter: "High", statusFilter: "open" } },
    { key: "overdue", label: "اقدامات اصلاحی معوق", count: anomalyKpi.overdue, nav: { module: "anomaly", statusFilter: "open" } },
    { key: "trainingExpired", label: "آموزش‌های منقضی‌شده", count: null, nav: null },
    { key: "qualExpired", label: "صلاحیت‌های رد/منقضی‌شده", count: expiredQualifications, nav: { module: "personnel", statusFilter: "needs_correction" } },
  ];

  const hasFilters = contractorFilter !== "all" || projectFilter !== "all" || !!dateFrom || !!dateTo;
  const clearFilters = () => { setContractorFilter("all"); setProjectFilter("all"); setDateFrom(""); setDateTo(""); };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری داشبورد...</div>;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 18px 40px" }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: THEME.navy, fontWeight: 800 }}>داشبورد مدیریتی IHMS</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: THEME.text3 }}>نمای یکپارچه پرسنل، آنومالی و پیمانکاران</p>
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} style={filterToggleStyle(hasFilters)}>
          <Filter size={14} /> فیلترها {hasFilters && <span style={filterDotStyle} />}
        </button>
      </div>

      {showFilters && (
        <div style={cardStyle}>
          <div style={styles.formGrid}>
            {!isContractor && (
              <div>
                <label style={styles.label}>پیمانکار</label>
                <select style={styles.input} value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} dir="rtl">
                  <option value="all">همه پیمانکاران</option>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={styles.label}>پروژه</label>
              <select style={styles.input} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} dir="rtl">
                <option value="all">همه پروژه‌ها</option>
                {projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>از تاریخ</label>
              <JalaliDateInput value={dateFrom} onChange={setDateFrom} allowEmpty />
            </div>
            <div>
              <label style={styles.label}>تا تاریخ</label>
              <JalaliDateInput value={dateTo} onChange={setDateTo} allowEmpty />
            </div>
          </div>
          {hasFilters && (
            <div style={{ ...styles.backLink, fontSize: 11, marginTop: 6, marginBottom: 0, display: "inline-flex" }} onClick={clearFilters}>
              <X size={12} style={{ marginLeft: 3 }} /> پاک کردن فیلترها
            </div>
          )}
        </div>
      )}

      <SectionHeader icon={Bell} title="هشدارهای بحرانی" color={THEME.danger} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 24 }}>
        {alerts.map((a) => (
          <div
            key={a.key}
            onClick={() => a.nav && a.count > 0 && onNavigate(a.nav)}
            style={{
              ...premiumCardStyle,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderInlineStart: `4px solid ${a.count > 0 ? THEME.danger : THEME.border}`,
              cursor: a.nav && a.count > 0 ? "pointer" : "default",
              opacity: a.count === null ? 0.55 : 1,
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, color: THEME.text2, fontWeight: 600 }}>{a.label}</div>
              {a.count === null && <div style={{ fontSize: 10.5, color: THEME.text3, marginTop: 2 }}>ماژول آموزش هنوز پیاده‌سازی نشده</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: a.count > 0 ? THEME.danger : THEME.text3 }}>{a.count === null ? "—" : a.count}</span>
              {a.nav && a.count > 0 && <ChevronLeft size={16} color={THEME.text3} />}
            </div>
          </div>
        ))}
      </div>

      <SectionHeader icon={Users} title="پرسنل" color={THEME.teal} />
      <div style={kpiGridStyle}>
        <KpiCard label="کل پرسنل" value={personnelKpi.total} icon={Users} color={THEME.navy} onClick={() => onNavigate({ module: "personnel" })} />
        <KpiCard label="پرسنل فعال" value={personnelKpi.active} icon={ShieldCheck} color="#166534" bg="#dcfce7" onClick={() => onNavigate({ module: "personnel", statusFilter: "active" })} />
        <KpiCard label="در انتظار تأیید کارفرما" value={personnelKpi.pendingEmployer} icon={Clock} color="#1d4ed8" bg="#dbeafe" onClick={() => onNavigate({ module: "personnel", statusFilter: "pending_employer_review" })} />
        <KpiCard label="در انتظار تأیید صلاحیت" value={personnelKpi.pendingQualification} icon={ShieldCheck} color="#b45309" bg="#fef3c7" onClick={() => onNavigate({ module: "personnel", statusFilter: "pending_qualification" })} />
        <KpiCard label="طب کار منقضی‌شده" value={personnelKpi.healthExpired} icon={HeartPulse} color={THEME.danger} bg="#fdecec" onClick={() => onNavigate({ module: "personnel", statusFilter: "health_expired" })} />
        <KpiCard label="طب کار در آستانه انقضا" value={personnelKpi.healthSoon} icon={HeartPulse} color="#b45309" bg="#fef3c7" onClick={() => onNavigate({ module: "personnel", statusFilter: "active" })} />
      </div>

      <SectionHeader icon={AlertTriangle} title="مدیریت آنومالی" color="#c2410c" />
      <div style={kpiGridStyle}>
        <KpiCard label="کل آنومالی‌ها" value={anomalyKpi.total} icon={AlertTriangle} color={THEME.navy} onClick={() => onNavigate({ module: "anomaly" })} />
        <KpiCard label="باز" value={anomalyKpi.open} icon={Clock} color="#1d4ed8" bg="#dbeafe" onClick={() => onNavigate({ module: "anomaly", statusFilter: "open" })} />
        <KpiCard label="بسته" value={anomalyKpi.closed} icon={ShieldCheck} color="#166534" bg="#dcfce7" onClick={() => onNavigate({ module: "anomaly", statusFilter: "Closed" })} />
        <KpiCard label="ریسک بالا" value={anomalyKpi.high} icon={AlertTriangle} color="#c92a2a" bg="#fee2e2" onClick={() => onNavigate({ module: "anomaly", riskFilter: "High" })} />
        <KpiCard label="ریسک متوسط" value={anomalyKpi.med} icon={AlertTriangle} color="#d97706" bg="#fef3c7" onClick={() => onNavigate({ module: "anomaly", riskFilter: "Med" })} />
        <KpiCard label="ریسک پایین" value={anomalyKpi.low} icon={AlertTriangle} color="#16a34a" bg="#dcfce7" onClick={() => onNavigate({ module: "anomaly", riskFilter: "Low" })} />
        <KpiCard label={`اقدامات اصلاحی معوق (${OVERDUE_DAYS}+ روز)`} value={anomalyKpi.overdue} icon={Clock} color={THEME.danger} bg="#fdecec" onClick={() => onNavigate({ module: "anomaly", statusFilter: "open" })} />
      </div>

      <SectionHeader icon={Building2} title="پیمانکاران" color={THEME.navyMid} />
      <div style={kpiGridStyle}>
        <KpiCard label="کل پیمانکاران" value={contractors.length} icon={Building2} color={THEME.navy} />
        <KpiCard label="پیمانکاران فعال" value={activeContractors} icon={Building2} color="#166534" bg="#dcfce7" />
        <KpiCard label="میانگین امتیاز عملکرد" value={`${avgPerf}%`} icon={ShieldCheck} color={avgPerf >= 70 ? "#166534" : "#b45309"} bg={avgPerf >= 70 ? "#dcfce7" : "#fef3c7"} />
      </div>

      <SectionHeader icon={GraduationCap} title="آموزش" color={THEME.text3} />
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <p style={{ fontSize: 12.5, color: THEME.text3, margin: 0, lineHeight: 1.8 }}>
          ماژول «مدیریت آموزش‌های HSE» هنوز در این پروژه پیاده‌سازی نشده؛ آیتم آن در منوی اصلی به‌عنوان «به‌زودی» علامت‌گذاری شده است.
          کارت‌های «آموزش تکمیل‌شده»، «آموزش منقضی‌شده» و «آموزش نزدیک به سررسید» زمانی معنا پیدا می‌کنند که این ماژول ساخته شود — عدد ساختگی نمایش داده نمی‌شود.
        </p>
      </div>

      <SectionHeader icon={AlertTriangle} title="نمودارها" color={THEME.teal} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 24 }}>
        <ChartBlock title="پرسنل بر اساس پیمانکار" rows={personnelByContractor.map(([label, count]) => ({ label, count, color: THEME.teal }))} onRowClick={(label) => { const c = contractors.find((x) => x.name === label); onNavigate({ module: "personnel", contractorFilter: c?.id }); }} />
        <ChartBlock title="وضعیت پرسنل" rows={personnelByStatus.map(([label, count]) => ({ label, count, color: THEME.navyMid }))} />
        <ChartBlock title="آنومالی بر اساس پیمانکار" rows={anomaliesByContractor.map(([label, count]) => ({ label, count, color: "#c2410c" }))} />
        <ChartBlock title="آنومالی بر اساس سطح ریسک" rows={anomaliesByRisk.map((r) => ({ label: r.label, count: r.count, color: r.color }))} onRowClick={(label) => { const rl = label.includes("High") ? "High" : label.includes("Med") ? "Med" : "Low"; onNavigate({ module: "anomaly", riskFilter: rl }); }} />
        <ChartBlock title="روند ماهانه آنومالی (۶ ماه اخیر)" rows={monthlyTrend.map(([m, c]) => ({ label: m, count: c, color: THEME.navy }))} />
        <ChartBlock title="وضعیت طب کار" rows={healthStatusChart.map((r) => ({ label: r.label, count: r.count, color: r.color }))} />
        <ChartBlock title="امتیاز عملکرد پیمانکاران" rows={perfChart.map((c) => ({ label: c.name, count: c.score, color: c.score >= 70 ? "#16a34a" : c.score >= 40 ? "#d97706" : THEME.danger, suffix: "%" }))} />
      </div>

      <SectionHeader icon={Clock} title="فعالیت‌های اخیر" color={THEME.navyMid} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <ActivityBlock title="آخرین پرسنل ثبت‌شده" items={latestPersonnel.map((p) => ({ id: p.id, primary: p.fullName, secondary: `${p.jobTitle} · ${p.contractorName}`, meta: personnelStatusMeta(p.status).label }))} onItemClick={() => onNavigate({ module: "personnel" })} empty="موردی ثبت نشده" />
        <ActivityBlock title="آخرین آنومالی‌ها" items={latestAnomalies.map((a) => ({ id: a.id, primary: a.trackingNumber || a.area, secondary: `${a.contractor} · ${a.project}`, meta: a.riskLevel }))} onItemClick={() => onNavigate({ module: "anomaly" })} empty="موردی ثبت نشده" />
        <ActivityBlock title="آخرین اعلان‌ها" items={latestNotifications.map((n) => ({ id: n.id, primary: n.message, secondary: "", meta: "" }))} empty="اعلان جدیدی نیست" />
      </div>
    </div>
  );
}

const cardStyle = { ...styles.card, width: "auto", marginBottom: 16 };
const premiumCardStyle = {
  background: THEME.surface, borderRadius: 14, padding: "16px 18px",
  boxShadow: "0 1px 2px rgba(15,42,63,0.04), 0 8px 22px -10px rgba(15,42,63,0.16)",
  border: `1px solid ${THEME.border}`,
};
const kpiGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 };

function filterToggleStyle(active) {
  return {
    display: "flex", alignItems: "center", gap: 6, background: active ? THEME.tealSoft : "#fff",
    border: `1.5px solid ${active ? THEME.teal : THEME.border}`, borderRadius: 9, padding: "8px 14px",
    fontSize: 12.5, fontWeight: 600, color: active ? THEME.tealDeep : THEME.text2, cursor: "pointer", fontFamily: THEME.font,
  };
}
const filterDotStyle = { width: 6, height: 6, borderRadius: "50%", background: THEME.teal, display: "inline-block" };

function SectionHeader({ icon: Icon, title, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon size={16} color={color} />
      <h3 style={{ fontSize: 14.5, color: THEME.navy, fontWeight: 700, margin: 0 }}>{title}</h3>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg, onClick }) {
  return (
    <div onClick={onClick} style={{ ...premiumCardStyle, cursor: onClick ? "pointer" : "default", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: bg || "#eef1f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={color} />
        </div>
        {onClick && <ChevronLeft size={15} color={THEME.text3} />}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: THEME.navy, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 6, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function ChartBlock({ title, rows, onRowClick }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={premiumCardStyle}>
      <h4 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 12px", fontWeight: 700 }}>{title}</h4>
      {rows.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, margin: 0 }}>داده‌ای موجود نیست.</p>}
      {rows.map((r) => (
        <div key={r.label} style={{ marginBottom: 10, cursor: onRowClick ? "pointer" : "default" }} onClick={() => onRowClick && onRowClick(r.label)}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: THEME.text2, marginBottom: 3 }}>
            <span>{r.label}</span>
            <span style={{ fontWeight: 700 }}>{r.count}{r.suffix || ""}</span>
          </div>
          <div style={{ background: "#eef1f5", borderRadius: 6, height: 9, overflow: "hidden" }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: "100%", background: r.color, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityBlock({ title, items, onItemClick, empty }) {
  return (
    <div style={premiumCardStyle}>
      <h4 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>{title}</h4>
      {items.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, margin: 0 }}>{empty}</p>}
      {items.map((it) => (
        <div key={it.id} onClick={onItemClick} style={{ borderTop: `1px solid ${THEME.border}`, padding: "8px 0", cursor: onItemClick ? "pointer" : "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, color: THEME.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.primary}</span>
            {it.meta && <span style={{ fontSize: 10.5, color: THEME.text3, flexShrink: 0 }}>{it.meta}</span>}
          </div>
          {it.secondary && <div style={{ fontSize: 10.5, color: THEME.text3, marginTop: 2 }}>{it.secondary}</div>}
        </div>
      ))}
    </div>
  );
}
