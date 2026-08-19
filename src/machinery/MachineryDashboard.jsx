import React, { useState, useEffect } from "react";
import { Truck, Plus, Trash2, FileText, Paperclip } from "lucide-react";
import { styles, THEME } from "../shared.js";
import DataView, { StatusPill } from "../shared/DataView.jsx";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { isPdfDataUrl } from "../personnel/fileHelpers.js";
import DocumentViewerModal from "../personnel/DocumentViewerModal.jsx";
import SyncStatusBadge from "../offline/SyncStatusBadge.jsx";
import {
  MACHINE_TYPES, APPROVAL_STATUSES, MACHINERY_DOC_TYPES, approvalStatusMeta,
  loadMachineryListOfflineFirst, deleteMachineryDB, setMachineryApproval,
  loadMachineryDocuments, daysUntil, EXPIRY_WARNING_DAYS,
} from "./machineryApi.js";
import MachineryForm from "./MachineryForm.jsx";

const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "name", label: "نام ماشین (الفبا)" },
];

/**
 * Reference implementation of the shared List/Grid pattern (see
 * src/shared/DataView.jsx) — every other module's list should eventually
 * follow this same structure: DataView owns the toolbar/view-toggle/rows,
 * this file only supplies columns, the card, and the actions.
 */
export default function MachineryDashboard({ onBack, currentUser, role, initialApprovalFilter, initialContractorFilter, readOnly }) {
  const isContractor = role === "CONTRACTOR";
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [approvalFilter, setApprovalFilter] = useState(initialApprovalFilter || "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingDocs, setEditingDocs] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [reviewNoteDraft, setReviewNoteDraft] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [docsExpandedId, setDocsExpandedId] = useState(null);
  const [docsMap, setDocsMap] = useState({});
  const [docsLoading, setDocsLoading] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);

  const load = async () => {
    const all = await loadMachineryListOfflineFirst();
    setList(all);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const myName = (currentUser?.name || "").trim().toLowerCase();
  const scoped = isContractor ? list.filter((m) => (m.contractorName || "").trim().toLowerCase() === myName) : list;
  const contractorScoped = !isContractor && initialContractorFilter && initialContractorFilter !== "all"
    ? scoped.filter((m) => m.contractorId === initialContractorFilter)
    : scoped;

  const filtered = contractorScoped.filter((m) => {
    if (!isContractor && m.approvalStatus === "draft") return false;
    if (approvalFilter !== "all" && m.approvalStatus !== approvalFilter) return false;
    if (typeFilter !== "all" && m.machineType !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${m.machineName} ${m.plateNumber} ${m.contractorName} ${m.deviceCode}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return (a.machineName || "").localeCompare(b.machineName || "", "fa");
    const at = a.createdAt || "", bt = b.createdAt || "";
    return sort === "oldest" ? at.localeCompare(bt) : bt.localeCompare(at);
  });

  const startCreate = () => { setEditingItem(null); setEditingDocs([]); setShowForm(true); };
  const startEdit = async (m) => {
    setEditingItem(m);
    setEditingDocs(await loadMachineryDocuments(m.id));
    setShowForm(true);
  };
  const handleSaved = async () => { setShowForm(false); await load(); };

  const handleDelete = async (id) => {
    if (readOnly) { alert("شما مجوز حذف را ندارید"); return; }
    if (!confirm("این ماشین حذف شود؟")) return;
    const result = await deleteMachineryDB(id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };
  const handleBulkDelete = async (ids) => {
    if (readOnly) { alert("شما مجوز حذف را ندارید"); return; }
    if (!confirm(`${ids.length} مورد حذف شود؟`)) return;
    for (const id of ids) await deleteMachineryDB(id);
    await load();
  };

  const toggleDocs = async (m) => {
    if (docsExpandedId === m.id) { setDocsExpandedId(null); return; }
    setDocsExpandedId(m.id);
    setExpandedId(null);
    if (!docsMap[m.id]) {
      setDocsLoading(true);
      const docs = await loadMachineryDocuments(m.id);
      setDocsMap((prev) => ({ ...prev, [m.id]: docs }));
      setDocsLoading(false);
    }
  };

  const startReview = async (m) => {
    setExpandedId(m.id);
    setReviewNoteDraft(m.reviewNote || "");
    if (docsExpandedId !== m.id) await toggleDocs(m);
  };
  const submitReview = async (m, status) => {
    if (readOnly) { alert("شما مجوز تصمیم‌گیری را ندارید"); return; }
    if ((status === "rejected" || status === "needs_correction") && !reviewNoteDraft.trim()) {
      alert("برای رد یا نیاز به اصلاح، ثبت توضیحات الزامی است");
      return;
    }
    setSavingReview(true);
    await setMachineryApproval(m.id, status, reviewNoteDraft.trim());
    setSavingReview(false);
    setExpandedId(null);
    await load();
  };
  const handleBulkApprove = async (ids) => {
    if (readOnly) { alert("شما مجوز تصمیم‌گیری را ندارید"); return; }
    if (!confirm(`${ids.length} مورد تأیید شود؟`)) return;
    for (const id of ids) await setMachineryApproval(id, "approved", "");
    await load();
  };

  if (showForm) {
    return (
      <MachineryForm
        existingMachinery={editingItem}
        existingDocuments={editingDocs}
        currentUser={currentUser}
        onSaved={handleSaved}
        onBack={() => setShowForm(false)}
      />
    );
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  const expiryWarning = (m) => {
    const insuranceDays = daysUntil(m.insuranceExpiry);
    const inspectionDays = daysUntil(m.inspectionExpiry);
    const healthCertDays = daysUntil(m.healthCertExpiry);
    const driverLicenseDays = daysUntil(m.driverLicenseExpiry);
    const backupDriverLicenseDays = daysUntil(m.backupDriverLicenseExpiry);
    const insuranceWarn = insuranceDays !== null && insuranceDays <= EXPIRY_WARNING_DAYS;
    const inspectionWarn = inspectionDays !== null && inspectionDays <= EXPIRY_WARNING_DAYS;
    const healthCertWarn = healthCertDays !== null && healthCertDays <= EXPIRY_WARNING_DAYS;
    const driverLicenseWarn = driverLicenseDays !== null && driverLicenseDays <= EXPIRY_WARNING_DAYS;
    const backupDriverLicenseWarn = backupDriverLicenseDays !== null && backupDriverLicenseDays <= EXPIRY_WARNING_DAYS;
    return {
      insuranceDays, inspectionDays, healthCertDays, driverLicenseDays, backupDriverLicenseDays,
      insuranceWarn, inspectionWarn, healthCertWarn, driverLicenseWarn, backupDriverLicenseWarn,
      anyWarn: insuranceWarn || inspectionWarn || healthCertWarn || driverLicenseWarn || backupDriverLicenseWarn,
    };
  };

  const rowActions = (m) => {
    const docs = docsMap[m.id] || [];
    return (
      <>
        <button type="button" style={{ ...styles.smallButton, background: THEME.navyMid, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => toggleDocs(m)}>
          <Paperclip size={12} /> مدارک{docsMap[m.id] ? ` (${docs.length})` : ""}
        </button>
        {isContractor && !readOnly && (
          <>
            <button type="button" style={styles.smallButton} onClick={() => startEdit(m)}>ویرایش</button>
            <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => handleDelete(m.id)}><Trash2 size={12} /></button>
          </>
        )}
        {!isContractor && !readOnly && m.approvalStatus === "pending" && (
          <button type="button" style={styles.smallButton} onClick={() => startReview(m)}>بررسی</button>
        )}
        {!isContractor && !readOnly && m.approvalStatus !== "pending" && (
          <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => startReview(m)}>تغییر تصمیم</button>
        )}
      </>
    );
  };

  const expandedItem = sorted.find((m) => m.id === expandedId || m.id === docsExpandedId);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Truck size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>مدیریت ماشین‌آلات و تجهیزات</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 14 }}>
        {isContractor ? "ثبت و پیگیری ماشین‌آلات و تجهیزات شرکت شما" : "مشاهده و تأیید ماشین‌آلات ثبت‌شده توسط تمام پیمانکاران"}
      </p>

      {isContractor && !readOnly && (
        <button type="button" style={{ ...styles.button, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }} onClick={startCreate}>
          <Plus size={15} /> ثبت ماشین‌آلات جدید
        </button>
      )}

      <DataView
        items={sorted}
        getId={(m) => m.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="جستجو (نام، پلاک، پیمانکار)..."
        sortOptions={SORT_OPTIONS}
        sortValue={sort}
        onSortChange={setSort}
        filterSlot={
          <>
            <select style={styles.filterSelect} value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)} dir="rtl">
              <option value="all">همه وضعیت‌ها</option>
              {APPROVAL_STATUSES.filter((s) => isContractor || s.value !== "draft").map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select style={styles.filterSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} dir="rtl">
              <option value="all">همه انواع</option>
              {MACHINE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </>
        }
        bulkActions={
          !isContractor && !readOnly
            ? [{ label: "تأیید گروهی", onClick: handleBulkApprove }]
            : isContractor && !readOnly
              ? [{ label: "حذف گروهی", danger: true, onClick: handleBulkDelete }]
              : null
        }
        emptyMessage="ماشین‌آلاتی یافت نشد"
        columns={[
          {
            key: "name", label: "نام ماشین / پلاک",
            render: (m) => (
              <div>
                <div style={{ fontWeight: 600 }}>{m.machineName}</div>
                <div style={{ fontSize: 11, color: THEME.text3 }}>{m.plateNumber}</div>
              </div>
            ),
          },
          ...(!isContractor ? [{ key: "contractor", label: "پیمانکار", render: (m) => m.contractorName || "—" }] : []),
          { key: "type", label: "نوع", render: (m) => MACHINE_TYPES.find((t) => t.value === m.machineType)?.label || "—" },
          {
            key: "expiry", label: "انقضا",
            render: (m) => {
              const { anyWarn } = expiryWarning(m);
              if (!anyWarn) return <span style={{ color: THEME.text3 }}>—</span>;
              return <span style={{ color: "#b45309", fontSize: 11 }}>⚠ مدارک نزدیک/منقضی</span>;
            },
          },
          {
            key: "status", label: "وضعیت",
            render: (m) => {
              const sm = approvalStatusMeta(m.approvalStatus);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <StatusPill label={sm.label} color={sm.color} bg={sm.bg} />
                  {m.syncStatus && m.syncStatus !== "synced" && <SyncStatusBadge status={m.syncStatus} onRetry={() => load()} />}
                </div>
              );
            },
          },
        ]}
        renderRowActions={rowActions}
        renderCard={(m) => {
          const sm = approvalStatusMeta(m.approvalStatus);
          const {
            insuranceDays, inspectionDays, healthCertDays, driverLicenseDays, backupDriverLicenseDays,
            insuranceWarn, inspectionWarn, healthCertWarn, driverLicenseWarn, backupDriverLicenseWarn, anyWarn,
          } = expiryWarning(m);
          return (
            <div style={{ ...styles.card, width: "auto", margin: 0, borderInlineStart: `4px solid ${sm.color}`, height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, color: THEME.navy, fontSize: 14 }}>{m.machineName} — {m.plateNumber}</div>
                  <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 4 }}>
                    {!isContractor && <>{m.contractorName} · </>}
                    {MACHINE_TYPES.find((t) => t.value === m.machineType)?.label} {m.project && `· ${m.project}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusPill label={sm.label} color={sm.color} bg={sm.bg} />
                  {m.syncStatus && m.syncStatus !== "synced" && <SyncStatusBadge status={m.syncStatus} onRetry={() => load()} />}
                </div>
              </div>

              {anyWarn && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#b45309" }}>
                  {insuranceWarn && <div>⚠ بیمه‌نامه {insuranceDays < 0 ? "منقضی شده" : `تا ${insuranceDays} روز دیگر منقضی می‌شود`} ({toJalaliSafe(m.insuranceExpiry)})</div>}
                  {inspectionWarn && <div>⚠ معاینه فنی {inspectionDays < 0 ? "منقضی شده" : `تا ${inspectionDays} روز دیگر منقضی می‌شود`} ({toJalaliSafe(m.inspectionExpiry)})</div>}
                  {healthCertWarn && <div>⚠ سرتیفیکیت سلامت {healthCertDays < 0 ? "منقضی شده" : `تا ${healthCertDays} روز دیگر منقضی می‌شود`} ({toJalaliSafe(m.healthCertExpiry)})</div>}
                  {driverLicenseWarn && <div>⚠ گواهینامه راننده {driverLicenseDays < 0 ? "منقضی شده" : `تا ${driverLicenseDays} روز دیگر منقضی می‌شود`} ({toJalaliSafe(m.driverLicenseExpiry)})</div>}
                  {backupDriverLicenseWarn && <div>⚠ گواهینامه جانشین راننده {backupDriverLicenseDays < 0 ? "منقضی شده" : `تا ${backupDriverLicenseDays} روز دیگر منقضی می‌شود`} ({toJalaliSafe(m.backupDriverLicenseExpiry)})</div>}
                </div>
              )}

              {m.reviewNote && (m.approvalStatus === "rejected" || m.approvalStatus === "needs_correction") && (
                <p style={{ fontSize: 11.5, color: THEME.danger, marginTop: 8 }}><b>یادداشت کارفرما:</b> {m.reviewNote}</p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>{rowActions(m)}</div>
            </div>
          );
        }}
      />

      {expandedItem && (docsExpandedId === expandedItem.id || expandedId === expandedItem.id) && (
        <div style={{ ...styles.card, width: "auto", marginTop: 14 }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 8px", fontWeight: 700 }}>
            {expandedItem.machineName} — {expandedItem.plateNumber}
          </h3>

          {docsExpandedId === expandedItem.id && (
            <div style={{ marginBottom: expandedId === expandedItem.id ? 14 : 0 }}>
              {docsLoading && !docsMap[expandedItem.id] ? (
                <p style={{ fontSize: 11.5, color: THEME.text3 }}>در حال بارگذاری مدارک...</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {MACHINERY_DOC_TYPES.map((dt) => {
                    const doc = (docsMap[expandedItem.id] || []).find((d) => d.docType === dt.value);
                    return (
                      <div key={dt.value} style={{ width: 88, textAlign: "center" }}>
                        {doc ? (
                          isPdfDataUrl(doc.fileData) ? (
                            <button type="button" onClick={() => setViewerSrc(doc.fileData)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                              <FileText size={40} color={THEME.text2} />
                            </button>
                          ) : (
                            <img
                              src={doc.fileData}
                              alt=""
                              onClick={() => setViewerSrc(doc.fileData)}
                              style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: `1px solid ${THEME.border}` }}
                            />
                          )
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 8, border: `1px dashed ${THEME.border}`, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Paperclip size={16} color={THEME.text3} />
                          </div>
                        )}
                        <div style={{ fontSize: 9.5, color: doc ? THEME.text2 : THEME.text3, marginTop: 4, lineHeight: 1.4 }}>{dt.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {expandedId === expandedItem.id && !isContractor && !readOnly && (
            <div style={{ borderTop: docsExpandedId === expandedItem.id ? `1px solid ${THEME.border}` : "none", paddingTop: docsExpandedId === expandedItem.id ? 10 : 0 }}>
              <label style={styles.label}>توضیحات (برای رد یا نیاز به اصلاح الزامی است)</label>
              <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={reviewNoteDraft} onChange={(e) => setReviewNoteDraft(e.target.value)} dir="rtl" />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" style={{ ...styles.smallButton, background: "#166534" }} onClick={() => submitReview(expandedItem, "approved")} disabled={savingReview}>تأیید شد</button>
                <button type="button" style={{ ...styles.smallButton, background: "#b45309" }} onClick={() => submitReview(expandedItem, "needs_correction")} disabled={savingReview}>نیاز به اصلاح</button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => submitReview(expandedItem, "rejected")} disabled={savingReview}>رد شد</button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => { setExpandedId(null); setDocsExpandedId(null); }} disabled={savingReview}>بستن</button>
              </div>
            </div>
          )}
          {docsExpandedId === expandedItem.id && expandedId !== expandedItem.id && (
            <button type="button" style={{ ...styles.smallButton, background: THEME.text3, marginTop: 10 }} onClick={() => setDocsExpandedId(null)}>بستن مدارک</button>
          )}
        </div>
      )}

      {viewerSrc && <DocumentViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  );
}
