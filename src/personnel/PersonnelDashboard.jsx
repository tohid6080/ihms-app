import React, { useState, useEffect } from "react";
import { Plus, Users, FileSpreadsheet, FileDown } from "lucide-react";
import { styles, THEME } from "../shared.js";
import DataView, { StatusPill } from "../shared/DataView.jsx";
import { loadPersonnelListOfflineFirst, personnelStatusMeta, employmentStatusMeta, checkAndUpdateDeadlines, loadContractorOptions, PERSONNEL_STATUS } from "./personnelApi.js";
import { exportPersonnelPdf, exportPersonnelExcel } from "./personnelExport.js";
import PersonnelForm from "./PersonnelForm.jsx";
import PersonnelDetail from "./PersonnelDetail.jsx";
import SyncStatusBadge from "../offline/SyncStatusBadge.jsx";

const SORT_OPTIONS = [
  { value: "name", label: "نام (الفبا)" },
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
];

/**
 * Entry point for the Personnel Access Management module.
 * Self-contained internal routing (list ⇄ form ⇄ detail), same pattern as
 * BowTieDashboard ⇄ BowTieEditor — App.jsx only needs one route to this file.
 */
export default function PersonnelDashboard({ onBack, currentUser, role, initialStatusFilter, initialContractorFilter, readOnly, onNavigateToAssessment, initialSelectedPersonnelId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "all");
  const [contractorFilter, setContractorFilter] = useState(initialContractorFilter || "all");
  const [showTerminated, setShowTerminated] = useState(false);
  const [contractorOptions, setContractorOptions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);

  const isContractor = role === "CONTRACTOR";

  useEffect(() => {
    if (!isContractor) loadContractorOptions().then(setContractorOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const all = await loadPersonnelListOfflineFirst();
    await checkAndUpdateDeadlines(all); // فقط برای انتقال خودکار به «منقضی»
    const refreshed = await loadPersonnelListOfflineFirst();
    setList(refreshed);
    setLoading(false);
    // بازکردن خودکار پرونده‌ی همان پرسنلی که از آنجا به فرم ارزیابی رفته
    // بودیم — چون این کامپوننت هر بار که کاربر بین این ماژول و ماژول
    // شاخص‌های پیش‌نگر جابه‌جا می‌شود، کامل remount می‌شود و state داخلی‌اش
    // (از جمله «کدام پرسنل انتخاب شده») پاک می‌شود؛ بدون این، کاربر بعد از
    // تکمیل ارزیابی فقط به لیست کلی برمی‌گشت، نه به همان پرونده.
    if (initialSelectedPersonnelId) {
      const found = refreshed.find((p) => p.id === initialSelectedPersonnelId);
      if (found) setSelected(found);
    }
  };
  useEffect(() => { load(); }, []);

  const scoped = isContractor && currentUser?.name
    ? list.filter((p) => (p.contractorName || "").trim().toLowerCase() === (currentUser.name || "").trim().toLowerCase())
    : list;

  const filtered = scoped.filter((p) => {
    if (!showTerminated && p.employmentStatus === "terminated") return false;
    if (showTerminated && p.employmentStatus !== "terminated") return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!isContractor && contractorFilter !== "all" && p.contractorId !== contractorFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${p.fullName} ${p.nationalCode} ${p.contractorName} ${p.jobTitle}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return (a.fullName || "").localeCompare(b.fullName || "", "fa");
    const at = a.createdAt || "", bt = b.createdAt || "";
    return sort === "oldest" ? at.localeCompare(bt) : bt.localeCompare(at);
  });

  const handleExportPdf = async () => {
    setExporting(true);
    await exportPersonnelPdf(sorted, "لیست پرسنل - IHMS");
    setExporting(false);
  };
  const handleExportExcel = async () => {
    setExporting(true);
    await exportPersonnelExcel(sorted, "لیست پرسنل - IHMS");
    setExporting(false);
  };

  const counts = {
    active: scoped.filter((p) => p.status === "active").length,
    pendingReview: scoped.filter((p) => p.status === "pending_documents" || p.status === "pending_employer_review").length,
    pendingQualification: scoped.filter((p) => p.status === "pending_qualification").length,
    pendingHealthVisit: scoped.filter((p) => p.status === "pending_health_visit").length,
    pendingHealthResult: scoped.filter((p) => p.status === "pending_health_result").length,
    healthExpired: scoped.filter((p) => p.status === "health_expired").length,
  };

  const byContractor = {};
  scoped.forEach((p) => {
    const key = p.contractorName || "نامشخص";
    byContractor[key] = (byContractor[key] || 0) + 1;
  });

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  if (showForm && !readOnly) {
    return <PersonnelForm onBack={() => setShowForm(false)} currentUser={currentUser} onSaved={() => { setShowForm(false); load(); }} />;
  }
  if (selected) {
    return (
      <PersonnelDetail
        personnel={selected}
        role={role}
        currentUser={currentUser}
        readOnly={readOnly}
        onBack={() => { setSelected(null); load(); }}
        onUpdated={(p) => setSelected(p)}
        onNavigateToAssessment={onNavigateToAssessment}
      />
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={20} color={THEME.teal} />
          <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>مدیریت ورود و تردد پرسنل</h2>
        </div>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 18 }}>ثبت، بررسی مدارک، تأیید صلاحیت و پیگیری طب کار پرسنل پیمانکاران</p>

      <div style={styles.statsRow}>
        <div style={{ ...styles.statBox, background: "#dcfce7" }}><div style={{ ...styles.statNum, color: "#166534" }}>{counts.active}</div><div style={styles.statLabel}>فعال</div></div>
        <div style={{ ...styles.statBox, background: "#dbeafe" }}><div style={{ ...styles.statNum, color: "#1d4ed8" }}>{counts.pendingReview}</div><div style={styles.statLabel}>در انتظار تأیید</div></div>
        <div style={{ ...styles.statBox, background: "#fef3c7" }}><div style={{ ...styles.statNum, color: "#b45309" }}>{counts.pendingQualification}</div><div style={styles.statLabel}>در انتظار صلاحیت</div></div>
        <div style={{ ...styles.statBox, background: "#fef3c7" }}><div style={{ ...styles.statNum, color: "#b45309" }}>{counts.pendingHealthVisit}</div><div style={styles.statLabel}>در انتظار مراجعه طب کار</div></div>
        <div style={{ ...styles.statBox, background: "#fef3c7" }}><div style={{ ...styles.statNum, color: "#b45309" }}>{counts.pendingHealthResult}</div><div style={styles.statLabel}>در انتظار نتیجه طب کار</div></div>
        <div style={{ ...styles.statBox, background: "#fdecec" }}><div style={{ ...styles.statNum, color: THEME.danger }}>{counts.healthExpired}</div><div style={styles.statLabel}>طب کار منقضی</div></div>
      </div>

      {!isContractor && Object.keys(byContractor).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4 style={{ fontSize: 12.5, color: THEME.text2, marginBottom: 6, fontWeight: 600 }}>آمار هر پیمانکار</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(byContractor).map(([name, c]) => (
              <span key={name} style={styles.badge}>{name}: {c}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        {!readOnly && (
          <div style={{ ...styles.menuCard, background: THEME.teal, color: "#fff", justifyContent: "center", flex: 1 }} onClick={() => setShowForm(true)}>
            <Plus size={16} style={{ marginLeft: 6 }} /> ثبت پرسنل جدید
          </div>
        )}
      </div>

      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, cursor: "pointer",
          fontSize: 12, fontWeight: 600, color: showTerminated ? THEME.danger : THEME.teal,
        }}
        onClick={() => setShowTerminated((v) => !v)}
      >
        {showTerminated ? "بازگشت به لیست پرسنل فعال" : "نمایش پرسنل ترک‌کار / تسویه‌حساب‌شده"}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 14 }}>
        <button
          type="button"
          style={{ ...styles.smallButton, flex: 1, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={handleExportExcel}
          disabled={exporting || sorted.length === 0}
        >
          <FileSpreadsheet size={15} /> خروجی Excel
        </button>
        <button
          type="button"
          style={{ ...styles.smallButton, flex: 1, background: THEME.navyMid, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={handleExportPdf}
          disabled={exporting || sorted.length === 0}
        >
          <FileDown size={15} /> خروجی PDF
        </button>
      </div>
      {exporting && <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 10, textAlign: "center" }}>در حال آماده‌سازی گزارش و بارگذاری مدارک...</p>}

      <DataView
        items={sorted}
        getId={(p) => p.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="جستجو (نام، کدملی، پیمانکار، شغل)..."
        sortOptions={SORT_OPTIONS}
        sortValue={sort}
        onSortChange={setSort}
        filterSlot={
          <>
            <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} dir="rtl">
              <option value="all">همه وضعیت‌ها</option>
              {PERSONNEL_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {!isContractor && (
              <select style={styles.filterSelect} value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} dir="rtl">
                <option value="all">همه پیمانکاران</option>
                {contractorOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </>
        }
        emptyMessage="موردی یافت نشد"
        columns={[
          {
            key: "name", label: "نام",
            render: (p) => (
              <div>
                <div style={{ fontWeight: 600 }}>{p.fullName}</div>
                <div style={{ fontSize: 11, color: THEME.text3 }}>{p.jobTitle}</div>
              </div>
            ),
          },
          ...(!isContractor ? [{ key: "contractor", label: "پیمانکار", render: (p) => p.contractorName || "—" }] : []),
          { key: "national", label: "کد ملی", render: (p) => p.nationalCode || "—" },
          {
            key: "status", label: "وضعیت",
            render: (p) => {
              const sm = personnelStatusMeta(p.status);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {showTerminated && (
                    <StatusPill label={employmentStatusMeta(p.employmentStatus).label} color={employmentStatusMeta(p.employmentStatus).color} bg={employmentStatusMeta(p.employmentStatus).bg} />
                  )}
                  <StatusPill label={sm.label} color={sm.color} bg={sm.bg} />
                  {p.syncStatus && p.syncStatus !== "synced" && <SyncStatusBadge status={p.syncStatus} onRetry={() => load()} />}
                </div>
              );
            },
          },
        ]}
        renderRowActions={(p) => (
          <button type="button" style={styles.smallButton} onClick={() => setSelected(p)}>مشاهده</button>
        )}
        renderCard={(p) => {
          const sm = personnelStatusMeta(p.status);
          return (
            <div style={{ ...styles.card, width: "auto", margin: 0, borderInlineStart: `4px solid ${sm.color}`, cursor: "pointer", height: "100%" }} onClick={() => setSelected(p)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, color: THEME.navy, fontSize: 14 }}>{p.fullName}</div>
                  <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 4 }}>{p.jobTitle} · {p.contractorName}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {showTerminated && (
                    <StatusPill label={employmentStatusMeta(p.employmentStatus).label} color={employmentStatusMeta(p.employmentStatus).color} bg={employmentStatusMeta(p.employmentStatus).bg} />
                  )}
                  <StatusPill label={sm.label} color={sm.color} bg={sm.bg} />
                  {p.syncStatus && p.syncStatus !== "synced" && <SyncStatusBadge status={p.syncStatus} onRetry={() => load()} />}
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
