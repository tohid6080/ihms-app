import React, { useState, useEffect, useRef } from "react";
import { Tag, Plus, Trash2, Printer } from "lucide-react";
import { styles, THEME } from "../shared.js";
import DataView, { StatusPill } from "../shared/DataView.jsx";
import { JalaliDateInput, toJalaliSafe, toJalaliDateTime } from "../personnel/jalaliDate.jsx";
import { exportHtmlReportNativeAware } from "../offline/nativeFile.js";
import SyncStatusBadge from "../offline/SyncStatusBadge.jsx";
import {
  SCAFFOLD_STATUSES, scaffoldStatusMeta, loadScaffoldTagsOfflineFirst, loadContractorsWithScaffoldCode,
  deleteScaffoldTagDB, approveInitialRequest, issueScaffoldTag, markNeedsCorrection,
  resubmitForInspection, requestScaffoldRemoval, confirmScaffoldRemoved,
} from "./scaffoldApi.js";
import ScaffoldRequestForm from "./ScaffoldRequestForm.jsx";

const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "tag", label: "شماره تگ" },
];

export default function ScaffoldDashboard({ onBack, currentUser, role, initialStatusFilter, initialContractorFilter, readOnly }) {
  const isContractor = role === "CONTRACTOR";
  const [list, setList] = useState([]);
  const [myContractorCode, setMyContractorCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "all");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const expandedPanelRef = useRef(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionDeadline, setCorrectionDeadline] = useState("");
  const [correctionDeadlineTime, setCorrectionDeadlineTime] = useState("18:00");
  const [removalDate, setRemovalDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const all = await loadScaffoldTagsOfflineFirst();
    setList(all);
    if (isContractor) {
      const contractors = await loadContractorsWithScaffoldCode();
      const myName = (currentUser?.name || "").trim().toLowerCase();
      const mine = contractors.find((c) => c.name.trim().toLowerCase() === myName);
      setMyContractorCode(mine?.scaffoldTagCode || "");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // پنل جزئیات (درخواست برچیدن / ثبت اصلاح) همیشه زیر کل لیست رندر می‌شود؛
  // اگر کاربر روی کارتی وسط یک لیست بلند کلیک کند، بدون این اسکرول خودکار،
  // پنل باز می‌شود ولی بیرون از دید کاربر می‌ماند و به‌نظر می‌رسد «هیچ
  // اتفاقی نیفتاده». این useEffect عمداً همین‌جا، کنار بقیه‌ی hookها و قبل
  // از هر return شرطی قرار دارد — قرار دادنش بعد از یک early return باعث
  // نقض قانون Hooks در ری‌اکت می‌شود (تعداد hookهای فراخوانی‌شده بین
  // رندرهای مختلف فرق می‌کند) که دقیقاً همان خطای #310 را ایجاد می‌کرد.
  useEffect(() => {
    if (expandedId && expandedPanelRef.current) {
      expandedPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [expandedId]);

  const myName = (currentUser?.name || "").trim().toLowerCase();
  const scoped = isContractor ? list.filter((t) => (t.contractorName || "").trim().toLowerCase() === myName) : list;
  const contractorScoped = !isContractor && initialContractorFilter && initialContractorFilter !== "all"
    ? scoped.filter((t) => t.contractorId === initialContractorFilter)
    : scoped;

  const filtered = contractorScoped.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${t.tagNumber} ${t.contractorName} ${t.location}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "tag") return (a.tagNumber || "").localeCompare(b.tagNumber || "");
    const at = a.createdAt || "", bt = b.createdAt || "";
    return sort === "oldest" ? at.localeCompare(bt) : bt.localeCompare(at);
  });

  // آمار همیشه از کل لیست (قبل از جستجو/فیلتر) محاسبه می‌شود — این خلاصه‌ی
  // کلی وضعیته، نه چیزی که با تایپ کردن توی جستجو باید عوض بشه.
  const computeStats = (rows) => ({
    issued: rows.filter((t) => !!t.issueDate).length,
    notRemoved: rows.filter((t) => !!t.issueDate && t.status !== "removed").length,
    notIssued: rows.filter((t) => !t.issueDate).length,
  });

  const myStats = isContractor ? computeStats(scoped) : null;

  const perContractorStats = !isContractor
    ? Object.entries(
        list.reduce((acc, t) => {
          const name = (t.contractorName || "").trim();
          if (!name) return acc;
          if (!acc[name]) acc[name] = [];
          acc[name].push(t);
          return acc;
        }, {})
      )
        .map(([name, rows]) => ({ name, ...computeStats(rows) }))
        .sort((a, b) => a.name.localeCompare(b.name, "fa"))
    : [];

  const handleDelete = async (id) => {
    if (readOnly) { alert("شما مجوز حذف را ندارید"); return; }
    if (!confirm("این درخواست تگ حذف شود؟")) return;
    await deleteScaffoldTagDB(id);
    await load();
  };

  const handleApproveInitial = async (t) => {
    setSaving(true);
    await approveInitialRequest(t.id, currentUser?.name || "");
    setSaving(false);
    await load();
  };

  const handleIssueTag = async (t) => {
    setSaving(true);
    await issueScaffoldTag(t.id, currentUser?.name || "");
    setSaving(false);
    await load();
  };

  const startCorrection = (t) => { setExpandedId(t.id); setCorrectionNote(""); setCorrectionDeadline(""); setCorrectionDeadlineTime("18:00"); };
  const submitCorrection = async (t) => {
    if (!correctionNote.trim() || !correctionDeadline) {
      alert("شرح ایراد و تاریخ مهلت الزامی است");
      return;
    }
    setSaving(true);
    const deadlineIso = `${correctionDeadline}T${correctionDeadlineTime}:00`;
    await markNeedsCorrection(t.id, correctionNote, deadlineIso, currentUser?.name || "");
    setSaving(false);
    setExpandedId(null);
    await load();
  };

  const handleResubmit = async (t) => {
    if (readOnly) { alert("شما مجوز این اقدام را ندارید"); return; }
    setSaving(true);
    await resubmitForInspection(t.id);
    setSaving(false);
    await load();
  };

  const startRemovalRequest = (t) => { setExpandedId(`removal-${t.id}`); setRemovalDate(""); };
  const submitRemovalRequest = async (t) => {
    if (readOnly) { alert("شما مجوز این اقدام را ندارید"); return; }
    if (!removalDate) { alert("تاریخ برچیدن الزامی است"); return; }
    setSaving(true);
    await requestScaffoldRemoval(t.id, removalDate);
    setSaving(false);
    setExpandedId(null);
    await load();
  };

  const handleConfirmRemoved = async (t) => {
    setSaving(true);
    await confirmScaffoldRemoved(t.id, currentUser?.name || "");
    setSaving(false);
    await load();
  };

  const handlePrintTag = async (t) => {
    const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>تگ داربست ${t.tagNumber}</title>
    <style>
      body { font-family: Tahoma, Arial, sans-serif; direction: rtl; padding: 30px; }
      .tag { border: 3px solid #166534; border-radius: 12px; padding: 24px; max-width: 420px; margin: 0 auto; text-align: center; }
      .num { font-size: 26px; font-weight: 700; color: #166534; direction: ltr; margin: 10px 0; }
      .row { font-size: 13px; color: #333; margin: 6px 0; text-align: right; }
    </style></head>
    <body>
      <div class="tag">
        <h2>تگ داربست</h2>
        <div class="num">${t.tagNumber}</div>
        <div class="row"><b>پیمانکار:</b> ${t.contractorName || "—"}</div>
        <div class="row"><b>محل برپایی:</b> ${t.location || "—"}</div>
        <div class="row"><b>تاریخ برپایی:</b> ${toJalaliSafe(t.erectionDate) || "—"}</div>
        <div class="row"><b>تاریخ صدور تگ:</b> ${toJalaliSafe(t.issueDate) || "—"}</div>
        <div class="row"><b>وضعیت:</b> ${scaffoldStatusMeta(t.status).label}</div>
      </div>
    </body></html>`;
    if (await exportHtmlReportNativeAware(html, `Tag-${t.tagNumber}`)) return;
    const win = window.open("", "_blank");
    if (!win) { alert("اجازه‌ی باز شدن پنجره‌ی جدید داده نشد؛ لطفاً popup blocker را غیرفعال کنید."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  if (showForm) {
    return (
      <ScaffoldRequestForm
        currentUser={currentUser}
        contractorCode={myContractorCode}
        onBack={() => { setShowForm(false); load(); }}
      />
    );
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  const rowActions = (t) => (
    <>
      {isContractor && !readOnly && t.status === "pending_initial_approval" && (
        <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => handleDelete(t.id)}><Trash2 size={12} /></button>
      )}
      {isContractor && !readOnly && t.status === "needs_correction" && (
        <button type="button" style={styles.smallButton} onClick={() => handleResubmit(t)} disabled={saving}>درخواست بازدید مجدد</button>
      )}
      {isContractor && !readOnly && t.status === "tag_issued" && (
        <button type="button" style={{ ...styles.smallButton, background: "#7c3aed" }} onClick={() => startRemovalRequest(t)}>درخواست پرمیت برچیدن</button>
      )}
      {(t.status === "tag_issued" || t.status === "removal_requested" || t.status === "removed") && (
        <button type="button" style={{ ...styles.smallButton, background: THEME.navyMid, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => handlePrintTag(t)}>
          <Printer size={12} /> چاپ
        </button>
      )}
      {!isContractor && !readOnly && t.status === "pending_initial_approval" && (
        <button type="button" style={{ ...styles.smallButton, background: "#166534" }} onClick={() => handleApproveInitial(t)} disabled={saving}>تأیید اولیه</button>
      )}
      {!isContractor && !readOnly && t.status === "pending_installation" && (
        <>
          <button type="button" style={{ ...styles.smallButton, background: "#166534" }} onClick={() => handleIssueTag(t)} disabled={saving}>ایمن است</button>
          <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => startCorrection(t)}>عدم انطباق</button>
        </>
      )}
      {!isContractor && !readOnly && t.status === "removal_requested" && (
        <button type="button" style={{ ...styles.smallButton, background: "#166534" }} onClick={() => handleConfirmRemoved(t)} disabled={saving}>تأیید برچیده‌شدن</button>
      )}
    </>
  );

  const expandedItem = sorted.find((t) => t.id === expandedId || `removal-${t.id}` === expandedId);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Tag size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>مدیریت داربست — لیست تگ داربست</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 14 }}>
        {isContractor ? "درخواست تگ جدید، پیگیری بازدید، و درخواست برچیدن داربست" : "بررسی و تأیید تگ‌های داربست تمام پیمانکاران"}
      </p>

      {isContractor && myStats && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <StatBox label="تگ صادر شده" value={myStats.issued} color="#166534" bg="#dcfce7" />
          <StatBox label="داربست برچیده‌نشده" value={myStats.notRemoved} color="#1d4ed8" bg="#dbeafe" />
          <StatBox label="تگ صادر نشده" value={myStats.notIssued} color="#b45309" bg="#fef3c7" />
        </div>
      )}

      {!isContractor && perContractorStats.length > 0 && (
        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>آمار داربست به‌ازای هر پیمانکار</h3>
          {perContractorStats.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${THEME.border}`, flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 100, fontSize: 12.5, fontWeight: 600, color: THEME.text }}>{c.name}</span>
              <span style={{ fontSize: 11, color: "#166534" }}>صادرشده: <b>{c.issued}</b></span>
              <span style={{ fontSize: 11, color: "#1d4ed8" }}>برچیده‌نشده: <b>{c.notRemoved}</b></span>
              <span style={{ fontSize: 11, color: "#b45309" }}>صادرنشده: <b>{c.notIssued}</b></span>
            </div>
          ))}
        </div>
      )}

      {isContractor && !readOnly && (
        myContractorCode ? (
          <button type="button" style={{ ...styles.button, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }} onClick={() => setShowForm(true)}>
            <Plus size={15} /> اخذ تگ داربست جدید
          </button>
        ) : (
          <p style={{ ...styles.error, marginBottom: 14 }}>کد دوحرفی شرکت شما هنوز توسط ادمین تعریف نشده — برای درخواست تگ جدید با ادمین سامانه هماهنگ کنید.</p>
        )
      )}

      <DataView
        items={sorted}
        getId={(t) => t.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="جستجو (شماره تگ، پیمانکار، محل)..."
        sortOptions={SORT_OPTIONS}
        sortValue={sort}
        onSortChange={setSort}
        filterSlot={
          <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} dir="rtl">
            <option value="all">همه وضعیت‌ها</option>
            {SCAFFOLD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        }
        emptyMessage="موردی یافت نشد"
        columns={[
          { key: "tag", label: "شماره تگ", render: (t) => <span style={{ direction: "ltr", display: "inline-block", fontWeight: 600 }}>{t.tagNumber}</span> },
          ...(!isContractor ? [{ key: "contractor", label: "پیمانکار", render: (t) => t.contractorName || "—" }] : []),
          { key: "location", label: "محل / تاریخ برپایی", render: (t) => <span style={{ fontSize: 11.5, color: THEME.text3 }}>{t.location} · {toJalaliSafe(t.erectionDate)}</span> },
          {
            key: "status", label: "وضعیت",
            render: (t) => {
              const sm = scaffoldStatusMeta(t.status);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <StatusPill label={sm.label} color={sm.color} bg={sm.bg} />
                  {t.syncStatus && t.syncStatus !== "synced" && <SyncStatusBadge status={t.syncStatus} onRetry={() => load()} />}
                </div>
              );
            },
          },
        ]}
        renderRowActions={rowActions}
        renderCard={(t) => {
          const sm = scaffoldStatusMeta(t.status);
          return (
            <div style={{ ...styles.card, width: "auto", margin: 0, borderInlineStart: `4px solid ${sm.color}`, height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, color: THEME.navy, fontSize: 14, direction: "ltr", textAlign: "right" }}>{t.tagNumber}</div>
                  <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 4 }}>
                    {!isContractor && <>{t.contractorName} · </>}{t.location} · {toJalaliSafe(t.erectionDate)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusPill label={sm.label} color={sm.color} bg={sm.bg} />
                  {t.syncStatus && t.syncStatus !== "synced" && <SyncStatusBadge status={t.syncStatus} onRetry={() => load()} />}
                </div>
              </div>

              {t.purpose && <p style={{ fontSize: 12, color: THEME.text2, marginTop: 8 }}>{t.purpose}</p>}

              {t.status === "needs_correction" && t.correctionNote && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: THEME.danger }}>
                  <p style={{ margin: "2px 0" }}><b>ایراد:</b> {t.correctionNote}</p>
                  {t.correctionDeadline && <p style={{ margin: "2px 0" }}><b>مهلت رفع:</b> {toJalaliDateTime(t.correctionDeadline)}</p>}
                </div>
              )}
              {t.issueDate && <p style={{ fontSize: 11.5, color: "#166534", marginTop: 6 }}>تاریخ صدور تگ: {toJalaliSafe(t.issueDate)}</p>}
              {t.removalDate && <p style={{ fontSize: 11.5, color: THEME.text3, marginTop: 4 }}>تاریخ برچیدن: {toJalaliSafe(t.removalDate)}</p>}

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>{rowActions(t)}</div>
            </div>
          );
        }}
      />

      {expandedItem && (
        <div ref={expandedPanelRef} style={{ ...styles.card, width: "auto", marginTop: 14 }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 10px", fontWeight: 700, direction: "ltr", textAlign: "right" }}>{expandedItem.tagNumber}</h3>

          {expandedId === expandedItem.id && !isContractor && (
            <div>
              <label style={styles.label}>شرح ایرادات / عدم انطباق</label>
              <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} dir="rtl" />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>تاریخ مهلت رفع</label>
                  <JalaliDateInput value={correctionDeadline} onChange={setCorrectionDeadline} />
                </div>
                <div style={{ width: 110 }}>
                  <label style={styles.label}>ساعت</label>
                  <input type="time" style={styles.input} value={correctionDeadlineTime} onChange={(e) => setCorrectionDeadlineTime(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => submitCorrection(expandedItem)} disabled={saving}>ثبت و ارسال به پیمانکار</button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setExpandedId(null)}>انصراف</button>
              </div>
            </div>
          )}

          {expandedId === `removal-${expandedItem.id}` && isContractor && (
            <div>
              <label style={styles.label}>تاریخ برچیدن داربست</label>
              <JalaliDateInput value={removalDate} onChange={setRemovalDate} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" style={{ ...styles.smallButton, background: "#7c3aed" }} onClick={() => submitRemovalRequest(expandedItem)} disabled={saving}>ثبت درخواست برچیدن</button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setExpandedId(null)}>انصراف</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "10px 16px", flex: 1, minWidth: 110, textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color, marginTop: 2 }}>{label}</div>
    </div>
  );
}
