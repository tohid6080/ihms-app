import React, { useState } from "react";
import { BarChart3, Filter, X } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { JalaliDateInput } from "./jalaliDate.jsx";
import { PERSONNEL_STATUS } from "./personnelApi.js";

/**
 * Management Dashboard — KPI cards + simple hand-rolled bar charts
 * (no charting library, consistent with the rest of the app's Path A
 * architecture). Operates on the same role-scoped personnel list already
 * computed by PersonnelDashboard.jsx; filters here are local/additional.
 */

function isPendingGroup(status) {
  return ["pending_documents", "pending_employer_review", "pending_qualification", "pending_health_visit", "pending_health_result"].includes(status);
}

function daysUntil(iso) {
  if (!iso) return null;
  const diffMs = new Date(iso) - new Date();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function PersonnelManagementDashboard({ personnelList, contractorOptions, isContractor, onClose }) {
  const [contractorFilter, setContractorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = personnelList.filter((p) => {
    if (!isContractor && contractorFilter !== "all" && p.contractorId !== contractorFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (dateFrom && p.startDate && p.startDate < dateFrom) return false;
    if (dateTo && p.startDate && p.startDate > dateTo) return false;
    return true;
  });

  const kpis = {
    total: filtered.length,
    active: filtered.filter((p) => p.status === "active").length,
    pending: filtered.filter((p) => isPendingGroup(p.status)).length,
    rejected: filtered.filter((p) => p.status === "rejected").length,
    needsCorrection: filtered.filter((p) => p.status === "needs_correction").length,
    healthExpired: filtered.filter((p) => p.status === "health_expired").length,
    healthExpiringSoon: filtered.filter((p) => {
      if (p.status !== "active" || !p.occHealthExpiry) return false;
      const d = daysUntil(p.occHealthExpiry);
      return d !== null && d >= 0 && d <= 30;
    }).length,
    pendingQualification: filtered.filter((p) => p.status === "pending_qualification").length,
  };

  const countBy = (keyFn) => {
    const map = {};
    filtered.forEach((p) => {
      const key = keyFn(p) || "نامشخص";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const byContractor = countBy((p) => p.contractorName);
  const byJobTitle = countBy((p) => p.jobTitle);
  const byStatus = PERSONNEL_STATUS
    .map((s) => ({ label: s.label, count: filtered.filter((p) => p.status === s.value).length, color: s.color }))
    .filter((row) => row.count > 0);

  const hasDateFilter = !!(dateFrom || dateTo);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={styles.backLink} onClick={onClose}>← بازگشت به لیست پرسنل</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <BarChart3 size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>داشبورد مدیریتی پرسنل</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 18 }}>نمای کلی، شاخص‌های کلیدی و نمودارهای وضعیت پرسنل</p>

      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Filter size={14} color={THEME.text2} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: THEME.text2 }}>فیلترها</span>
        </div>
        <div style={styles.formGrid}>
          {!isContractor && (
            <div>
              <label style={styles.label}>پیمانکار</label>
              <select style={styles.input} value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} dir="rtl">
                <option value="all">همه پیمانکاران</option>
                {contractorOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={styles.label}>وضعیت</label>
            <select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} dir="rtl">
              <option value="all">همه وضعیت‌ها</option>
              {PERSONNEL_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>از تاریخ شروع به کار</label>
            <JalaliDateInput value={dateFrom} onChange={setDateFrom} allowEmpty />
          </div>
          <div>
            <label style={styles.label}>تا تاریخ شروع به کار</label>
            <JalaliDateInput value={dateTo} onChange={setDateTo} allowEmpty />
          </div>
        </div>
        {hasDateFilter && (
          <div
            style={{ ...styles.backLink, fontSize: 11, marginTop: 8, marginBottom: 0, display: "inline-flex" }}
            onClick={() => { setDateFrom(""); setDateTo(""); }}
          >
            <X size={12} style={{ marginLeft: 3 }} /> پاک کردن بازه تاریخ
          </div>
        )}
      </div>

      <div style={styles.statsRow}>
        <KpiCard label="کل پرسنل" value={kpis.total} bg="#eef1f5" color={THEME.navy} />
        <KpiCard label="فعال" value={kpis.active} bg="#dcfce7" color="#166534" />
        <KpiCard label="در انتظار تأیید" value={kpis.pending} bg="#dbeafe" color="#1d4ed8" />
        <KpiCard label="رد شده" value={kpis.rejected} bg="#fdecec" color={THEME.danger} />
        <KpiCard label="نیاز به اصلاح" value={kpis.needsCorrection} bg="#fef3c7" color="#b45309" />
        <KpiCard label="طب کار منقضی" value={kpis.healthExpired} bg="#fdecec" color={THEME.danger} />
        <KpiCard label="طب کار در آستانه انقضا (۳۰ روز)" value={kpis.healthExpiringSoon} bg="#fef3c7" color="#b45309" />
        <KpiCard label="در انتظار تأیید صلاحیت" value={kpis.pendingQualification} bg="#fef3c7" color="#b45309" />
      </div>

      <ChartBlock title="بر اساس پیمانکار" rows={byContractor.map(([label, count]) => ({ label, count, color: THEME.teal }))} />
      <ChartBlock title="بر اساس عنوان شغلی" rows={byJobTitle.map(([label, count]) => ({ label, count, color: THEME.navyMid }))} />
      <ChartBlock title="بر اساس وضعیت" rows={byStatus} />
    </div>
  );
}

function KpiCard({ label, value, bg, color }) {
  return (
    <div style={{ ...styles.statBox, background: bg }}>
      <div style={{ ...styles.statNum, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function ChartBlock({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ ...styles.card, width: "auto", marginTop: 14 }}>
      <h4 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 12px", fontWeight: 700 }}>{title}</h4>
      {rows.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, margin: 0 }}>داده‌ای موجود نیست.</p>}
      {rows.map((r) => (
        <div key={r.label} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: THEME.text2, marginBottom: 3 }}>
            <span>{r.label}</span>
            <span style={{ fontWeight: 700 }}>{r.count}</span>
          </div>
          <div style={{ background: "#eef1f5", borderRadius: 6, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: "100%", background: r.color, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
