import React, { useState, useEffect } from "react";
<<<<<<< HEAD
import { ShieldAlert, Plus, LogOut, Send, CreditCard, AlertTriangle, UserPlus, KeyRound, Layers, Trash2, History, Activity, TrendingDown, Clock, LogIn, ShieldX, LayoutDashboard, Building2, Users, FileClock, ChevronLeft, HardDrive, RefreshCw, Settings2, Copy, GripVertical, ArrowUp, ArrowDown, RotateCcw, Eye, EyeOff, LayoutGrid, PanelsTopLeft, Bell, Palette, Megaphone, Sparkles, Gift, Info } from "lucide-react";
import { THEME } from "../shared.js";
import { changeMyPassword } from "../sessionToken.js";
import { loadModuleConfig, saveModuleConfig, loadDashboardConfig, saveDashboardConfig, loadNotificationTypes, saveNotificationType, loadAppearanceConfig, saveAppearanceConfig, loadAllAnnouncements, createAnnouncement, updateAnnouncement, setAnnouncementActive, deleteAnnouncement } from "../systemConfigApi.js";
import AccountManagement from "./AccountManagement.jsx";
import { toJalaliSafe, JalaliDateInput } from "../personnel/jalaliDate.jsx";
=======
import { ShieldAlert, Plus, LogOut, Send, CreditCard, AlertTriangle, UserPlus, KeyRound, Layers, Trash2, History, Activity, TrendingDown, Clock, LogIn, ShieldX, LayoutDashboard, Building2, Users, FileClock, ChevronLeft, HardDrive, RefreshCw, Settings2, Copy, GripVertical, ArrowUp, ArrowDown, RotateCcw, Eye, EyeOff, LayoutGrid, PanelsTopLeft, Bell, Palette, Megaphone, Sparkles, Gift, Info, ImagePlus, X } from "lucide-react";
import { THEME } from "../shared.js";
import { changeMyPassword } from "../sessionToken.js";
import { loadModuleConfig, saveModuleConfig, loadDashboardConfig, saveDashboardConfig, loadNotificationTypes, saveNotificationType, syncNotificationTypesWithPlans, loadAppearanceConfig, saveAppearanceConfig, loadAllAnnouncements, createAnnouncement, updateAnnouncement, setAnnouncementActive, deleteAnnouncement, loadDashboardWidgetConfig, saveDashboardWidgetConfig } from "../systemConfigApi.js";
import { uploadBase64ToStorage, deleteFromStorage, parseStorageUrl } from "../offline/storageUpload.js";
import AccountManagement from "./AccountManagement.jsx";
import { toJalaliSafe, toJalaliDateTime, JalaliDateInput } from "../personnel/jalaliDate.jsx";
>>>>>>> 62c9c73 (Upload project files)
import {
  loadCompanies, createCompany, updateCompany, deleteCompanySecure, setCompanyActive,
  loadCompanyPayments, addCompanyPayment, PAYMENT_TYPES,
  loadCompanyUserAccounts,
<<<<<<< HEAD
  SUBSCRIPTION_TYPES, SUBSCRIPTION_STATUSES, subscriptionStatusMeta,
=======
  SUBSCRIPTION_TYPES, SUBSCRIPTION_STATUSES,
>>>>>>> 62c9c73 (Upload project files)
  loadPlans, createPlan, updatePlan, deactivatePlan, movePlan, deletePlan, assignPlanToCompany, loadCompanySubscriptionHistory,
  PLAN_FEATURES, computeContractAmount, computeMonthlyRecurringAmount,
  computePaymentStatus, isPaymentOverdue, computeMonthlyPaymentAlarm, computeSubscriptionAlertTier,
  loadCompanyUsageStats, loadRecentLogins, loadRecentFailedLogins, computeInactiveCompanies,
  loadAuditLog, loadStorageUsage, setStorageCapacity, storageUsageStatus,
  copyBowtiesToCompany, copyRiskKnowledgeToCompany,
} from "./superAdminApi.js";
<<<<<<< HEAD
=======
import { computeSubscriptionAccess, loadOnlinePaymentsForCompany } from "../subscriptionApi.js";
>>>>>>> 62c9c73 (Upload project files)

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${THEME.border}`, fontSize: 12.5, fontFamily: THEME.font, boxSizing: "border-box" };
const btnStyle = (bg) => ({ padding: "7px 14px", borderRadius: 8, border: "none", background: bg || THEME.teal, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font });

export default function SuperAdminPanel({ currentAdmin, onLogout }) {
  const [page, setPage] = useState("overview");
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [usageStats, setUsageStats] = useState({ personnelByCompany: {}, anomalyByCompany: {}, attachmentByCompany: {} });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("trial");
<<<<<<< HEAD
=======
  const [newStatus, setNewStatus] = useState("active");
  const [newStartDate, setNewStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newStartTime, setNewStartTime] = useState("00:00");
  const [newEndDate, setNewEndDate] = useState("");
  const [newEndTime, setNewEndTime] = useState("00:00");
>>>>>>> 62c9c73 (Upload project files)
  const [expandedId, setExpandedId] = useState(null);
  const [payments, setPayments] = useState({});

  const load = async () => {
    setCompanies(await loadCompanies());
    setPlans(await loadPlans());
    setUsageStats(await loadCompanyUsageStats());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
<<<<<<< HEAD
    const result = await createCompany({ name: newName.trim(), subscriptionType: newType });
    if (!result?.__error) { setNewName(""); setShowCreate(false); await load(); }
=======
    const startIso = newStartDate ? new Date(`${newStartDate}T${newStartTime || "00:00"}:00`).toISOString() : null;
    const endIso = newEndDate ? new Date(`${newEndDate}T${newEndTime || "00:00"}:00`).toISOString() : null;
    const result = await createCompany({ name: newName.trim(), subscriptionType: newType, subscriptionStatus: newStatus, subscriptionStartDate: startIso, subscriptionEndDate: endIso });
    if (!result?.__error) {
      setNewName(""); setNewEndDate(""); setNewStartTime("00:00"); setNewEndTime("00:00");
      setShowCreate(false);
      await load();
    }
>>>>>>> 62c9c73 (Upload project files)
  };

  const handleUpdate = async (id, patch) => {
    await updateCompany(id, patch);
    await load();
  };

  const handleDelete = async (id, confirmName) => {
    const result = await deleteCompanySecure(id, confirmName);
<<<<<<< HEAD
    if (result?.__error) { alert(result.message); return; }
=======
    if (result?.__error) { alert(result.message + (result.detail ? `\n\nجزئیات فنی:\n${result.detail}` : "")); return; }
>>>>>>> 62c9c73 (Upload project files)
    await load();
  };

  const handleSetActive = async (id, active) => {
    const result = await setCompanyActive(id, active);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  const toggleExpand = async (c) => {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    if (!payments[c.id]) setPayments((prev) => ({ ...prev, [c.id]: loadCompanyPayments(c.id) }));
  };

  const handleAddPayment = async (companyId, amount, paymentType, trackingNumber, note) => {
    if (!amount) return;
    await addCompanyPayment(companyId, Number(amount), paymentType, trackingNumber, note);
    setPayments((prev) => ({ ...prev, [companyId]: loadCompanyPayments(companyId) }));
  };

  const summary = {
    total: companies.length,
    active: companies.filter((c) => c.subscriptionStatus === "active").length,
    expired: companies.filter((c) => c.subscriptionStatus === "expired").length,
    disabled: companies.filter((c) => c.subscriptionStatus === "disabled").length,
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  const NAV_ITEMS = [
    { key: "overview", label: "نمای کلی", icon: LayoutDashboard },
    { key: "companies", label: "شرکت‌ها", icon: Building2 },
    { key: "accounts", label: "حساب‌ها", icon: Users },
    { key: "plans", label: "پلن‌ها", icon: Layers },
    { key: "storage", label: "Storage & Usage", icon: HardDrive },
    { key: "monitoring", label: "مانیتورینگ و تحلیل", icon: Activity },
    { key: "systemConfig", label: "پیکربندی سامانه", icon: Settings2 },
    { key: "auditLog", label: "گزارش تغییرات", icon: FileClock },
  ];

  return (
    <div style={{ background: THEME.bg, minHeight: "100vh", fontFamily: THEME.font }}>
      <div style={{ background: THEME.navyDeep, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={18} />
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Super Admin — مالک سامانه</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{currentAdmin?.fullName}</span>
          <button type="button" onClick={() => setShowChangePassword((v) => !v)} style={{ ...btnStyle("rgba(255,255,255,0.15)"), display: "flex", alignItems: "center", gap: 6 }}>
            <KeyRound size={13} /> تغییر رمز من
          </button>
          <button type="button" onClick={onLogout} style={{ ...btnStyle("rgba(255,255,255,0.15)"), display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={13} /> خروج
          </button>
        </div>
      </div>

      {showChangePassword && <SuperAdminChangePassword onClose={() => setShowChangePassword(false)} />}

      <div style={{ display: "flex", alignItems: "flex-start", maxWidth: 1400, margin: "0 auto" }}>
        <nav style={{ width: 200, flexShrink: 0, background: THEME.surface, borderInlineStart: `1px solid ${THEME.border}`, minHeight: "calc(100vh - 53px)", padding: "16px 10px" }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = page === item.key;
            return (
              <button
                key={item.key} type="button" onClick={() => setPage(item.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "right",
                  padding: "10px 12px", borderRadius: 8, border: "none", marginBottom: 4, cursor: "pointer",
                  background: active ? THEME.teal : "transparent", color: active ? "#fff" : THEME.text2,
                  fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: THEME.font,
                }}
              >
                <Icon size={14} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, padding: 18, minWidth: 0 }}>
          {page === "overview" && (
            <DashboardOverview
              companies={companies} summary={summary} usageStats={usageStats}
              onNavigate={setPage}
            />
          )}
          {page === "companies" && (
            <CompaniesPage
              companies={companies} plans={plans} currentAdmin={currentAdmin} usageStats={usageStats}
<<<<<<< HEAD
              expandedId={expandedId} showCreate={showCreate} newName={newName} newType={newType}
=======
              expandedId={expandedId} showCreate={showCreate} newName={newName} newType={newType} newStatus={newStatus} setNewStatus={setNewStatus}
              newStartDate={newStartDate} setNewStartDate={setNewStartDate} newStartTime={newStartTime} setNewStartTime={setNewStartTime}
              newEndDate={newEndDate} setNewEndDate={setNewEndDate} newEndTime={newEndTime} setNewEndTime={setNewEndTime}
>>>>>>> 62c9c73 (Upload project files)
              setShowCreate={setShowCreate} setNewName={setNewName} setNewType={setNewType}
              onCreate={handleCreate} onToggleExpand={toggleExpand}
              onUpdate={handleUpdate} onDelete={handleDelete} onSetActive={handleSetActive}
              payments={payments} onAddPayment={handleAddPayment} onPlanChanged={load}
            />
          )}
          {page === "accounts" && <AccountManagement currentAdmin={currentAdmin} />}
<<<<<<< HEAD
          {page === "plans" && <PlansManager plans={plans} currentAdmin={currentAdmin} onChanged={load} />}
=======
          {page === "plans" && <PlansManager plans={plans} companies={companies} currentAdmin={currentAdmin} onChanged={load} />}
>>>>>>> 62c9c73 (Upload project files)
          {page === "storage" && <StorageUsagePage />}
          {page === "monitoring" && <SystemInsights companies={companies} />}
          {page === "systemConfig" && <SystemConfigPage currentAdmin={currentAdmin} companies={companies} />}
          {page === "auditLog" && <AuditLogPage companies={companies} />}
        </div>
      </div>
    </div>
  );
}

function DashboardOverview({ companies, summary, usageStats, onNavigate }) {
  const [failedLoginCount, setFailedLoginCount] = useState(null);
  const [inactiveCount, setInactiveCount] = useState(null);
  const [paymentAlertCount, setPaymentAlertCount] = useState(null);

  useEffect(() => {
    if (companies.length === 0) return;
    loadRecentFailedLogins(30).then((rows) => {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      setFailedLoginCount(rows.filter((r) => new Date(r.created_at).getTime() >= since).length);
    });
    computeInactiveCompanies(companies, 30).then((rows) => setInactiveCount(rows.length));
    Promise.all(companies.map((c) => loadCompanyPayments(c.id).then((rows) => computePaymentStatus(c.finalAmount, rows).remaining > 0))).then(
      (flags) => setPaymentAlertCount(flags.filter(Boolean).length)
    );
  }, [companies]);

  // هشدار پایان اشتراک — پلکان دقیق (۳۰/۱۵/۷/۳/امروز/منقضی)، نه فقط یک بازه‌ی ساده
  const subscriptionAlertCount = companies.filter((c) => computeSubscriptionAlertTier(c.subscriptionEndDate)).length;
  const totalPersonnel = Object.values(usageStats?.personnelByCompany || {}).reduce((a, b) => a + b, 0);
  const totalAnomalies = Object.values(usageStats?.anomalyByCompany || {}).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h2 style={{ fontSize: 16, color: THEME.navy, fontWeight: 700, margin: "0 0 14px" }}>نمای کلی</h2>

      <StorageOverviewCard onNavigate={onNavigate} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, overflow: "hidden", marginBottom: 16 }}>
        <StatBox label="کل شرکت‌ها" value={summary.total} />
        <StatBox label="اشتراک فعال" value={summary.active} color="#166534" />
        <StatBox label="منقضی" value={summary.expired} color="#c92a2a" />
        <StatBox label="غیرفعال" value={summary.disabled} color="#5b6b7d" />
        <StatBox label="کل پرسنل ثبت‌شده" value={totalPersonnel} />
        <StatBox label="کل آنومالی ثبت‌شده" value={totalAnomalies} />
      </div>

      <h3 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>نیازمند توجه</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        <AttentionCard
          icon={AlertTriangle} color="#92400e" bg="#fef3c7"
          label="هشدار پایان اشتراک (تا ۳۰ روز)" value={subscriptionAlertCount}
          onClick={() => onNavigate("monitoring")}
        />
        <AttentionCard
          icon={CreditCard} color="#b91c1c" bg="#fee2e2"
          label="شرکت‌های دارای مانده‌حساب" value={paymentAlertCount}
          onClick={() => onNavigate("monitoring")}
        />
        <AttentionCard
          icon={TrendingDown} color="#b91c1c" bg="#fee2e2"
          label="شرکت‌های کم‌فعالیت (۳۰ روز)" value={inactiveCount}
          onClick={() => onNavigate("monitoring")}
        />
        <AttentionCard
          icon={ShieldX} color="#b91c1c" bg="#fee2e2"
          label="تلاش ناموفق ورود (۲۴ ساعت اخیر)" value={failedLoginCount}
          onClick={() => onNavigate("monitoring")}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <QuickLinkCard icon={Building2} label="مدیریت شرکت‌ها" onClick={() => onNavigate("companies")} />
        <QuickLinkCard icon={Users} label="مدیریت حساب‌ها" onClick={() => onNavigate("accounts")} />
        <QuickLinkCard icon={Layers} label="مدیریت پلن‌ها" onClick={() => onNavigate("plans")} />
        <QuickLinkCard icon={FileClock} label="گزارش تغییرات" onClick={() => onNavigate("auditLog")} />
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes === 0) return "۰ MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} MB`;
  return `${(mb / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} GB`;
}

// هوک ساده‌ی داخلی — بارگذاری اولیه + رفرش دستی + رفرش خودکار حداکثر هر ۶۰ ثانیه
function useStorageData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    const result = await loadStorageUsage();
    setLoading(false);
    if (result?.__error) { setError(result.message); return; }
    setError("");
    setData(result);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, refresh };
}

function StorageOverviewCard({ onNavigate }) {
  const { data, loading, error, refresh } = useStorageData();

  const capacityBytes = data?.capacityMb ? data.capacityMb * 1024 * 1024 : null;
  const usedBytes = data?.totalBytesUsed || 0;
  const percent = capacityBytes ? Math.min(100, (usedBytes / capacityBytes) * 100) : null;
  const status = percent != null ? storageUsageStatus(percent) : null;

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <HardDrive size={14} color={THEME.teal} /> Storage
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate("storage")} style={{ ...btnStyle(THEME.navyMid), fontSize: 11 }}>جزئیات</button>
          )}
          <button type="button" onClick={refresh} disabled={loading} style={{ ...btnStyle(THEME.navyMid), fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={11} /> {loading ? "..." : "رفرش"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: THEME.danger, fontSize: 12 }}>{error}</p>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 12 }}>
            <MiniStat label="ظرفیت کل" value={capacityBytes ? formatBytes(capacityBytes) : "تنظیم‌نشده"} />
            <MiniStat label="مصرف‌شده" value={formatBytes(usedBytes)} />
            <MiniStat label="باقی‌مانده" value={capacityBytes ? formatBytes(Math.max(0, capacityBytes - usedBytes)) : "—"} />
            <MiniStat label="درصد مصرف" value={percent != null ? `${percent.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪` : "—"} color={status?.color} />
          </div>
          {percent != null && (
            <div style={{ height: 8, background: "#eef1f5", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${percent}%`, background: status.color, transition: "width 0.3s" }} />
            </div>
          )}
          {status && (
            <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: status.bg, color: status.color, fontWeight: 600 }}>
              وضعیت: {status.label}
            </span>
          )}
          <p style={{ fontSize: 10.5, color: THEME.text3, marginTop: 10, marginBottom: 0 }}>
            آخرین به‌روزرسانی: {new Date(data.generatedAt).toLocaleTimeString("fa-IR")}
          </p>
        </>
      )}
      {!data && loading && <p style={{ fontSize: 12, color: THEME.text3 }}>در حال بارگذاری...</p>}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || THEME.navy }}>{value}</div>
      <div style={{ fontSize: 10.5, color: THEME.text3, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StorageUsagePage() {
  const { data, loading, error, refresh } = useStorageData();
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState("");
  const [savingCapacity, setSavingCapacity] = useState(false);

  const capacityBytes = data?.capacityMb ? data.capacityMb * 1024 * 1024 : null;
  const usedBytes = data?.totalBytesUsed || 0;
  const percent = capacityBytes ? Math.min(100, (usedBytes / capacityBytes) * 100) : null;
  const status = percent != null ? storageUsageStatus(percent) : null;

  const handleSaveCapacity = async () => {
    const mb = Number(capacityInput);
    if (!mb || mb <= 0) return;
    setSavingCapacity(true);
    const result = await setStorageCapacity(mb);
    setSavingCapacity(false);
    if (result?.__error) { alert(result.message); return; }
    setEditingCapacity(false);
    await refresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, color: THEME.navy, fontWeight: 700, margin: 0 }}>Storage & Usage</h2>
        <button type="button" onClick={refresh} disabled={loading} style={{ ...btnStyle(THEME.navyMid), display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={13} /> {loading ? "در حال رفرش..." : "رفرش"}
        </button>
      </div>

      <p style={{ fontSize: 11, color: THEME.text3, marginBottom: 14, lineHeight: 1.8 }}>
        عدد «ظرفیت کل» یک تنظیمات سیستمی است (مطابق پلن اشتراک واقعی Supabase شما) — چون خودِ Supabase این عدد را از طریق API عمومی نمی‌دهد.
        بقیه‌ی اعداد (مصرف کل، مصرف هر شرکت، تفکیک هر Bucket) مستقیم و زنده از Storage واقعی خوانده می‌شوند.
        این صفحه حداکثر هر ۶۰ ثانیه خودکار به‌روز می‌شود.
      </p>

      {error && <p style={{ color: THEME.danger, fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {data && (
        <>
          <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: 0 }}>خلاصه‌ی کلی</h3>
              <button type="button" onClick={() => { setEditingCapacity((v) => !v); setCapacityInput(String(data.capacityMb || "")); }} style={{ ...btnStyle(THEME.navyMid), fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                <Settings2 size={11} /> تنظیم ظرفیت کل
              </button>
            </div>

            {editingCapacity && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, background: THEME.bg, padding: 10, borderRadius: 8 }}>
                <input type="number" style={{ ...inputStyle, width: 160 }} value={capacityInput} onChange={(e) => setCapacityInput(e.target.value)} placeholder="ظرفیت به مگابایت" dir="ltr" />
                <button type="button" onClick={handleSaveCapacity} disabled={savingCapacity} style={btnStyle()}>{savingCapacity ? "..." : "ذخیره"}</button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 12 }}>
              <MiniStat label="ظرفیت کل" value={capacityBytes ? formatBytes(capacityBytes) : "تنظیم‌نشده"} />
              <MiniStat label="مصرف‌شده" value={formatBytes(usedBytes)} />
              <MiniStat label="باقی‌مانده" value={capacityBytes ? formatBytes(Math.max(0, capacityBytes - usedBytes)) : "—"} />
              <MiniStat label="درصد مصرف" value={percent != null ? `${percent.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪` : "—"} color={status?.color} />
              <MiniStat label="تعداد کل فایل‌ها" value={data.totalObjects?.toLocaleString("fa-IR") ?? "—"} />
            </div>
            {percent != null && (
              <div style={{ height: 10, background: "#eef1f5", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${percent}%`, background: status.color, transition: "width 0.3s" }} />
              </div>
            )}
            <p style={{ fontSize: 10.5, color: THEME.text3, margin: 0 }}>
              آخرین به‌روزرسانی: {new Date(data.generatedAt).toLocaleString("fa-IR")}
            </p>
          </div>

          <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "0 0 12px" }}>مصرف هر شرکت</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>شرکت</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>فضای اختصاص‌یافته</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>مصرف واقعی</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>باقی‌مانده</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>درصد مصرف</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCompany.map((c) => {
                    const allocBytes = c.allocatedMb * 1024 * 1024;
                    const pct = allocBytes ? Math.min(100, (c.usedBytes / allocBytes) * 100) : 0;
                    const st = storageUsageStatus(pct);
                    return (
                      <tr key={c.companyId} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{c.companyName}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{formatBytes(allocBytes)}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{formatBytes(c.usedBytes)}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{formatBytes(Math.max(0, allocBytes - c.usedBytes))}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{pct.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {data.byCompany.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>هنوز هیچ فایلی به شرکتی نسبت داده نشده است</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
            <h3 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "0 0 12px" }}>تفکیک بر اساس Bucket</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>Bucket</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>حجم مصرفی</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>تعداد فایل</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byBucket.map((b) => (
                    <tr key={b.bucket} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "8px", fontWeight: 600, direction: "ltr", textAlign: "right" }}>{b.bucket}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{formatBytes(b.bytesUsed)}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{b.objectCount.toLocaleString("fa-IR")}</td>
                    </tr>
                  ))}
                  {data.byBucket.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>هیچ Bucket ای یافت نشد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {!data && loading && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 30 }}>در حال بارگذاری...</p>}
    </div>
  );
}

function AttentionCard({ icon: Icon, color, bg, label, value, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, background: bg, border: "none", borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "right", fontFamily: THEME.font }}
    >
      <Icon size={18} color={color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value === null ? "…" : value.toLocaleString("fa-IR")}</div>
        <div style={{ fontSize: 11, color, opacity: 0.85 }}>{label}</div>
      </div>
    </button>
  );
}

function QuickLinkCard({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", fontFamily: THEME.font }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: THEME.navy, fontWeight: 600 }}>
        <Icon size={14} color={THEME.teal} /> {label}
      </span>
      <ChevronLeft size={14} color={THEME.text3} />
    </button>
  );
}

function CompaniesPage({
<<<<<<< HEAD
  companies, plans, currentAdmin, usageStats, expandedId, showCreate, newName, newType,
=======
  companies, plans, currentAdmin, usageStats, expandedId, showCreate, newName, newType, newStatus, setNewStatus,
  newStartDate, setNewStartDate, newStartTime, setNewStartTime, newEndDate, setNewEndDate, newEndTime, setNewEndTime,
>>>>>>> 62c9c73 (Upload project files)
  setShowCreate, setNewName, setNewType, onCreate, onToggleExpand, onUpdate, onDelete, onSetActive,
  payments, onAddPayment, onPlanChanged,
}) {
  return (
    <div>
      <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: 0 }}>شرکت‌های مشتری</h3>
          <button type="button" onClick={() => setShowCreate((v) => !v)} style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> شرکت جدید
          </button>
        </div>

        {showCreate && (
<<<<<<< HEAD
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", background: THEME.bg, padding: 12, borderRadius: 8 }}>
            <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="نام شرکت" value={newName} onChange={(e) => setNewName(e.target.value)} dir="rtl" />
            <select style={inputStyle} value={newType} onChange={(e) => setNewType(e.target.value)} dir="rtl">
              {SUBSCRIPTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
=======
          <div style={{ marginBottom: 14, background: THEME.bg, padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="نام شرکت" value={newName} onChange={(e) => setNewName(e.target.value)} dir="rtl" />
              <select style={inputStyle} value={newType} onChange={(e) => setNewType(e.target.value)} dir="rtl">
                {SUBSCRIPTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select style={inputStyle} value={newStatus} onChange={(e) => setNewStatus(e.target.value)} dir="rtl">
                {SUBSCRIPTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <p style={{ fontSize: 11, color: THEME.text3, margin: "0 0 6px", fontWeight: 600 }}>
              تاریخ و ساعت دقیق شروع و پایان دوره (به شمسی) — نه مدت‌زمان به روز یا ماه:
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 10.5, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 3 }}>شروع — تاریخ</label>
                <JalaliDateInput value={newStartDate} onChange={setNewStartDate} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 3 }}>شروع — ساعت</label>
                <input type="time" style={inputStyle} value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 3 }}>پایان — تاریخ</label>
                <JalaliDateInput value={newEndDate} onChange={setNewEndDate} allowEmpty />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 3 }}>پایان — ساعت</label>
                <input type="time" style={inputStyle} value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
              </div>
            </div>
            {newStartDate && newEndDate && (
              <p style={{ fontSize: 11.5, color: THEME.navy, fontWeight: 600, margin: "0 0 8px" }}>
                از <b>{toJalaliDateTime(new Date(`${newStartDate}T${newStartTime || "00:00"}:00`).toISOString())}</b>
                {" "}تا <b>{toJalaliDateTime(new Date(`${newEndDate}T${newEndTime || "00:00"}:00`).toISOString())}</b>
              </p>
            )}
>>>>>>> 62c9c73 (Upload project files)
            <button type="button" onClick={onCreate} style={btnStyle()}>ثبت</button>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>نام شرکت</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>تاریخ ثبت‌نام</th>
<<<<<<< HEAD
                <th style={{ textAlign: "center", padding: "6px 8px" }}>نوع اشتراک</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>وضعیت</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>پایان اشتراک</th>
=======
                <th style={{ textAlign: "center", padding: "6px 8px" }}>پلن و وضعیت اشتراک</th>
>>>>>>> 62c9c73 (Upload project files)
                <th style={{ textAlign: "center", padding: "6px 8px" }}>آخرین ورود</th>
                <th style={{ padding: "6px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
<<<<<<< HEAD
                const sm = subscriptionStatusMeta(c.subscriptionStatus);
=======
                const access = computeSubscriptionAccess(c);
                const planName = plans.find((p) => p.id === c.planId)?.name || "بدون پلن";
>>>>>>> 62c9c73 (Upload project files)
                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "8px", fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{toJalaliSafe(c.registeredAt) || "—"}</td>
<<<<<<< HEAD
                      <td style={{ padding: "8px", textAlign: "center" }}>{SUBSCRIPTION_TYPES.find((t) => t.value === c.subscriptionType)?.label}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: sm.bg, color: sm.color, fontWeight: 600 }}>{sm.label}</span>
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{toJalaliSafe(c.subscriptionEndDate) || "—"}</td>
=======
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: access.isLocked ? "#fee2e2" : "#dcfce7", color: access.isLocked ? "#991b1b" : "#166534", fontWeight: 600 }}>
                          {planName} — {access.label}
                        </span>
                      </td>
>>>>>>> 62c9c73 (Upload project files)
                      <td style={{ padding: "8px", textAlign: "center", color: THEME.text3 }}>{c.lastLoginAt ? toJalaliSafe(c.lastLoginAt) : "هنوز وارد نشده"}</td>
                      <td style={{ padding: "8px", textAlign: "left" }}>
                        <button type="button" onClick={() => onToggleExpand(c)} style={{ ...btnStyle(THEME.navyMid), fontSize: 11 }}>
                          {expandedId === c.id ? "بستن" : "مدیریت"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr>
<<<<<<< HEAD
                        <td colSpan={7} style={{ padding: 0 }}>
=======
                        <td colSpan={5} style={{ padding: 0 }}>
>>>>>>> 62c9c73 (Upload project files)
                          <CompanyManagePanel
                            company={c}
                            companies={companies}
                            plans={plans}
                            currentAdmin={currentAdmin}
                            usageStats={usageStats}
                            onUpdate={(patch) => onUpdate(c.id, patch)}
                            onDelete={(confirmName) => onDelete(c.id, confirmName)}
                            onSetActive={(active) => onSetActive(c.id, active)}
                            paymentsPromise={payments[c.id]}
                            onAddPayment={(amount, paymentType, trackingNum, note) => onAddPayment(c.id, amount, paymentType, trackingNum, note)}
                            onPlanChanged={onPlanChanged}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {companies.length === 0 && (
<<<<<<< HEAD
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>هنوز شرکتی ثبت نشده است</td></tr>
=======
                <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>هنوز شرکتی ثبت نشده است</td></tr>
>>>>>>> 62c9c73 (Upload project files)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// پیکربندی سامانه — سه تب: مدیریت ماژول‌ها و مدیریت داشبورد کاملاً واقعی و
// متصل به system_module_config/system_dashboard_config هستند و مستقیم
// روی Sidebar/صفحه‌ی اصلی همه‌ی کاربران اثر می‌گذارند. مدیریت اعلان‌ها و
// تنظیمات ظاهری (لوگو/رنگ/فونت/تم) فاز بعدی این بخش‌اند و عمداً اینجا
// ساخته نشده‌اند — طبق الزام صریح «صرفاً UI نمایشی ایجاد نکن»، ظرفیت
// موجود «ارسال پیام سیستمی» به‌جای حذف، همین‌جا نگه داشته شده.
// تنظیمات ظاهری (لوگو/رنگ/فونت/تم) و مدیریت اعلان‌ها/اطلاعیه‌ها اکنون
// کامل و متصل به دیتابیس‌اند. ظرفیت «ارسال پیام سیستمی» طبق خواسته‌ی
// صریح به «اطلاعیه‌های سامانه» تغییر نام یافت و به یک سیستم مدیریت
// کامل (چند اطلاعیه، اولویت، بازه‌ی زمانی، فعال/غیرفعال) ارتقا یافت —
// روی همان جدول system_announcements موجود، بدون هیچ ساختار موازی.
const SYSTEM_CONFIG_TABS = [
  { key: "modules", label: "مدیریت ماژول‌ها", icon: LayoutGrid },
  { key: "dashboard", label: "مدیریت داشبورد", icon: PanelsTopLeft },
  { key: "notifications", label: "مدیریت اعلان‌ها", icon: Bell },
  { key: "appearance", label: "تنظیمات ظاهری", icon: Palette },
  { key: "announcements", label: "اطلاعیه‌های سامانه", icon: Megaphone },
];

function SystemConfigPage({ currentAdmin, companies }) {
  const [tab, setTab] = useState("modules");
  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: `1.5px solid ${THEME.border}`, marginBottom: 16 }}>
        {SYSTEM_CONFIG_TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: THEME.font, fontSize: 12.5,
              color: tab === t.key ? THEME.teal : THEME.text3, fontWeight: tab === t.key ? 700 : 500,
              borderBottom: tab === t.key ? `2.5px solid ${THEME.teal}` : "2.5px solid transparent",
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "modules" && <ModuleManagementTab currentAdmin={currentAdmin} />}
      {tab === "dashboard" && <DashboardManagementTab currentAdmin={currentAdmin} />}
      {tab === "notifications" && <NotificationManagementTab currentAdmin={currentAdmin} />}
      {tab === "appearance" && <AppearanceManagementTab currentAdmin={currentAdmin} />}
      {tab === "announcements" && <AnnouncementManagementTab currentAdmin={currentAdmin} companies={companies} />}
    </div>
  );
}

// همان لیست/ترتیب/برچسب پیش‌فرضی که در SQL seed شده — برای «بازگردانی
// ترتیب پیش‌فرض» بدون نیاز به رفت‌وبرگشت اضافه با دیتابیس.
const DEFAULT_MODULE_CONFIG = [
  { moduleKey: "chat", displayLabel: "چت", description: "ارتباط مستقیم بین کاربران سامانه" },
  { moduleKey: "archiveManagement", displayLabel: "آرشیو فایل‌ها", description: "بایگانی و جست‌وجوی اسناد و مدارک ثبت‌شده" },
  { moduleKey: "anomalyReport", displayLabel: "مدیریت عدم انطباق‌ها", description: "ثبت، پیگیری و اقدام اصلاحی موارد عدم انطباق HSE" },
  { moduleKey: "riskAssessment", displayLabel: "مدیریت ارزیابی ریسک", description: "تحلیل BowTie، HCMS و بانک دانش ریسک" },
  { moduleKey: "personnelAccess", displayLabel: "مدیریت ورود و تردد پرسنل", description: "ثبت و پیگیری وضعیت پرسنل و مدارک ایشان" },
  { moduleKey: "proactiveIndicators", displayLabel: "شاخص‌های Proactive HSE", description: "اندازه‌گیری استعداد حادثه‌پذیری و جو ایمنی سازمان" },
  { moduleKey: "incidentManagement", displayLabel: "مدیریت حوادث", description: "ثبت حوادث و تحلیل ریشه‌ای Tripod Beta" },
<<<<<<< HEAD
  { moduleKey: "machineryManagement", displayLabel: "مدیریت ماشین‌آلات و تجهیزات", description: "پیگیری وضعیت و مجوزهای ماشین‌آلات" },
=======
  { moduleKey: "machineryManagement", displayLabel: "مدیریت ماشین‌آلات", description: "پیگیری وضعیت و مجوزهای ماشین‌آلات" },
>>>>>>> 62c9c73 (Upload project files)
  { moduleKey: "scaffoldManagement", displayLabel: "مدیریت داربست", description: "صدور و پیگیری تگ‌های داربست" },
  { moduleKey: "managementDashboard", displayLabel: "داشبورد مدیریتی", description: "گزارش‌های تحلیلی و شاخص‌های کلان HSE" },
];

function ModuleManagementTab({ currentAdmin }) {
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dragIndex, setDragIndex] = useState(null);

  const load = () => loadModuleConfig().then((rows) => setList(rows.length > 0 ? rows : DEFAULT_MODULE_CONFIG));
  useEffect(() => { load(); }, []);

  if (!list) return <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 30 }}>در حال بارگذاری...</p>;

  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[idx], next[to]] = [next[to], next[idx]];
    setList(next);
  };

  const handleDrop = (idx) => {
    if (dragIndex === null || dragIndex === idx) return;
    const next = [...list];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setList(next);
    setDragIndex(null);
  };

  const updateField = (idx, field, value) => {
    const next = [...list];
    next[idx] = { ...next[idx], [field]: value };
    setList(next);
  };

  const handleSave = async () => {
    setSaving(true); setMessage("");
    const result = await saveModuleConfig(list, currentAdmin?.fullName);
    setSaving(false);
    setMessage(result?.__error ? result.message : "تنظیمات ماژول‌ها ذخیره شد.");
    if (!result?.__error) await load();
  };

  const handleReset = () => setList(DEFAULT_MODULE_CONFIG.map((m) => ({ ...m })));

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
      <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 14, lineHeight: 1.8 }}>
        ترتیب، نام نمایشی و توضیح کوتاه هر ماژول اصلی — این تنظیمات مستقیم روی Sidebar همه‌ی کاربران سامانه اثر می‌گذارد.
        آیکون و دسترسی هر ماژول از تنظیمات پلن/مجوز تغییر نمی‌کند.
      </p>
      {list.map((m, idx) => (
        <div
          key={m.moduleKey}
          draggable
          onDragStart={() => setDragIndex(idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(idx)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: `1px solid ${THEME.border}`, background: dragIndex === idx ? THEME.bg : "transparent" }}
        >
          <GripVertical size={15} color={THEME.text3} style={{ cursor: "grab", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, padding: 1 }}><ArrowUp size={13} color={THEME.text2} /></button>
            <button type="button" onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={{ background: "none", border: "none", cursor: idx === list.length - 1 ? "default" : "pointer", opacity: idx === list.length - 1 ? 0.3 : 1, padding: 1 }}><ArrowDown size={13} color={THEME.text2} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, flex: 1, minWidth: 0 }}>
            <input style={inputStyle} value={m.displayLabel} onChange={(e) => updateField(idx, "displayLabel", e.target.value)} dir="rtl" />
            <input style={inputStyle} placeholder="توضیح کوتاه (اختیاری)" value={m.description} onChange={(e) => updateField(idx, "description", e.target.value)} dir="rtl" />
          </div>
        </div>
      ))}
      {message && <p style={{ fontSize: 11.5, color: message.includes("خطا") ? THEME.danger : "#166534", marginTop: 10 }}>{message}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" style={btnStyle()} onClick={handleSave} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره تغییرات"}</button>
        <button type="button" style={{ ...btnStyle(THEME.text3), display: "flex", alignItems: "center", gap: 6 }} onClick={handleReset}>
          <RotateCcw size={13} /> بازگردانی ترتیب پیش‌فرض
        </button>
      </div>
    </div>
  );
}

const DEFAULT_DASHBOARD_CONFIG = [
  { kpiKey: "incidentsList", label: "حوادث ثبت‌شده", isVisible: true },
  { kpiKey: "personnelDashboard", label: "پرسنل فعال", isVisible: true },
  { kpiKey: "correctiveActionsList", label: "اقدامات اصلاحی باز", isVisible: true },
  { kpiKey: "anomalyList", label: "عدم انطباق‌های باز", isVisible: true },
];
const KPI_LABELS = Object.fromEntries(DEFAULT_DASHBOARD_CONFIG.map((k) => [k.kpiKey, k.label]));

function DashboardManagementTab({ currentAdmin }) {
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => loadDashboardConfig().then((rows) => setList(rows.length > 0 ? rows : DEFAULT_DASHBOARD_CONFIG.map(({ kpiKey, isVisible }) => ({ kpiKey, isVisible }))));
  useEffect(() => { load(); }, []);

  if (!list) return <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 30 }}>در حال بارگذاری...</p>;

  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[idx], next[to]] = [next[to], next[idx]];
    setList(next);
  };

  const toggleVisible = (idx) => {
    const next = [...list];
    next[idx] = { ...next[idx], isVisible: !next[idx].isVisible };
    setList(next);
  };

  const handleSave = async () => {
    setSaving(true); setMessage("");
    const result = await saveDashboardConfig(list, currentAdmin?.fullName);
    setSaving(false);
    setMessage(result?.__error ? result.message : "تنظیمات داشبورد ذخیره شد.");
    if (!result?.__error) await load();
  };

  const handleReset = () => setList(DEFAULT_DASHBOARD_CONFIG.map(({ kpiKey, isVisible }) => ({ kpiKey, isVisible })));

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
      <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 14, lineHeight: 1.8 }}>
        ترتیب و نمایش/عدم‌نمایش کارت‌های KPI صفحه‌ی اصلی دسکتاپ — روی همه‌ی کاربران سامانه اعمال می‌شود.
      </p>
      {list.map((k, idx) => (
        <div key={k.kpiKey} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: `1px solid ${THEME.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, padding: 1 }}><ArrowUp size={13} color={THEME.text2} /></button>
            <button type="button" onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={{ background: "none", border: "none", cursor: idx === list.length - 1 ? "default" : "pointer", opacity: idx === list.length - 1 ? 0.3 : 1, padding: 1 }}><ArrowDown size={13} color={THEME.text2} /></button>
          </div>
          <span style={{ flex: 1, fontSize: 13, color: THEME.text, fontWeight: 600 }}>{KPI_LABELS[k.kpiKey] || k.kpiKey}</span>
          <button
            type="button" onClick={() => toggleVisible(idx)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: k.isVisible ? "#dcfce7" : "#eef1f5", color: k.isVisible ? "#166534" : THEME.text3, border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font }}
          >
            {k.isVisible ? <Eye size={13} /> : <EyeOff size={13} />} {k.isVisible ? "نمایش داده می‌شود" : "پنهان"}
          </button>
        </div>
      ))}
      {message && <p style={{ fontSize: 11.5, color: message.includes("خطا") ? THEME.danger : "#166534", marginTop: 10 }}>{message}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" style={btnStyle()} onClick={handleSave} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}</button>
        <button type="button" style={{ ...btnStyle(THEME.text3), display: "flex", alignItems: "center", gap: 6 }} onClick={handleReset}>
          <RotateCcw size={13} /> بازگردانی چیدمان پیش‌فرض
        </button>
      </div>
<<<<<<< HEAD
=======
      <DashboardWidgetsSection currentAdmin={currentAdmin} />
    </div>
  );
}

const WIDGET_LABELS = {
  contractorHse: "جدول وضعیت HSE پیمانکاران", urgentAlerts: "هشدارهای فوری", smartInsights: "بینش‌های هوشمند",
  anomalyTrend: "روند عدم انطباق‌ها", healthStatus: "وضعیت سلامت پرسنل", machineryStatus: "وضعیت ماشین‌آلات",
  anomalyByRisk: "عدم انطباق بر اساس ریسک", contractorPerformance: "عملکرد پیمانکاران",
};

function DashboardWidgetsSection({ currentAdmin }) {
  const [widgets, setWidgets] = useState(null);
  const [message, setMessage] = useState("");

  const load = () => loadDashboardWidgetConfig().then(setWidgets);
  useEffect(() => { load(); }, []);

  const toggle = async (widgetKey, current) => {
    setMessage("");
    setWidgets((prev) => prev.map((w) => (w.widgetKey === widgetKey ? { ...w, isVisible: !current } : w)));
    const result = await saveDashboardWidgetConfig(widgetKey, !current, currentAdmin?.fullName);
    if (result?.__error) { setMessage(result.message); await load(); }
  };

  if (!widgets) return null;

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${THEME.border}` }}>
      <h4 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "0 0 6px" }}>مدیریت ماژول‌های داشبورد مدیریتی</h4>
      <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 12, lineHeight: 1.8 }}>
        فعال/غیرفعال کردن هر پنل داخل ماژول «داشبورد مدیریتی» — روی همه‌ی کاربران (کارفرما/پیمانکار) اعمال می‌شود.
      </p>
      {message && <p style={{ fontSize: 11.5, color: THEME.danger, marginBottom: 10 }}>{message}</p>}
      {widgets.map((w) => (
        <div key={w.widgetKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 8px", borderBottom: `1px solid ${THEME.border}` }}>
          <span style={{ fontSize: 12.5, color: THEME.text, fontWeight: 600 }}>{WIDGET_LABELS[w.widgetKey] || w.widgetKey}</span>
          <button
            type="button" onClick={() => toggle(w.widgetKey, w.isVisible)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: w.isVisible ? "#dcfce7" : "#eef1f5", color: w.isVisible ? "#166534" : THEME.text3, border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font }}
          >
            {w.isVisible ? <Eye size={13} /> : <EyeOff size={13} />} {w.isVisible ? "نمایش داده می‌شود" : "پنهان"}
          </button>
        </div>
      ))}
>>>>>>> 62c9c73 (Upload project files)
    </div>
  );
}

const ROLE_LABELS = { all: "همه", employer: "فقط کارفرما", contractor: "فقط پیمانکار" };
const PRIORITY_META = {
  low: { label: "کم", color: "#5b6b7d", bg: "#eef1f5" },
  medium: { label: "متوسط", color: "#92400e", bg: "#fef3c7" },
  high: { label: "بالا", color: "#b91c1c", bg: "#fee2e2" },
};

function NotificationManagementTab({ currentAdmin }) {
  const [list, setList] = useState(null);
  const [message, setMessage] = useState("");

  const load = () => loadNotificationTypes().then(setList);
  useEffect(() => { load(); }, []);

  if (!list) return <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 30 }}>در حال بارگذاری...</p>;

  const updateOne = async (typeKey, patch) => {
    setMessage("");
    const next = list.map((t) => (t.typeKey === typeKey ? { ...t, ...patch } : t));
    setList(next); // به‌روزرسانی خوش‌بینانه — تجربه‌ی کاربری سریع‌تر
    const result = await saveNotificationType(typeKey, patch, currentAdmin?.fullName);
    if (result?.__error) { setMessage(result.message); await load(); }
  };

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
      <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 14, lineHeight: 1.8 }}>
        این تنظیمات مستقیم روی زنگوله‌ی اعلان همه‌ی کاربران اثر می‌گذارد — هر نوع اعلان که اینجا غیرفعال شود، دیگر برای هیچ‌کس نمایش داده نمی‌شود.
      </p>
      {message && <p style={{ fontSize: 11.5, color: THEME.danger, marginBottom: 10 }}>{message}</p>}
      {list.map((t) => (
        <div key={t.typeKey} style={{ padding: "12px 8px", borderBottom: `1px solid ${THEME.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: THEME.navy }}>{t.label}</span>
                <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 999, background: PRIORITY_META[t.priority].bg, color: PRIORITY_META[t.priority].color, fontWeight: 600 }}>
                  اولویت {PRIORITY_META[t.priority].label}
                </span>
                <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 999, background: t.isEnabled ? "#dcfce7" : "#eef1f5", color: t.isEnabled ? "#166534" : THEME.text3, fontWeight: 600 }}>
                  {t.isEnabled ? "فعال" : "غیرفعال"}
                </span>
              </div>
              {t.description && <p style={{ fontSize: 11, color: THEME.text3, margin: "4px 0 0" }}>{t.description}</p>}
            </div>
            <button
              type="button" onClick={() => updateOne(t.typeKey, { isEnabled: !t.isEnabled })}
              style={{ display: "flex", alignItems: "center", gap: 5, background: t.isEnabled ? "#fee2e2" : "#dcfce7", color: t.isEnabled ? "#b91c1c" : "#166534", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font, flexShrink: 0 }}
            >
              {t.isEnabled ? <EyeOff size={13} /> : <Eye size={13} />} {t.isEnabled ? "غیرفعال کن" : "فعال کن"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <div>
              <label style={{ fontSize: 10.5, color: THEME.text3, display: "block", marginBottom: 3 }}>گیرنده</label>
              <select style={{ ...inputStyle, width: 140 }} value={t.targetRole} onChange={(e) => updateOne(t.typeKey, { targetRole: e.target.value })} dir="rtl">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10.5, color: THEME.text3, display: "block", marginBottom: 3 }}>اولویت</label>
              <select style={{ ...inputStyle, width: 110 }} value={t.priority} onChange={(e) => updateOne(t.typeKey, { priority: e.target.value })} dir="rtl">
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {t.warningDays != null && (
              <div>
                <label style={{ fontSize: 10.5, color: THEME.text3, display: "block", marginBottom: 3 }}>هشدار چند روز قبل از مهلت</label>
                <input type="number" style={{ ...inputStyle, width: 100 }} value={t.warningDays} onChange={(e) => updateOne(t.typeKey, { warningDays: Number(e.target.value) || 0 })} dir="ltr" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppearanceManagementTab({ currentAdmin }) {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => loadAppearanceConfig().then(setConfig);
  useEffect(() => { load(); }, []);

  if (!config) return <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 30 }}>در حال بارگذاری...</p>;

  const update = (field, value) => setConfig((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true); setMessage("");
    const result = await saveAppearanceConfig(config, currentAdmin?.fullName);
    setSaving(false);
    setMessage(result?.__error ? result.message : "تنظیمات ظاهری ذخیره شد — برای دیدن اثر کامل روی همه‌ی صفحات، کاربران باید صفحه را رفرش کنند.");
    if (!result?.__error) await load();
  };

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
      <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 16, lineHeight: 1.8 }}>
        این تنظیمات فقط روی اپلیکیشن اصلی مشتری (نه همین پنل Super Admin) اثر می‌گذارد و بعد از ذخیره، برای همه‌ی کاربران با رفرش صفحه اعمال می‌شود.
      </p>

      <SectionLabel>هویت سامانه</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>نام سامانه</label>
          <input style={inputStyle} value={config.systemName} onChange={(e) => update("systemName", e.target.value)} dir="ltr" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>عنوان سامانه (زیرنویس صفحه‌ی ورود)</label>
          <input style={inputStyle} value={config.systemTitle} onChange={(e) => update("systemTitle", e.target.value)} dir="rtl" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>آدرس لوگو (URL)</label>
          <input style={inputStyle} value={config.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} dir="ltr" placeholder="خالی = لوگوی پیش‌فرض IHMS" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>آدرس Favicon (URL)</label>
          <input style={inputStyle} value={config.faviconUrl} onChange={(e) => update("faviconUrl", e.target.value)} dir="ltr" placeholder="خالی = Favicon پیش‌فرض" />
        </div>
      </div>
      {config.logoUrl && (
        <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: THEME.text3 }}>پیش‌نمایش لوگو:</span>
          <img src={config.logoUrl} alt="پیش‌نمایش لوگو" style={{ width: 48, height: 48, objectFit: "contain", border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 4 }} onError={(e) => { e.target.style.display = "none"; }} />
        </div>
      )}

      <SectionLabel>رنگ سازمانی</SectionLabel>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <ColorField label="رنگ اصلی (Navy)" value={config.colorPrimary} onChange={(v) => update("colorPrimary", v)} />
        <ColorField label="رنگ ثانویه (Accent)" value={config.colorAccent} onChange={(v) => update("colorAccent", v)} />
      </div>

      <SectionLabel>تم و قلم</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>تم</label>
          <select style={inputStyle} value={config.themeMode} onChange={(e) => update("themeMode", e.target.value)} dir="rtl">
            <option value="light">روشن</option>
            <option value="dark">تیره</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>خانواده‌ی فونت (CSS font-family)</label>
          <input style={inputStyle} value={config.fontFamily} onChange={(e) => update("fontFamily", e.target.value)} dir="ltr" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>اندازه‌ی پایه‌ی قلم (px، خالی = پیش‌فرض مرورگر)</label>
          <input type="number" style={inputStyle} value={config.fontSizeBase ?? ""} onChange={(e) => update("fontSizeBase", e.target.value ? Number(e.target.value) : null)} dir="ltr" />
        </div>
      </div>

      <SectionLabel>Header و Sidebar</SectionLabel>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: THEME.text2, cursor: "pointer" }}>
          <input type="checkbox" checked={config.headerShowCompanyName} onChange={(e) => update("headerShowCompanyName", e.target.checked)} />
          نمایش نام شرکت در Header
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: THEME.text2, cursor: "pointer" }}>
          <input type="checkbox" checked={config.sidebarDefaultCollapsed} onChange={(e) => update("sidebarDefaultCollapsed", e.target.checked)} />
          Sidebar به‌صورت پیش‌فرض جمع‌شده باشد (برای کاربرانی که هنوز انتخاب شخصی نکرده‌اند)
        </label>
      </div>

<<<<<<< HEAD
=======
      <SectionLabel>مدیریت آیکون اپ موبایل / APK</SectionLabel>
      <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, padding: 14, marginBottom: 18 }}>
        <p style={{ fontSize: 11.5, color: "#7c2d12", margin: "0 0 10px", lineHeight: 1.9 }}>
          چون ساخت APK از طریق GitHub Actions روی مخزن کد انجام می‌شود (نه این پنل)، آیکون اپ به‌صورت آنی از اینجا اعمال نمی‌شود. مسیر واقعی:
        </p>
        <ol style={{ fontSize: 11.5, color: "#7c2d12", margin: "0 0 10px", paddingInlineStart: 18, lineHeight: 2 }}>
          <li>آدرس تصویر آیکون جدید (حداقل ۱۰۲۴×۱۰۲۴ پیکسل، پس‌زمینه‌ی یکدست) را در فیلد زیر وارد و ذخیره کنید.</li>
          <li>همان فایل را دانلود کرده و در مخزن کد، به‌جای <code>resources/icon.png</code> جایگزین/commit کنید.</li>
          <li>Workflow ساخت APK (<code>Build Android APK</code>) را از تب Actions در GitHub اجرا کنید — مرحله‌ی <code>Generate Splash Screen assets</code> در همان workflow، آیکون جدید را خودکار در همه‌ی چگالی‌های اندروید تولید می‌کند.</li>
        </ol>
        <div>
          <label style={{ fontSize: 11, color: "#7c2d12", fontWeight: 600, display: "block", marginBottom: 4 }}>آدرس تصویر آیکون APK (URL)</label>
          <input style={inputStyle} value={config.apkIconUrl} onChange={(e) => update("apkIconUrl", e.target.value)} dir="ltr" placeholder="https://... — فقط برای نگهداری آدرس، جهت دانلود و commit دستی" />
        </div>
        {config.apkIconUrl && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#7c2d12" }}>پیش‌نمایش:</span>
            <img src={config.apkIconUrl} alt="پیش‌نمایش آیکون APK" style={{ width: 48, height: 48, objectFit: "contain", border: "1px solid #fdba74", borderRadius: 8, padding: 4, background: "#fff" }} onError={(e) => { e.target.style.display = "none"; }} />
          </div>
        )}
      </div>

>>>>>>> 62c9c73 (Upload project files)
      {message && <p style={{ fontSize: 11.5, color: message.includes("خطا") ? THEME.danger : "#166534", marginBottom: 10, lineHeight: 1.8 }}>{message}</p>}
      <button type="button" style={btnStyle()} onClick={handleSave} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره‌ی تنظیمات ظاهری"}</button>
    </div>
  );
}

function SectionLabel({ children }) {
  return <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 10px", paddingBottom: 6, borderBottom: `1px solid ${THEME.border}` }}>{children}</h4>;
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 34, border: `1.5px solid ${THEME.border}`, borderRadius: 8, cursor: "pointer", padding: 2 }} />
        <input style={{ ...inputStyle, width: 100 }} value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" />
      </div>
    </div>
  );
}

const ANNOUNCEMENT_ICONS = {
  megaphone: Megaphone, sparkles: Sparkles, gift: Gift, info: Info, bell: Bell,
};

<<<<<<< HEAD
=======
// آپلودر عکس مشترک — یک نمونه برای عکس کارت صفحه‌ی اصلی (۱۶:۹) و یک
// نمونه‌ی جدا برای پس‌زمینه‌ی صفحه‌ی ورود (نسبت عمودی)، چون این دو زمینه
// ابعاد بصری کاملاً متفاوتی دارند.
function AnnouncementImageUploader({ value, aspectRatio, width, uploading, onUpload, onRemove }) {
  // مرورگر رویداد change ورودی فایل را وقتی «همان فایل قبلی» دوباره
  // انتخاب شود، شلیک نمی‌کند (چون از دید مرورگر مقدار تغییر نکرده) —
  // این دقیقاً همان علتی است که «جایگزین می‌کنم هیچ اتفاقی نمی‌افته» را
  // توضیح می‌دهد. با پاک‌کردن e.target.value درست قبل از باز شدن دیالوگ
  // انتخاب فایل (نه فقط بعد از آپلود موفق)، این مشکل کامل رفع می‌شود.
  const clearBeforePick = (e) => { e.target.value = ""; };
  return value ? (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width, aspectRatio, borderRadius: 8, overflow: "hidden", border: `1px solid ${THEME.border}`, flexShrink: 0, background: "#e9eef3" }}>
        <img src={value} alt="پیش‌نمایش" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ ...btnStyle(THEME.navyMid), display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", width: "fit-content" }}>
          <ImagePlus size={13} /> {uploading ? "در حال آپلود..." : "جایگزینی عکس"}
          <input type="file" accept="image/*" onClick={clearBeforePick} onChange={onUpload} disabled={uploading} style={{ display: "none" }} />
        </label>
        <button type="button" onClick={onRemove} style={{ ...btnStyle(THEME.danger), display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }}>
          <X size={13} /> حذف عکس
        </button>
      </div>
    </div>
  ) : (
    <label style={{ ...btnStyle(THEME.navyMid), display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", width: "fit-content" }}>
      <ImagePlus size={13} /> {uploading ? "در حال آپلود..." : "بارگذاری عکس"}
      <input type="file" accept="image/*" onClick={clearBeforePick} onChange={onUpload} disabled={uploading} style={{ display: "none" }} />
    </label>
  );
}

>>>>>>> 62c9c73 (Upload project files)
function AnnouncementManagementTab({ currentAdmin, companies }) {
  const [list, setList] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAnnouncementForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
<<<<<<< HEAD

  function emptyAnnouncementForm() {
    return { companyId: "", title: "", message: "", iconKey: "megaphone", buttonLabel: "", buttonUrl: "", startsAt: "", endsAt: "", priority: 0, isActive: true };
=======
  const [uploadingImage, setUploadingImage] = useState(false);

  function emptyAnnouncementForm() {
    return { companyId: "", title: "", message: "", iconKey: "megaphone", imageUrl: "", loginImageUrl: "", buttonLabel: "", buttonUrl: "", startsAt: "", endsAt: "", priority: 0, isActive: true, displaySeconds: 10, displayLocation: "both" };
>>>>>>> 62c9c73 (Upload project files)
  }

  const load = () => loadAllAnnouncements().then(setList);
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyAnnouncementForm()); setEditingId(null); setShowForm(true); setMessage(""); };
  const openEdit = (a) => {
    setForm({
<<<<<<< HEAD
      companyId: a.companyId || "", title: a.title, message: a.message, iconKey: a.iconKey,
      buttonLabel: a.buttonLabel, buttonUrl: a.buttonUrl,
      startsAt: a.startsAt ? a.startsAt.slice(0, 16) : "", endsAt: a.endsAt ? a.endsAt.slice(0, 16) : "",
      priority: a.priority, isActive: a.isActive,
=======
      companyId: a.companyId || "", title: a.title, message: a.message, iconKey: a.iconKey, imageUrl: a.imageUrl || "", loginImageUrl: a.loginImageUrl || "",
      buttonLabel: a.buttonLabel, buttonUrl: a.buttonUrl,
      startsAt: a.startsAt ? a.startsAt.slice(0, 16) : "", endsAt: a.endsAt ? a.endsAt.slice(0, 16) : "",
      priority: a.priority, isActive: a.isActive, displaySeconds: a.displaySeconds || 10, displayLocation: a.displayLocation || "both",
>>>>>>> 62c9c73 (Upload project files)
    });
    setEditingId(a.id); setShowForm(true); setMessage("");
  };

<<<<<<< HEAD
=======
  // آپلود مستقیم عکس — همان الگوی موجود پروژه (uploadBase64ToStorage)،
  // در باکت اختصاصی announcement-images. طبق درخواست صریح، دو تصویر کاملاً
  // جدا: field='imageUrl' برای کارت صفحه‌ی اصلی (قاب افقی ۱۶:۹) و
  // field='loginImageUrl' برای پس‌زمینه‌ی پنل صفحه‌ی ورود (قاب عمودی/بلند)
  // — چون این دو زمینه ابعاد بصری کاملاً متفاوتی دارند و یک عکس واحد
  // نمی‌تواند بدون افت کیفیت هر دو را درست پوشش دهد.
  const handleImageChange = (field) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage("");
    setUploadingImage(field);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const url = await uploadBase64ToStorage("announcement-images", `${field}-${Date.now()}.${ext}`, base64, file.type || "image/jpeg");
      if (form[field]) {
        const old = parseStorageUrl(form[field]);
        if (old) deleteFromStorage(old.bucket, old.path).catch(() => {});
      }
      setForm((prev) => ({ ...prev, [field]: url }));
    } catch (err) {
      const status = err?.status;
      const rawText = (err?.message || "").replace(/^خطا در آپلود فایل:\s*/, "");
      if (status === 401 || status === 403) {
        setMessage(`آپلود ناموفق بود (کد ${status}): دسترسی نوشتن به باکت «announcement-images» مجاز نیست. جزئیات سرور: ${rawText}`);
      } else {
        // متن دقیق پاسخ سرور همیشه نشان داده می‌شود — چون پیام‌های حدسی
        // قبلی (فقط بر اساس status code) گمراه‌کننده بودند: حتی بعد از
        // ساخته‌شدن باکت، همان پیام تکراری برمی‌گشت، یعنی علت واقعی چیز
        // دیگری بود (نام دقیق باکت، یا محدودیت نوع/حجم فایل).
        setMessage(`آپلود عکس ناموفق بود (کد ${status ?? "نامشخص"}): ${rawText || "خطای نامشخص"}`);
      }
    }
    setUploadingImage(false);
    e.target.value = "";
  };

  const handleRemoveImage = (field) => () => {
    if (form[field]) {
      const old = parseStorageUrl(form[field]);
      if (old) deleteFromStorage(old.bucket, old.path).catch(() => {});
    }
    setForm((prev) => ({ ...prev, [field]: "" }));
  };

>>>>>>> 62c9c73 (Upload project files)
  const handleSave = async () => {
    if (!form.message.trim()) { setMessage("متن اطلاعیه الزامی است"); return; }
    setSaving(true); setMessage("");
    const payload = { ...form, startsAt: form.startsAt || null, endsAt: form.endsAt || null, priority: Number(form.priority) || 0 };
    const result = editingId ? await updateAnnouncement(editingId, payload, currentAdmin?.fullName) : await createAnnouncement(payload, currentAdmin?.fullName);
    setSaving(false);
    if (result?.__error) { setMessage(result.message); return; }
    setShowForm(false);
    await load();
  };

  const handleToggleActive = async (a) => {
    const result = await setAnnouncementActive(a.id, !a.isActive, currentAdmin?.fullName);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  const handleDelete = async (a) => {
    if (!confirm(`اطلاعیه‌ی «${a.title || a.message.slice(0, 30)}» برای همیشه حذف شود؟`)) return;
    const result = await deleteAnnouncement(a.id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0, lineHeight: 1.8, maxWidth: 560 }}>
          کارت اطلاعیه در کنار «خوش‌آمدید» صفحه‌ی اصلی مشتریان نمایش داده می‌شود. اگر چند اطلاعیه‌ی واجد شرایط هم‌زمان فعال باشند، بالاترین اولویت نمایش داده می‌شود.
        </p>
        <button type="button" style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={openCreate}>
          <Plus size={13} /> اطلاعیه‌ی جدید
        </button>
      </div>

      {showForm && (
        <div style={{ background: THEME.bg, borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>عنوان</label>
              <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>آیکون</label>
              <select style={inputStyle} value={form.iconKey} onChange={(e) => setForm({ ...form, iconKey: e.target.value })} dir="rtl">
                <option value="megaphone">📢 اطلاعیه</option>
                <option value="sparkles">✨ ویژگی جدید</option>
                <option value="gift">🎁 پیشنهاد/تبلیغ</option>
                <option value="info">ℹ️ اطلاع‌رسانی</option>
                <option value="bell">🔔 یادآوری</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>شرکت هدف</label>
              <select style={inputStyle} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} dir="rtl">
                <option value="">همه‌ی شرکت‌ها</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>اولویت (عدد بزرگ‌تر = مهم‌تر)</label>
              <input type="number" style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} dir="ltr" />
            </div>
            <div>
<<<<<<< HEAD
=======
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>مدت‌زمان نمایش در اسلایدر</label>
              <select style={inputStyle} value={form.displaySeconds} onChange={(e) => setForm({ ...form, displaySeconds: Number(e.target.value) })} dir="rtl">
                <option value={5}>۵ ثانیه</option>
                <option value={10}>۱۰ ثانیه</option>
                <option value={15}>۱۵ ثانیه</option>
                <option value={30}>۳۰ ثانیه</option>
              </select>
            </div>
            <div>
>>>>>>> 62c9c73 (Upload project files)
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>شروع نمایش (اختیاری)</label>
              <input type="datetime-local" style={inputStyle} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>پایان نمایش (اختیاری)</label>
              <input type="datetime-local" style={inputStyle} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>برچسب دکمه (اختیاری)</label>
              <input style={inputStyle} placeholder="مثلاً مشاهده جزئیات" value={form.buttonLabel} onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>لینک/مقصد دکمه (اختیاری)</label>
              <input style={inputStyle} placeholder="https:// یا نام یک ماژول داخلی" value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} dir="ltr" />
            </div>
          </div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>متن اطلاعیه</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} dir="rtl" />
<<<<<<< HEAD
=======

          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4, marginTop: 10 }}>عکس کارت صفحه‌ی اصلی (اختیاری)</label>
          <p style={{ fontSize: 10.5, color: THEME.text3, margin: "0 0 8px", lineHeight: 1.7 }}>
            قاب افقی و عریض (نسبت ۱۶:۹) — مثلاً ۸۰۰×۴۵۰ پیکسل. عکس کامل و بدون برش نمایش داده می‌شود.
          </p>
          <AnnouncementImageUploader
            value={form.imageUrl} aspectRatio="16/9" width={160} uploading={uploadingImage === "imageUrl"}
            onUpload={handleImageChange("imageUrl")} onRemove={handleRemoveImage("imageUrl")}
          />

          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4, marginTop: 16 }}>عکس پس‌زمینه‌ی صفحه‌ی ورود (اختیاری)</label>
          <p style={{ fontSize: 10.5, color: THEME.text3, margin: "0 0 8px", lineHeight: 1.7 }}>
            قاب عمودی و بلند (نسبت تقریبی ۳:۴ یا بلندتر) — مثلاً ۹۰۰×۱۲۰۰ پیکسل. این تصویر کاملاً جدا از عکس بالاست، چون قاب صفحه‌ی ورود عمودی است، نه افقی. اگر خالی بماند، از همان عکس کارت صفحه‌ی اصلی استفاده می‌شود.
          </p>
          <AnnouncementImageUploader
            value={form.loginImageUrl} aspectRatio="3/4" width={110} uploading={uploadingImage === "loginImageUrl"}
            onUpload={handleImageChange("loginImageUrl")} onRemove={handleRemoveImage("loginImageUrl")}
          />

          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4, marginTop: 14 }}>محل نمایش</label>
          <select style={inputStyle} value={form.displayLocation} onChange={(e) => setForm({ ...form, displayLocation: e.target.value })} dir="rtl">
            <option value="both">هر دو (صفحه‌ی ورود و صفحه‌ی اصلی)</option>
            <option value="login">فقط صفحه‌ی ورود</option>
            <option value="home">فقط صفحه‌ی اصلی پس از ورود</option>
          </select>

>>>>>>> 62c9c73 (Upload project files)
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: THEME.text2, marginTop: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال
          </label>
          {message && <p style={{ fontSize: 11.5, color: THEME.danger, marginTop: 8 }}>{message}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" style={btnStyle()} onClick={handleSave} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره"}</button>
            <button type="button" style={{ ...btnStyle(THEME.text3) }} onClick={() => setShowForm(false)}>انصراف</button>
          </div>
        </div>
      )}

      {list === null && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 20 }}>در حال بارگذاری...</p>}
      {list !== null && list.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 20 }}>هنوز اطلاعیه‌ای ثبت نشده است.</p>}
      {list && list.map((a) => {
        const Icon = ANNOUNCEMENT_ICONS[a.iconKey] || Megaphone;
        return (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "12px 8px", borderBottom: `1px solid ${THEME.border}`, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 220 }}>
<<<<<<< HEAD
              <Icon size={16} color={THEME.teal} style={{ flexShrink: 0, marginTop: 2 }} />
=======
              {a.imageUrl ? (
                <img src={a.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <Icon size={16} color={THEME.teal} style={{ flexShrink: 0, marginTop: 2 }} />
              )}
>>>>>>> 62c9c73 (Upload project files)
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: THEME.navy }}>{a.title || "(بدون عنوان)"}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: a.isActive ? "#dcfce7" : "#eef1f5", color: a.isActive ? "#166534" : THEME.text3, fontWeight: 600 }}>{a.isActive ? "فعال" : "غیرفعال"}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#eef1f5", color: THEME.text3, fontWeight: 600 }}>اولویت {a.priority}</span>
<<<<<<< HEAD
=======
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#eef1f5", color: THEME.text3, fontWeight: 600 }}>{a.displaySeconds || 10} ثانیه</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontWeight: 600 }}>
                    {{ login: "فقط صفحه‌ی ورود", home: "فقط صفحه‌ی اصلی", both: "هر دو صفحه" }[a.displayLocation || "both"]}
                  </span>
>>>>>>> 62c9c73 (Upload project files)
                  <span style={{ fontSize: 10, color: THEME.text3 }}>{a.companyId ? companies.find((c) => c.id === a.companyId)?.name || "شرکت خاص" : "همه‌ی شرکت‌ها"}</span>
                </div>
                <p style={{ fontSize: 12, color: THEME.text2, margin: "4px 0" }}>{a.message}</p>
                {(a.startsAt || a.endsAt) && (
                  <p style={{ fontSize: 10.5, color: THEME.text3, margin: 0 }}>
                    بازه: {a.startsAt ? toJalaliSafe(a.startsAt) : "از الان"} تا {a.endsAt ? toJalaliSafe(a.endsAt) : "نامحدود"}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button type="button" style={{ ...btnStyle(THEME.navyMid), fontSize: 11 }} onClick={() => openEdit(a)}>ویرایش</button>
              <button type="button" style={{ ...btnStyle(a.isActive ? "#92400e" : "#166534"), fontSize: 11 }} onClick={() => handleToggleActive(a)}>{a.isActive ? "غیرفعال کن" : "فعال کن"}</button>
              <button type="button" style={{ ...btnStyle(THEME.danger), fontSize: 11 }} onClick={() => handleDelete(a)}>حذف</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditLogPage({ companies }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { loadAuditLog(100).then(setRows); }, []);

  const ACTION_LABELS = {
    create_account: "ایجاد حساب", update_account: "ویرایش حساب", deactivate_account: "غیرفعال‌سازی حساب",
    reactivate_account: "فعال‌سازی حساب", reset_password: "بازنشانی رمز عبور", change_own_password: "تغییر رمز شخصی",
  };
  const TARGET_LABELS = { admin: "Admin", employer: "Employer", contractor: "Contractor", super_admin: "Super Admin" };

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
      <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
        <FileClock size={14} color={THEME.teal} /> گزارش تغییرات
      </h3>
      <p style={{ fontSize: 11, color: THEME.text3, marginBottom: 12 }}>
        هر تغییر حساب کاربری (ایجاد، ویرایش، فعال/غیرفعال، بازنشانی رمز) اینجا ثبت می‌شود — هرگز خودِ رمز عبور ثبت نمی‌شود.
      </p>
      {rows === null && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 20 }}>در حال بارگذاری...</p>}
      {rows !== null && rows.length === 0 && <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 20 }}>هنوز رویدادی ثبت نشده است.</p>}
      {rows && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>عملیات</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>نوع حساب</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>نام‌کاربری هدف</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>انجام‌شده توسط</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>زمان</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ padding: "8px", fontWeight: 600 }}>{ACTION_LABELS[r.action] || r.action}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{TARGET_LABELS[r.target_type] || r.target_type}</td>
                  <td style={{ padding: "8px", textAlign: "center", direction: "ltr" }}>{r.target_username || "—"}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{r.performed_by} ({TARGET_LABELS[r.performed_by_role] || r.performed_by_role})</td>
                  <td style={{ padding: "8px", textAlign: "center", color: THEME.text3 }}>{toJalaliSafe(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SuperAdminChangePassword({ onClose }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!oldPassword || !newPassword) { setError("رمز فعلی و رمز جدید هر دو الزامی است"); return; }
    if (newPassword.length < 8) { setError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد"); return; }
    if (newPassword !== confirmPassword) { setError("تکرار رمز عبور جدید با آن یکسان نیست"); return; }
    setSaving(true);
    const result = await changeMyPassword(oldPassword, newPassword, "super_admin");
    setSaving(false);
    if (result?.error) { setError(result.message); return; }
    setDone(true);
    setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    setTimeout(() => { setDone(false); onClose(); }, 2000);
  };

  return (
    <div style={{ background: THEME.surface, borderBottom: `1px solid ${THEME.border}`, padding: 16 }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <h4 style={{ fontSize: 13, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>تغییر رمز عبور من</h4>
        {done ? (
          <p style={{ color: "#166534", fontSize: 12.5 }}>رمز عبور با موفقیت تغییر کرد.</p>
        ) : (
          <>
            <input type="password" style={{ ...inputStyle, marginBottom: 8 }} placeholder="رمز عبور فعلی" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} dir="ltr" />
            <input type="password" style={{ ...inputStyle, marginBottom: 8 }} placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="ltr" />
            <input type="password" style={{ ...inputStyle, marginBottom: 8 }} placeholder="تکرار رمز عبور جدید" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} dir="ltr" />
            {error && <p style={{ color: THEME.danger, fontSize: 12, marginBottom: 8 }}>{error}</p>}
            <button type="button" onClick={handleSubmit} disabled={saving} style={btnStyle()}>{saving ? "در حال ذخیره..." : "ثبت رمز جدید"}</button>
          </>
        )}
      </div>
    </div>
  );
}

<<<<<<< HEAD
function PlansManager({ plans, currentAdmin, onChanged }) {
=======
function PlansManager({ plans, companies, currentAdmin, onChanged }) {
>>>>>>> 62c9c73 (Upload project files)
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(emptyPlanForm());
  const [saving, setSaving] = useState(false);

  function emptyPlanForm() {
<<<<<<< HEAD
    return { name: "", priceMonthly: 0, priceYearly: 0, maxUsers: "", maxPersonnel: "", maxStorageMb: "", features: [] };
=======
    return { name: "", priceMonthly: 0, priceYearly: 0, trialDays: "", maxUsers: "", maxPersonnel: "", maxStorageMb: "", features: [] };
>>>>>>> 62c9c73 (Upload project files)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await createPlan({
      name: form.name.trim(), priceMonthly: Number(form.priceMonthly) || 0, priceYearly: Number(form.priceYearly) || 0,
<<<<<<< HEAD
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null, maxPersonnel: form.maxPersonnel ? Number(form.maxPersonnel) : null,
      maxStorageMb: form.maxStorageMb ? Number(form.maxStorageMb) : null, features: form.features,
    });
=======
      trialDays: form.trialDays ? Number(form.trialDays) : null,
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null, maxPersonnel: form.maxPersonnel ? Number(form.maxPersonnel) : null,
      maxStorageMb: form.maxStorageMb ? Number(form.maxStorageMb) : null, features: form.features,
    });
    await syncNotificationTypesWithPlans((await loadPlans()).map((p) => p.features));
>>>>>>> 62c9c73 (Upload project files)
    setSaving(false);
    setForm(emptyPlanForm());
    setShowCreate(false);
    onChanged();
  };

  const openEdit = (p) => {
    setExpandedId(expandedId === p.id ? null : p.id);
<<<<<<< HEAD
    setForm({ name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, maxUsers: p.maxUsers ?? "", maxPersonnel: p.maxPersonnel ?? "", maxStorageMb: p.maxStorageMb ?? "", features: p.features });
=======
    setForm({ name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, trialDays: p.trialDays ?? "", maxUsers: p.maxUsers ?? "", maxPersonnel: p.maxPersonnel ?? "", maxStorageMb: p.maxStorageMb ?? "", features: p.features });
>>>>>>> 62c9c73 (Upload project files)
  };

  const handleSaveEdit = async (id) => {
    setSaving(true);
    await updatePlan(id, {
      name: form.name.trim(), priceMonthly: Number(form.priceMonthly) || 0, priceYearly: Number(form.priceYearly) || 0,
<<<<<<< HEAD
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null, maxPersonnel: form.maxPersonnel ? Number(form.maxPersonnel) : null,
      maxStorageMb: form.maxStorageMb ? Number(form.maxStorageMb) : null, features: form.features,
    });
=======
      trialDays: form.trialDays ? Number(form.trialDays) : null,
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null, maxPersonnel: form.maxPersonnel ? Number(form.maxPersonnel) : null,
      maxStorageMb: form.maxStorageMb ? Number(form.maxStorageMb) : null, features: form.features,
    });
    await syncNotificationTypesWithPlans((await loadPlans()).map((p) => p.features));
>>>>>>> 62c9c73 (Upload project files)
    setSaving(false);
    setExpandedId(null);
    onChanged();
  };

  const toggleModule = (mod) => {
    setForm((prev) => {
      const subKeys = (mod.sub || []).map((s) => s.key);
      const isOn = prev.features.includes(mod.key);
      if (isOn) {
        // خاموش‌کردن ماژول: خودش و همه‌ی زیرماژول‌هایش حذف می‌شوند
        return { ...prev, features: prev.features.filter((f) => f !== mod.key && !subKeys.includes(f)) };
      }
      // روشن‌کردن ماژول: خودش و همه‌ی زیرماژول‌هایش اضافه می‌شوند
      return { ...prev, features: [...new Set([...prev.features, mod.key, ...subKeys])] };
    });
  };

  const toggleSub = (mod, subKey) => {
    setForm((prev) => {
      const has = prev.features.includes(subKey);
      let features = has ? prev.features.filter((f) => f !== subKey) : [...prev.features, subKey];
      return { ...prev, features };
    });
  };

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Layers size={14} color={THEME.teal} /> پلن‌های اشتراک
        </h3>
        <button type="button" onClick={() => { setShowCreate((v) => !v); setForm(emptyPlanForm()); }} style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={13} /> پلن جدید
        </button>
      </div>

      {showCreate && <PlanForm form={form} setForm={setForm} toggleModule={toggleModule} toggleSub={toggleSub} onSave={handleCreate} saving={saving} saveLabel="ثبت پلن" />}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>ترتیب</th>
              <th style={{ textAlign: "right", padding: "6px 8px" }}>نام پلن</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>قیمت ماهانه</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>قیمت سالانه</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>سقف کاربر</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>سقف پرسنل</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>سقف فضا (MB)</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>وضعیت</th>
              <th style={{ padding: "6px 8px" }} />
            </tr>
          </thead>
          <tbody>
            {plans.map((p, idx) => (
              <React.Fragment key={p.id}>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, opacity: p.isActive ? 1 : 0.5 }}>
                  <td style={{ padding: "8px", textAlign: "center", whiteSpace: "nowrap" }}>
                    <button type="button" onClick={() => movePlan(plans, p.id, "up").then(onChanged)} disabled={idx === 0} style={{ ...btnStyle(THEME.navyMid), fontSize: 10, padding: "3px 7px", opacity: idx === 0 ? 0.3 : 1, marginInlineEnd: 3 }} title="جابه‌جایی به بالا">▲</button>
                    <button type="button" onClick={() => movePlan(plans, p.id, "down").then(onChanged)} disabled={idx === plans.length - 1} style={{ ...btnStyle(THEME.navyMid), fontSize: 10, padding: "3px 7px", opacity: idx === plans.length - 1 ? 0.3 : 1 }} title="جابه‌جایی به پایین">▼</button>
                  </td>
                  <td style={{ padding: "8px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{p.priceMonthly.toLocaleString("fa-IR")}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{p.priceYearly.toLocaleString("fa-IR")}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{p.maxUsers ?? "نامحدود"}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{p.maxPersonnel ?? "نامحدود"}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{p.maxStorageMb ?? "نامحدود"}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: p.isActive ? "#dcfce7" : "#eef1f5", color: p.isActive ? "#166534" : "#5b6b7d", fontWeight: 600 }}>
                      {p.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "left", whiteSpace: "nowrap" }}>
                    <button type="button" onClick={() => openEdit(p)} style={{ ...btnStyle(THEME.navyMid), fontSize: 11, marginInlineEnd: 6 }}>
                      {expandedId === p.id ? "بستن" : "ویرایش"}
                    </button>
                    {p.isActive && (
                      <button type="button" onClick={() => { if (confirm(`پلن «${p.name}» غیرفعال شود؟ شرکت‌های فعلاً روی این پلن، تغییری نمی‌کنند؛ فقط دیگر برای تخصیص جدید قابل‌انتخاب نیست.`)) { deactivatePlan(p.id).then(onChanged); } }} style={{ ...btnStyle("#92400e"), fontSize: 11, marginInlineEnd: 6 }}>
                        غیرفعال کردن
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`پلن «${p.name}» کاملاً حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
                        const result = await deletePlan(p.id);
                        if (result?.__error) { alert(result.message); return; }
                        onChanged();
                      }}
                      style={{ ...btnStyle(THEME.danger), fontSize: 11 }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
<<<<<<< HEAD
=======
                <tr>
                  <td colSpan={9} style={{ padding: "0 8px 8px" }}>
                    <PlanCompanyUsage plan={p} companies={companies} />
                  </td>
                </tr>
>>>>>>> 62c9c73 (Upload project files)
                {expandedId === p.id && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0 }}>
                      <PlanForm form={form} setForm={setForm} toggleModule={toggleModule} toggleSub={toggleSub} onSave={() => handleSaveEdit(p.id)} saving={saving} saveLabel="ذخیره‌ی تغییرات" />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {plans.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>هنوز پلنی ثبت نشده است</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

<<<<<<< HEAD
=======
function PlanCompanyUsage({ plan, companies }) {
  const usingCompanies = (companies || []).filter((c) => c.planId === plan.id);
  if (usingCompanies.length === 0) {
    return <p style={{ fontSize: 11, color: THEME.text3, margin: 0 }}>هیچ شرکتی فعلاً این پلن را ندارد.</p>;
  }
  return (
    <div style={{ background: THEME.bg, borderRadius: 8, padding: "8px 10px" }}>
      <p style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, margin: "0 0 6px" }}>
        شرکت‌های دارای این پلن ({usingCompanies.length.toLocaleString("fa-IR")}) — بازه‌ی دقیق فعال‌بودن:
      </p>
      {usingCompanies.map((c) => {
        const isTrial = c.subscriptionType === "trial";
        const now = new Date();
        const relevantEnd = isTrial ? c.trialEnd : c.subscriptionEndDate;
        const isExpired = relevantEnd ? new Date(relevantEnd).getTime() <= now.getTime() : false;
        return (
          <div key={c.id} style={{ fontSize: 11, color: THEME.text2, padding: "4px 0", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: THEME.navy }}>{c.name}</span>
            <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 999, background: isTrial ? "#ede9fe" : "#dbeafe", color: isTrial ? "#5b21b6" : "#1d4ed8", fontWeight: 600 }}>
              {isTrial ? "Trial" : "اشتراک پولی"}
            </span>
            {isTrial && c.trialStart && c.trialEnd ? (
              <span>از <b>{toJalaliDateTime(c.trialStart)}</b> تا <b>{toJalaliDateTime(c.trialEnd)}</b></span>
            ) : relevantEnd ? (
              <span>تا <b>{toJalaliDateTime(relevantEnd)}</b></span>
            ) : (
              <span style={{ color: THEME.text3 }}>تاریخ پایان ثبت نشده</span>
            )}
            {relevantEnd && (
              <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 999, background: isExpired ? "#fee2e2" : "#dcfce7", color: isExpired ? "#991b1b" : "#166534", fontWeight: 600 }}>
                {isExpired ? "منقضی‌شده" : "فعال"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

>>>>>>> 62c9c73 (Upload project files)
function PlanForm({ form, setForm, toggleModule, toggleSub, onSave, saving, saveLabel }) {
  return (
    <div style={{ background: THEME.bg, padding: 14, borderRadius: 8, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>نام پلن</label>
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="rtl" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>قیمت ماهانه (تومان)</label>
          <input type="number" style={inputStyle} value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} dir="ltr" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>قیمت سالانه (تومان)</label>
          <input type="number" style={inputStyle} value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} dir="ltr" />
        </div>
        <div>
<<<<<<< HEAD
=======
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>مدت دوره‌ی آزمایشی — روز (خالی = این پلن Trial ندارد)</label>
          <input type="number" style={inputStyle} value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} dir="ltr" placeholder="مثلاً ۷" />
        </div>
        <div>
>>>>>>> 62c9c73 (Upload project files)
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>سقف کاربر (خالی = نامحدود)</label>
          <input type="number" style={inputStyle} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} dir="ltr" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>سقف پرسنل (خالی = نامحدود)</label>
          <input type="number" style={inputStyle} value={form.maxPersonnel} onChange={(e) => setForm({ ...form, maxPersonnel: e.target.value })} dir="ltr" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>سقف فضا — مگابایت (خالی = نامحدود)</label>
          <input type="number" style={inputStyle} value={form.maxStorageMb} onChange={(e) => setForm({ ...form, maxStorageMb: e.target.value })} dir="ltr" />
        </div>
      </div>
      <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 6 }}>ماژول‌ها و زیرماژول‌های فعال این پلن</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, background: THEME.surface, borderRadius: 8, padding: 10 }}>
        {PLAN_FEATURES.map((mod) => (
          <div key={mod.key} style={{ borderBottom: `1px solid ${THEME.border}`, paddingBottom: 6, marginBottom: 2 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: THEME.navy, fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" checked={form.features.includes(mod.key)} onChange={() => toggleModule(mod)} />
              {mod.label}
            </label>
            {mod.sub && form.features.includes(mod.key) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, paddingInlineStart: 22 }}>
                {mod.sub.map((s) => (
                  <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: THEME.text2, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.features.includes(s.key)} onChange={() => toggleSub(mod, s.key)} />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={onSave} disabled={saving} style={btnStyle()}>{saving ? "در حال ذخیره..." : saveLabel}</button>
    </div>
  );
}

function UsageChip({ label, value }) {
  return (
    <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
      <span style={{ color: THEME.text3 }}>{label}: </span>
      <b style={{ color: THEME.navy }}>{value.toLocaleString("fa-IR")}</b>
    </div>
  );
}

function SystemInsights({ companies }) {
  const [recentLogins, setRecentLogins] = useState([]);
  const [recentFailedLogins, setRecentFailedLogins] = useState([]);
  const [inactiveCompanies, setInactiveCompanies] = useState([]);
  const [companyPayments, setCompanyPayments] = useState({});
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => {
    if (companies.length === 0) return;
    Promise.all([loadRecentLogins(15), loadRecentFailedLogins(15), computeInactiveCompanies(companies, 30)]).then(
      ([logins, failed, inactive]) => {
        setRecentLogins(logins);
        setRecentFailedLogins(failed);
        setInactiveCompanies(inactive);
        setLoading(false);
      }
    );
    // پرداخت‌های همه‌ی شرکت‌ها — برای محاسبه‌ی مانده‌حساب/معوق در «هشدار پرداخت»
    Promise.all(companies.map((c) => loadCompanyPayments(c.id).then((rows) => [c.id, rows]))).then((pairs) => {
      const map = {};
      pairs.forEach(([id, rows]) => { map[id] = rows; });
      setCompanyPayments(map);
      setPaymentsLoading(false);
    });
  }, [companies]);

  const companyName = (id) => companies.find((c) => c.id === id)?.name || "—";

  const subscriptionAlerts = companies
    .map((c) => ({ company: c, tier: computeSubscriptionAlertTier(c.subscriptionEndDate) }))
    .filter((x) => x.tier);

  const paymentAlerts = companies
    .map((c) => {
      const payments = companyPayments[c.id] || [];
      const status = computePaymentStatus(c.finalAmount, payments);
      const overdue = isPaymentOverdue(c, status);
      return { company: c, status, overdue };
    })
    .filter((x) => x.status.remaining > 0);

  // طبق خواسته‌ی صریح: چون مبلغ ماهانه باید مستمر پرداخت شود، اگر برای
  // ماه جاری هنوز پرداخت ماهانه ثبت نشده، همین‌جا آلارم داده شود.
  const monthlyPaymentAlerts = companies
    .map((c) => ({ company: c, alarm: computeMonthlyPaymentAlarm(c, companyPayments[c.id] || []) }))
    .filter((x) => x.alarm && x.alarm.overdue);

  return (
    <>
      <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingDown size={14} color={THEME.teal} /> تحلیل هوشمند
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>هشدار پایان اشتراک</p>
            {subscriptionAlerts.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>موردی نیست.</p>}
            {subscriptionAlerts.map(({ company: c, tier }) => (
              <div key={c.id} style={{ fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${THEME.border}`, display: "flex", justifyContent: "space-between" }}>
                <span>{c.name} — انقضا: {toJalaliSafe(c.subscriptionEndDate)}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: tier.bg, color: tier.color, fontWeight: 600 }}>{tier.label}</span>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginBottom: 6 }}>شرکت‌های کم‌فعالیت (۳۰ روز اخیر بدون ورود)</p>
            {loading && <p style={{ fontSize: 11.5, color: THEME.text3 }}>در حال بررسی...</p>}
            {!loading && inactiveCompanies.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>موردی نیست.</p>}
            {!loading && inactiveCompanies.map((c) => (
              <div key={c.id} style={{ fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${THEME.border}` }}>{c.name}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <CreditCard size={14} color={THEME.teal} /> هشدار پرداخت
        </h3>
        {paymentsLoading && <p style={{ fontSize: 11.5, color: THEME.text3 }}>در حال بررسی...</p>}
        {!paymentsLoading && paymentAlerts.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>هیچ شرکتی مانده‌حساب ندارد.</p>}
        {!paymentsLoading && paymentAlerts.map(({ company: c, status, overdue }) => (
          <div key={c.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${THEME.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{c.name} — مانده: {status.remaining.toLocaleString("fa-IR")} تومان</span>
            <span style={{ display: "flex", gap: 6 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: status.bg, color: status.color, fontWeight: 600 }}>{status.label}</span>
              {overdue && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>معوق</span>}
            </span>
          </div>
        ))}
      </div>

      <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <CreditCard size={14} color={THEME.teal} /> آلارم پرداخت ماهانهٔ مستمر
        </h3>
        <p style={{ fontSize: 11, color: THEME.text3, marginBottom: 10, lineHeight: 1.8 }}>
          شرکت‌هایی که مبلغ مستمر ماهانه دارند ولی برای ماه جاری هنوز پرداختی ثبت نشده است.
        </p>
        {paymentsLoading && <p style={{ fontSize: 11.5, color: THEME.text3 }}>در حال بررسی...</p>}
        {!paymentsLoading && monthlyPaymentAlerts.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>همه‌ی شرکت‌ها برای این ماه به‌روز هستند.</p>}
        {!paymentsLoading && monthlyPaymentAlerts.map(({ company: c, alarm }) => (
          <div key={c.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${THEME.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{c.name}</span>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: alarm.bg, color: alarm.color, fontWeight: 600 }}>{alarm.label}</span>
          </div>
        ))}
      </div>

      <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={14} color={THEME.teal} /> مانیتورینگ سیستم
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: THEME.text2, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <LogIn size={12} /> ورودهای اخیر
            </p>
            {loading && <p style={{ fontSize: 11.5, color: THEME.text3 }}>در حال بارگذاری...</p>}
            {!loading && recentLogins.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>ثبتی نیست.</p>}
            {recentLogins.map((r) => (
              <div key={r.id} style={{ fontSize: 11.5, padding: "5px 0", borderBottom: `1px solid ${THEME.border}` }}>
                {r.full_name || r.username} — {companyName(r.company_id)} — {toJalaliSafe(r.created_at)}
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <ShieldX size={12} /> تلاش‌های ناموفق ورود
            </p>
            {loading && <p style={{ fontSize: 11.5, color: THEME.text3 }}>در حال بارگذاری...</p>}
            {!loading && recentFailedLogins.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>ثبتی نیست.</p>}
            {recentFailedLogins.map((r) => (
              <div key={r.id} style={{ fontSize: 11.5, padding: "5px 0", borderBottom: `1px solid ${THEME.border}` }}>
                {r.username} — {companyName(r.company_id)} — {toJalaliSafe(r.created_at)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex: "1 1 140px", padding: "12px 16px", borderInlineEnd: `1px solid ${THEME.border}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || THEME.navy }}>{value}</div>
      <div style={{ fontSize: 11, color: THEME.text3, marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}


function CompanyManagePanel({ company, companies, plans, currentAdmin, usageStats, onUpdate, onDelete, onSetActive, paymentsPromise, onAddPayment, onPlanChanged }) {
  const [status, setStatus] = useState(company.subscriptionStatus);
<<<<<<< HEAD
  const [type, setType] = useState(company.subscriptionType);
  const [endDate, setEndDate] = useState(company.subscriptionEndDate);
  const [quota, setQuota] = useState(company.storageQuotaMb);
  const [paymentsList, setPaymentsList] = useState([]);
=======
  const [quotaInput, setQuotaInput] = useState(company.storageQuotaMb);
  const [paymentsList, setPaymentsList] = useState([]);
  const [onlinePayments, setOnlinePayments] = useState([]);
>>>>>>> 62c9c73 (Upload project files)
  const [payAmount, setPayAmount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(company.planId || "");
  const [planNote, setPlanNote] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  const [assignType, setAssignType] = useState(company.subscriptionType || "monthly");
  const [assignDays, setAssignDays] = useState(company.subscriptionDays || "");
  const [discountInput, setDiscountInput] = useState(0);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copySourceId, setCopySourceId] = useState("");
  const [copyingBowties, setCopyingBowties] = useState(false);
  const [copyingKnowledge, setCopyingKnowledge] = useState(false);
  const [copyResult, setCopyResult] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [payType, setPayType] = useState("monthly");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [payNote, setPayNote] = useState("");

  const loadAccounts = () => loadCompanyUserAccounts(company.id).then(setAccounts);
  useEffect(() => { loadAccounts(); }, [company.id]);

  useEffect(() => {
    if (paymentsPromise) paymentsPromise.then(setPaymentsList);
  }, [paymentsPromise]);

<<<<<<< HEAD
=======
  useEffect(() => { loadOnlinePaymentsForCompany(company.id).then(setOnlinePayments); }, [company.id]);

>>>>>>> 62c9c73 (Upload project files)
  const currentPlan = plans.find((p) => p.id === company.planId);
  const selectedPlanForAssign = plans.find((p) => p.id === selectedPlanId);
  // پیش‌نمایش زنده‌ی مبلغ قرارداد — قبل از ذخیره، همین که پلن/نوع/روز عوض بشه
  const previewContractAmount = computeContractAmount(selectedPlanForAssign, assignType, assignDays);
  const previewMonthlyRecurring = computeMonthlyRecurringAmount(selectedPlanForAssign, assignType);
  const previewFinalAmount = Math.max(0, previewContractAmount - (Number(discountInput) || 0));

  // وضعیت پرداخت و هشدار پایان اشتراک — کاملاً محاسبه‌شده، مستقل از هم
  const paymentStatus = computePaymentStatus(company.finalAmount, paymentsList);
  const overdue = isPaymentOverdue(company, paymentStatus);
<<<<<<< HEAD
  const alertTier = computeSubscriptionAlertTier(company.subscriptionEndDate);
=======
  const liveAccess = computeSubscriptionAccess(company);
>>>>>>> 62c9c73 (Upload project files)
  const monthlyAlarm = computeMonthlyPaymentAlarm(company, paymentsList);

  const handleAssignPlan = async () => {
    if (!selectedPlanId) return;
    setPlanSaving(true);
    const result = await assignPlanToCompany(company.id, selectedPlanId, "assigned", currentAdmin?.fullName, planNote.trim(), assignType, assignDays, discountInput);
    setPlanSaving(false);
    if (result?.__error) { alert(result.message); return; }
    setPlanNote("");
    onPlanChanged();
  };

  const toggleHistory = async () => {
    if (!showHistory) setHistory(await loadCompanySubscriptionHistory(company.id));
    setShowHistory((v) => !v);
  };

  const handleCopyBowties = async () => {
    if (!copySourceId) return;
    setCopyingBowties(true);
    setCopyResult("");
    const result = await copyBowtiesToCompany(copySourceId, company.id);
    setCopyingBowties(false);
    if (result?.__error) { setCopyResult("خطا: " + result.message); return; }
    setCopyResult(`${result.count} مدل BowTie با موفقیت کپی شد.`);
  };

  const handleCopyKnowledge = async () => {
    if (!copySourceId) return;
    setCopyingKnowledge(true);
    setCopyResult("");
    const result = await copyRiskKnowledgeToCompany(copySourceId, company.id);
    setCopyingKnowledge(false);
    if (result?.__error) { setCopyResult("خطا: " + result.message); return; }
    setCopyResult(`${result.count} رکورد بانک دانش ریسک با موفقیت کپی شد.`);
  };

  return (
    <div style={{ background: THEME.bg, padding: 16, borderTop: `2px solid ${THEME.teal}` }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <UsageChip label="پرسنل" value={usageStats?.personnelByCompany?.[company.id] || 0} />
        <UsageChip label="آنومالی" value={usageStats?.anomalyByCompany?.[company.id] || 0} />
        <UsageChip label="فایل/پیوست" value={usageStats?.attachmentByCompany?.[company.id] || 0} />
      </div>
<<<<<<< HEAD
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>وضعیت اشتراک</label>
          <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)} dir="rtl">
            {SUBSCRIPTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>نوع پلن</label>
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)} dir="rtl">
            {SUBSCRIPTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>تاریخ پایان اشتراک</label>
          <JalaliDateInput value={endDate} onChange={setEndDate} allowEmpty />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>سقف فضا (مگابایت)</label>
          <input type="number" style={inputStyle} value={quota} onChange={(e) => setQuota(e.target.value)} dir="ltr" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" style={btnStyle()} onClick={() => onUpdate({ subscriptionStatus: status, subscriptionType: type, subscriptionEndDate: endDate, storageQuotaMb: Number(quota) })}>
          ذخیره‌ی تغییرات
        </button>
        {/* غیرفعال‌سازی: برای شرکتی که مثلاً پولشو نداده — کاملاً برگشت‌پذیر،
=======
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {/* غیرفعال‌سازی: برای شرکتی که مثلاً پولشو نداده — کاملاً برگشت‌پذیر,
>>>>>>> 62c9c73 (Upload project files)
            هیچ داده‌ای پاک نمی‌شود، فقط ورود مسدود می‌شود */}
        {status !== "disabled" ? (
          <button type="button" style={btnStyle("#92400e")} onClick={() => { onSetActive(false); setStatus("disabled"); }}>
            غیرفعال‌سازی شرکت
          </button>
        ) : (
          <button type="button" style={btnStyle("#166534")} onClick={() => { onSetActive(true); setStatus("active"); }}>
            فعال‌سازی مجدد شرکت
          </button>
        )}
        {/* حذف کامل: برای شرکتی که کلاً انصراف داده — برگشت‌ناپذیر، همه‌ی
            داده‌های وابسته (پرسنل، آنومالی، BowTie و...) هم پاک می‌شوند */}
        <button type="button" style={btnStyle(THEME.danger)} onClick={() => { setShowDeleteConfirm((v) => !v); setDeleteConfirmInput(""); }}>
          حذف کامل شرکت
        </button>
      </div>

      {showDeleteConfirm && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#991b1b", fontWeight: 600, marginBottom: 6 }}>
            این عمل برگشت‌ناپذیر است — همه‌ی پرسنل، آنومالی، مدل‌های BowTie، ماشین‌آلات، داربست، حساب‌ها و سوابق پرداخت این شرکت برای همیشه پاک می‌شوند.
          </p>
          <p style={{ fontSize: 11.5, color: "#7f1d1d", marginBottom: 8 }}>
            برای تأیید، نام دقیق شرکت را تایپ کنید: <b>{company.name}</b>
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...inputStyle, width: 220 }} value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} dir="rtl" />
            <button
              type="button" style={{ ...btnStyle(THEME.danger), opacity: deleteConfirmInput === company.name ? 1 : 0.5 }}
              disabled={deleteConfirmInput !== company.name || deleting}
              onClick={async () => { setDeleting(true); await onDelete(deleteConfirmInput); setDeleting(false); setShowDeleteConfirm(false); }}
            >
              {deleting ? "در حال حذف..." : "حذف قطعی"}
            </button>
          </div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 12, marginBottom: 16 }}>
        <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
<<<<<<< HEAD
          <Layers size={13} /> پلن و قرارداد اشتراک این شرکت
        </h4>
        <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 8 }}>
          پلن فعلی: <b style={{ color: THEME.navy }}>{currentPlan ? currentPlan.name : "بدون پلن تخصیص‌یافته"}</b>
          {alertTier && (
            <span style={{ marginInlineStart: 8, fontSize: 10.5, padding: "2px 9px", borderRadius: 999, background: alertTier.bg, color: alertTier.color, fontWeight: 600 }}>
              اشتراک: {alertTier.label}
            </span>
          )}
        </p>
=======
          <Layers size={13} /> پلن و اشتراک شرکت
        </h4>
        <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 8 }}>
          پلن فعلی: <b style={{ color: THEME.navy }}>{currentPlan ? currentPlan.name : "بدون پلن تخصیص‌یافته"}</b>
          <span style={{
            marginInlineStart: 8, fontSize: 10.5, padding: "2px 9px", borderRadius: 999, fontWeight: 600,
            background: liveAccess.isLocked ? "#fee2e2" : "#dcfce7", color: liveAccess.isLocked ? "#991b1b" : "#166534",
          }}>
            وضعیت: {liveAccess.label}
          </span>
        </p>
        {(liveAccess.trialStart || liveAccess.subscriptionStartDate) && (
          <p style={{ fontSize: 12, color: THEME.navy, fontWeight: 600, marginBottom: 8, background: THEME.bg, borderRadius: 8, padding: "8px 12px" }}>
            {liveAccess.trialStart ? (
              <>شروع دوره‌ی آزمایشی: <b>{toJalaliDateTime(liveAccess.trialStart)}</b> — پایان: <b>{liveAccess.trialEnd ? toJalaliDateTime(liveAccess.trialEnd) : "—"}</b></>
            ) : (
              <>شروع اشتراک: <b>{liveAccess.subscriptionStartDate ? toJalaliDateTime(liveAccess.subscriptionStartDate) : "ثبت‌نشده"}</b> — پایان: <b>{liveAccess.subscriptionEndDate ? toJalaliDateTime(liveAccess.subscriptionEndDate) : "—"}</b></>
            )}
          </p>
        )}
>>>>>>> 62c9c73 (Upload project files)
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
          <select style={inputStyle} value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} dir="rtl">
            <option value="">— انتخاب پلن —</option>
            {plans.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select style={inputStyle} value={assignType} onChange={(e) => setAssignType(e.target.value)} dir="rtl">
            {SUBSCRIPTION_TYPES.filter((t) => {
              if (!selectedPlanForAssign) return true; // پلنی هنوز انتخاب نشده — همه‌ی گزینه‌ها را نشان بده
              if (t.value === "monthly") return selectedPlanForAssign.priceMonthly > 0;
              if (t.value === "yearly") return selectedPlanForAssign.priceYearly > 0;
              if (t.value === "monthly_and_yearly") return selectedPlanForAssign.priceMonthly > 0 && selectedPlanForAssign.priceYearly > 0;
              return true; // روزانه/آزمایشی/دائمی همیشه در دسترس‌اند
            }).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {assignType === "daily" && (
            <input type="number" style={inputStyle} placeholder="تعداد روز" value={assignDays} onChange={(e) => setAssignDays(e.target.value)} dir="ltr" />
          )}
          <input type="number" style={inputStyle} placeholder="تخفیف (تومان، اختیاری)" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} dir="ltr" />
          <input style={inputStyle} placeholder="یادداشت (اختیاری)" value={planNote} onChange={(e) => setPlanNote(e.target.value)} dir="rtl" />
        </div>

        {selectedPlanForAssign && (
          <div style={{ background: THEME.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 11.5, color: THEME.text2, lineHeight: 1.9 }}>
            <div>قیمت ماهانه‌ی این پلن: <b>{(selectedPlanForAssign.priceMonthly || 0).toLocaleString("fa-IR")}</b> تومان — قیمت سالانه: <b>{(selectedPlanForAssign.priceYearly || 0).toLocaleString("fa-IR")}</b> تومان</div>
            {(assignType === "monthly" || assignType === "yearly" || assignType === "daily" || assignType === "monthly_and_yearly") && (
              <div>
                پیش‌نمایش بر اساس انتخاب فعلی:
                {previewContractAmount > 0 && <> مبلغ یک‌بارهٔ ابتدای قرارداد: <b>{previewContractAmount.toLocaleString("fa-IR")}</b> تومان</>}
                {previewContractAmount > 0 && Number(discountInput) > 0 && <> (با تخفیف: <b>{previewFinalAmount.toLocaleString("fa-IR")}</b> تومان)</>}
                {previewMonthlyRecurring > 0 && <><br />مبلغ مستمر هرماه (جدا از بالا): <b>{previewMonthlyRecurring.toLocaleString("fa-IR")}</b> تومان</>}
              </div>
            )}
          </div>
        )}

<<<<<<< HEAD
=======
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>سقف فضا (مگابایت)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" style={{ ...inputStyle, maxWidth: 160 }} value={quotaInput} onChange={(e) => setQuotaInput(e.target.value)} dir="ltr" />
            <button type="button" style={btnStyle(THEME.navyMid)} onClick={() => onUpdate({ storageQuotaMb: Number(quotaInput) })}>ذخیره‌ی سقف فضا</button>
          </div>
        </div>

>>>>>>> 62c9c73 (Upload project files)
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={btnStyle()} onClick={handleAssignPlan} disabled={planSaving || !selectedPlanId}>
            {planSaving ? "در حال ثبت..." : "ثبت پلن و قرارداد"}
          </button>
          <button type="button" onClick={toggleHistory} style={{ ...btnStyle(THEME.navyMid), display: "flex", alignItems: "center", gap: 6 }}>
            <History size={13} /> {showHistory ? "بستن تاریخچه" : "تاریخچه‌ی اشتراک"}
          </button>
        </div>

        {/* وضعیت مالی فعلی — ذخیره‌شده در دیتابیس، نه فقط پیش‌نمایش لحظه‌ای */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 12, background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12 }}>
          <MiniStat label="مبلغ یک‌بارهٔ قرارداد" value={`${company.contractAmount.toLocaleString("fa-IR")} ت`} />
          <MiniStat label="تخفیف" value={`${company.discountAmount.toLocaleString("fa-IR")} ت`} />
          <MiniStat label="مبلغ نهایی یک‌باره" value={`${company.finalAmount.toLocaleString("fa-IR")} ت`} />
          {company.monthlyRecurringAmount > 0 && <MiniStat label="مبلغ مستمر هرماه" value={`${company.monthlyRecurringAmount.toLocaleString("fa-IR")} ت`} color="#1d4ed8" />}
          <MiniStat label="مجموع پرداختی" value={`${paymentStatus.totalPaid.toLocaleString("fa-IR")} ت`} color="#166534" />
          <MiniStat label="مانده بدهی" value={`${paymentStatus.remaining.toLocaleString("fa-IR")} ت`} color={paymentStatus.remaining > 0 ? "#b91c1c" : "#166534"} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: paymentStatus.bg, color: paymentStatus.color, fontWeight: 600 }}>
            وضعیت پرداخت: {paymentStatus.label}
          </span>
          {overdue && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>
              معوق
            </span>
          )}
          {monthlyAlarm && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: monthlyAlarm.bg, color: monthlyAlarm.color, fontWeight: 600 }}>
              {monthlyAlarm.label}
            </span>
          )}
        </div>

        {showHistory && (
          <div style={{ marginTop: 10, background: THEME.surface, borderRadius: 8, padding: 10 }}>
            {history.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0 }}>هنوز تغییری در اشتراک این شرکت ثبت نشده است.</p>}
            {history.map((h) => (
              <div key={h.id} style={{ fontSize: 11, color: THEME.text2, padding: "5px 0", borderBottom: `1px solid ${THEME.border}` }}>
                {toJalaliSafe(h.changed_at)} — <b>{h.action}</b> {h.note && `— ${h.note}`} {h.changed_by && <span style={{ color: THEME.text3 }}>(توسط {h.changed_by})</span>}
                {h.final_amount != null && <span style={{ color: THEME.text3 }}> — مبلغ نهایی: {Number(h.final_amount).toLocaleString("fa-IR")} ت</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 12, marginBottom: 16 }}>
        <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <Copy size={13} /> کپی محتوای آماده به این شرکت
        </h4>
        <p style={{ fontSize: 11, color: THEME.text3, marginBottom: 8, lineHeight: 1.8 }}>
          یک شرکت دیگر را به‌عنوان مبدأ انتخاب کن — مدل‌های BowTie یا بانک دانش ریسک آن، به‌صورت یک نسخه‌ی کاملاً مستقل برای «{company.name}» کپی می‌شود.
          ویرایش نسخه‌ی جدید هیچ اثری روی نسخه‌ی مبدأ ندارد.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select style={{ ...inputStyle, minWidth: 180 }} value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)} dir="rtl">
            <option value="">— شرکت مبدأ را انتخاب کن —</option>
            {companies.filter((c) => c.id !== company.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={handleCopyBowties} disabled={!copySourceId || copyingBowties} style={btnStyle(THEME.navyMid)}>
            {copyingBowties ? "در حال کپی..." : "کپی مدل‌های BowTie"}
          </button>
          <button type="button" onClick={handleCopyKnowledge} disabled={!copySourceId || copyingKnowledge} style={btnStyle(THEME.navyMid)}>
            {copyingKnowledge ? "در حال کپی..." : "کپی بانک دانش ریسک"}
          </button>
        </div>
        {copyResult && <p style={{ fontSize: 11.5, color: copyResult.startsWith("خطا") ? THEME.danger : "#166534", marginTop: 8 }}>{copyResult}</p>}
      </div>

      {/* شاخص‌های Proactive HSE دیگر اینجا کنترل نمی‌شوند — طبق خواسته‌ی
          صریح، فقط از طریق «ماژول‌ها و زیرماژول‌های فعال» همان پلن تخصیص‌یافته
          کنترل می‌شوند (نگاه کنید به loadActiveIndicators در proactiveIndicatorsApi.js) */}

      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 12, marginBottom: 16 }}>
        <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <UserPlus size={13} /> حساب‌های کاربری این شرکت
        </h4>
        <p style={{ fontSize: 10.5, color: THEME.text3, marginBottom: 8 }}>
          ساخت حساب جدید فقط از منوی «حساب‌ها» انجام می‌شود — این‌جا صرفاً نمایش است.
        </p>
        {accounts.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>هنوز هیچ حساب کاربری برای این شرکت ساخته نشده — بدون حساب، هیچ‌کس نمی‌تواند وارد سایت اصلی شود.</p>}
        {accounts.map((a) => (
          <div key={`${a.type}-${a.id}`} style={{ fontSize: 11.5, color: THEME.text2, padding: "4px 0", borderBottom: `1px solid ${THEME.border}`, display: "flex", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.name}</span>
            <span style={{ direction: "ltr" }}>({a.username})</span>
            <span style={{ marginInlineStart: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 999, background: a.type === "contractor" ? "#e0e7ff" : "#dcfce7", color: a.type === "contractor" ? "#3730a3" : "#166534" }}>
<<<<<<< HEAD
              {a.type === "contractor" ? "پیمانکار" : a.role === "admin" ? "ادمین" : "کارفرما"}
=======
              {a.type === "contractor" ? "پیمانکار" : a.role === "admin" ? "ادمین" : a.role === "hse_supervisor" ? "سرپرست/مدیر HSE" : "کارفرما"}
>>>>>>> 62c9c73 (Upload project files)
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 12 }}>
        <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <CreditCard size={13} /> تاریخچه‌ی پرداخت
        </h4>
        {paymentsList.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>پرداختی ثبت نشده است.</p>}
        {paymentsList.map((p) => (
          <div key={p.id} style={{ fontSize: 11.5, color: THEME.text2, padding: "5px 0", borderBottom: `1px solid ${THEME.border}` }}>
            {toJalaliSafe(p.payment_date)} — <b>{p.amount?.toLocaleString("fa-IR")}</b> تومان
            {" "}({PAYMENT_TYPES.find((t) => t.value === p.payment_type)?.label || p.payment_type})
            {p.tracking_number && <span style={{ color: THEME.text3 }}> — پیگیری: {p.tracking_number}</span>}
            {p.note && <span style={{ color: THEME.text3 }}> — {p.note}</span>}
          </div>
        ))}
<<<<<<< HEAD
=======

        {onlinePayments.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px dashed ${THEME.border}` }}>
            <h5 style={{ fontSize: 11.5, color: THEME.navy, fontWeight: 700, margin: "0 0 6px" }}>پرداخت‌های آنلاین (زرین‌پال)</h5>
            {onlinePayments.map((p) => {
              const st = p.status === "paid" ? { label: "موفق", bg: "#dcfce7", color: "#166534" }
                : p.status === "failed" ? { label: "ناموفق", bg: "#fee2e2", color: "#991b1b" }
                : p.status === "cancelled" ? { label: "لغوشده", bg: "#eef1f5", color: THEME.text3 }
                : { label: "در انتظار", bg: "#fef3c7", color: "#92400e" };
              return (
                <div key={p.id} style={{ fontSize: 11.5, color: THEME.text2, padding: "5px 0", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>{toJalaliSafe(p.createdAt)}</span>
                  <b>{p.amount.toLocaleString("fa-IR")} تومان</b>
                  <span>({p.billingCycle === "monthly" ? "ماهانه" : "سالانه"})</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  {p.refId && <span style={{ color: THEME.text3 }}>— کد رهگیری: {p.refId}</span>}
                </div>
              );
            })}
          </div>
        )}
>>>>>>> 62c9c73 (Upload project files)
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 10 }}>
          <input type="number" style={inputStyle} placeholder="مبلغ (تومان)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} dir="ltr" />
          <select style={inputStyle} value={payType} onChange={(e) => setPayType(e.target.value)} dir="rtl">
            {PAYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input style={inputStyle} placeholder="شماره پیگیری (اختیاری)" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} dir="ltr" />
          <input style={inputStyle} placeholder="توضیحات (اختیاری)" value={payNote} onChange={(e) => setPayNote(e.target.value)} dir="rtl" />
        </div>
        <button
          type="button" style={{ ...btnStyle(), marginTop: 8 }}
          onClick={() => { onAddPayment(payAmount, payType, trackingNumber, payNote); setPayAmount(""); setTrackingNumber(""); setPayNote(""); }}
          disabled={!payAmount}
        >
          ثبت پرداخت
        </button>
      </div>
    </div>
  );
}
