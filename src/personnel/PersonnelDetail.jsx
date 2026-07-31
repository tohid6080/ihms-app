import React, { useState, useEffect } from "react";
import { Clock, ShieldCheck, UserX } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { isoToJalaliDisplay, JalaliDateInput } from "./jalaliDate.jsx";
import DocUploadField from "./DocUploadField.jsx";
import DocumentViewerModal from "./DocumentViewerModal.jsx";
import SyncStatusBadge from "../offline/SyncStatusBadge.jsx";
import {
  DOC_TYPES, docStatusMeta, personnelStatusMeta,
  loadPersonnelDocuments, upsertDocument, reviewDocumentDB, deleteDocumentDB,
  updatePersonnelDB, progressPersonnelWorkflow, checkAndUpdateDeadlines,
  EMPLOYMENT_STATUS, employmentStatusMeta, setEmploymentStatus,
} from "./personnelApi.js";

/**
 * Personnel detail / review screen.
 * Contractor: uploads & replaces documents.
 * Employer/Admin: reviews each document (approve / reject / needs correction),
 * approves qualification (for special jobs), and — implicitly, through the
 * document approvals — drives the occupational-health workflow via
 * progressPersonnelWorkflow() in personnelApi.js.
 */
export default function PersonnelDetail({ personnel: initialPersonnel, role, currentUser, onBack, onUpdated, readOnly }) {
  const [personnel, setPersonnel] = useState(initialPersonnel);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewDraft, setReviewDraft] = useState({});
  const [showRejectFor, setShowRejectFor] = useState(null);
  const [qualNote, setQualNote] = useState(initialPersonnel.qualificationNote || "");
  const [showQualReject, setShowQualReject] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [showTerminateForm, setShowTerminateForm] = useState(false);
  const [terminationDateDraft, setTerminationDateDraft] = useState("");
  const [terminationError, setTerminationError] = useState("");
  const [savingEmployment, setSavingEmployment] = useState(false);

  const isEmployer = (role === "EMPLOYER" || role === "ADMIN") && !readOnly;
  const isContractor = role === "CONTRACTOR" && !readOnly;

  const load = async () => {
    setDocuments(await loadPersonnelDocuments(personnel.id));
    setLoading(false);
  };
  useEffect(() => { load(); }, [personnel.id]);

  const refreshAfterChange = (updatedPersonnel, updatedDocs) => {
    setPersonnel(updatedPersonnel);
    setDocuments(updatedDocs);
    onUpdated && onUpdated(updatedPersonnel);
  };

  const handleConfirmTermination = async () => {
    if (!terminationDateDraft) { setTerminationError("تاریخ ترک کار / تسویه حساب الزامی است"); return; }
    setSavingEmployment(true);
    setTerminationError("");
    const result = await setEmploymentStatus(personnel.id, "terminated", terminationDateDraft, currentUser?.name || currentUser?.username);
    setSavingEmployment(false);
    if (result?.__error) { setTerminationError(result.message); return; }
    setShowTerminateForm(false);
    refreshAfterChange({ ...personnel, ...result }, documents);
  };

  const handleReactivate = async () => {
    if (!confirm("این پرسنل دوباره به وضعیت «فعال» بازگردانده شود؟")) return;
    setSavingEmployment(true);
    const result = await setEmploymentStatus(personnel.id, "active", "", currentUser?.name || currentUser?.username);
    setSavingEmployment(false);
    if (result?.__error) { alert(result.message); return; }
    refreshAfterChange({ ...personnel, ...result }, documents);
  };

  const docByType = (t) => documents.find((d) => d.docType === t);

  const handleConfirmUpload = async (docType, data, fileName, mimeType) => {
    if (!isContractor) { alert("شما مجوز بارگذاری مدرک را ندارید"); return { __error: true, message: "no permission" }; }
    const doc = await upsertDocument(personnel.id, docType, data, fileName, mimeType, (currentUser?.name || currentUser?.username));
    if (doc?.__error) return doc;
    const newDocs = [...documents.filter((d) => d.docType !== docType), doc];
    const updatedP = await progressPersonnelWorkflow(personnel, newDocs, (currentUser?.name || currentUser?.username));
    refreshAfterChange(updatedP, newDocs);
    return doc;
  };

  const handleDeleteDoc = async (doc) => {
    if (!isContractor) { alert("شما مجوز حذف مدرک را ندارید"); return; }
    if (!confirm("این مدرک حذف شود؟")) return;
    await deleteDocumentDB(doc.id);
    setDocuments(documents.filter((d) => d.id !== doc.id));
  };

  const handleReviewDoc = async (doc, status, note) => {
    if (!isEmployer) { alert("شما مجوز بررسی مدارک را ندارید"); return; }
    const updatedDoc = await reviewDocumentDB(doc.id, status, note, (currentUser?.name || currentUser?.username));
    const newDocs = documents.map((d) => (d.id === doc.id ? updatedDoc : d));
    const updatedP = await progressPersonnelWorkflow(personnel, newDocs, (currentUser?.name || currentUser?.username));
    setShowRejectFor(null);
    refreshAfterChange(updatedP, newDocs);
  };

  const handleQualificationDecision = async (status) => {
    if (!isEmployer) { alert("شما مجوز تأیید صلاحیت را ندارید"); return; }
    const updated = await updatePersonnelDB(personnel.id, { qualificationStatus: status, qualificationNote: qualNote }, (currentUser?.name || currentUser?.username));
    const finalP = await progressPersonnelWorkflow(updated, documents, (currentUser?.name || currentUser?.username));
    setShowQualReject(false);
    refreshAfterChange(finalP, documents);
  };

  const sm = personnelStatusMeta(personnel.status);
  const visibleDocTypes = DOC_TYPES.filter((dt) => !dt.specialOnly || personnel.qualificationRequired);

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به لیست</div>}

      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, color: THEME.navy, fontWeight: 700 }}>{personnel.fullName}</h2>
            <p style={{ fontSize: 12, color: THEME.text3, margin: "4px 0 0" }}>{personnel.jobTitle} · {personnel.contractorName}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ ...styles.badge, color: sm.color, background: sm.bg, fontSize: 12 }}>{sm.label}</span>
            <span style={{ ...styles.badge, color: employmentStatusMeta(personnel.employmentStatus).color, background: employmentStatusMeta(personnel.employmentStatus).bg, fontSize: 12 }}>
              {employmentStatusMeta(personnel.employmentStatus).label}
            </span>
            {personnel.syncStatus && personnel.syncStatus !== "synced" && <SyncStatusBadge status={personnel.syncStatus} />}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: THEME.text2, marginTop: 12, lineHeight: 2 }}>
          <div>کد ملی: {personnel.nationalCode}</div>
          <div>شماره تماس: {personnel.phone}</div>
          <div>تاریخ شروع به کار: {isoToJalaliDisplay(personnel.startDate)}</div>
          {personnel.occHealthExpiry && <div>انقضای طب کار: {isoToJalaliDisplay(personnel.occHealthExpiry)}</div>}
          {personnel.employmentStatus === "terminated" && personnel.terminationDate && (
            <div style={{ color: THEME.danger, fontWeight: 600 }}>تاریخ ترک کار / تسویه حساب: {isoToJalaliDisplay(personnel.terminationDate)}</div>
          )}
        </div>
      </div>

      {isEmployer && (
        <div style={{ ...styles.card, width: "auto" }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 8px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <UserX size={16} color={THEME.text2} /> وضعیت اشتغال
          </h3>

          {personnel.employmentStatus === "active" && !showTerminateForm && (
            <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => setShowTerminateForm(true)}>
              ثبت ترک کار / تسویه حساب
            </button>
          )}

          {showTerminateForm && (
            <div>
              <label style={styles.label}>تاریخ ترک کار / تسویه حساب</label>
              <JalaliDateInput value={terminationDateDraft} onChange={setTerminationDateDraft} />
              {terminationError && <p style={styles.error}>{terminationError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={handleConfirmTermination} disabled={savingEmployment}>
                  {savingEmployment ? "در حال ثبت..." : "تأیید ترک کار / تسویه حساب"}
                </button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => { setShowTerminateForm(false); setTerminationError(""); }}>
                  انصراف
                </button>
              </div>
            </div>
          )}

          {personnel.employmentStatus === "terminated" && !showTerminateForm && (
            <button type="button" style={styles.smallButton} onClick={handleReactivate} disabled={savingEmployment}>
              {savingEmployment ? "در حال ثبت..." : "بازگرداندن به وضعیت فعال"}
            </button>
          )}
        </div>
      )}

      {personnel.qualificationRequired && (
        <div style={{ ...styles.card, width: "auto" }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 8px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={16} color="#c2410c" /> تأیید صلاحیت کارفرما
          </h3>
          <span style={{ ...styles.badge, color: docStatusMeta(personnel.qualificationStatus || "pending").color, background: docStatusMeta(personnel.qualificationStatus || "pending").bg }}>
            {docStatusMeta(personnel.qualificationStatus || "pending").label}
          </span>
          {personnel.qualificationNote && <p style={{ fontSize: 12, color: THEME.text2, marginTop: 8 }}><b>یادداشت:</b> {personnel.qualificationNote}</p>}
          {isEmployer && personnel.qualificationStatus !== "approved" && (
            <div style={{ marginTop: 12 }}>
              {!showQualReject ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={styles.button} onClick={() => handleQualificationDecision("approved")}>تأیید صلاحیت</button>
                  <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => setShowQualReject(true)}>رد / نیاز به اصلاح</button>
                </div>
              ) : (
                <>
                  <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={qualNote} onChange={(e) => setQualNote(e.target.value)} placeholder="دلیل رد یا نکات اصلاحی" dir="rtl" />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => handleQualificationDecision("rejected")}>ثبت رد</button>
                    <button type="button" style={{ ...styles.smallButton, background: "#b45309" }} onClick={() => handleQualificationDecision("needs_correction")}>نیاز به اصلاح</button>
                    <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setShowQualReject(false)}>انصراف</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ ...styles.card, width: "auto" }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 4px", fontWeight: 700 }}>مدارک</h3>
        {visibleDocTypes.map((dt) => {
          const doc = docByType(dt.value);
          const dsm = doc ? docStatusMeta(doc.status) : null;
          return (
            <div key={dt.value} style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: THEME.text }}>{dt.label}</span>
                {dsm && <span style={{ ...styles.badge, color: dsm.color, background: dsm.bg }}>{dsm.label}</span>}
              </div>

              {doc && (
                <div style={{ marginTop: 8 }}>
                  <DocUploadField
                    existingDoc={doc}
                    onConfirm={(data, name, mime) => handleConfirmUpload(dt.value, data, name, mime)}
                    onDelete={isContractor ? handleDeleteDoc : null}
                    onView={setViewerSrc}
                    disabled={isEmployer}
                    allowReplace={isContractor && (doc.status === "rejected" || doc.status === "needs_correction")}
                  />
                </div>
              )}
              {!doc && (
                <div style={{ marginTop: 8 }}>
                  {isContractor ? (
                    <DocUploadField
                      existingDoc={null}
                      onConfirm={(data, name, mime) => handleConfirmUpload(dt.value, data, name, mime)}
                      onView={setViewerSrc}
                    />
                  ) : (
                    <p style={{ fontSize: 11.5, color: THEME.text3, margin: "6px 0" }}>هنوز بارگذاری نشده</p>
                  )}
                </div>
              )}
              {doc?.reviewNote && <p style={{ fontSize: 11.5, color: THEME.danger, marginTop: 6 }}><b>یادداشت بررسی:</b> {doc.reviewNote}</p>}

              {isEmployer && doc && doc.status === "pending" && (
                <div style={{ marginTop: 8 }}>
                  {showRejectFor !== doc.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" style={{ ...styles.smallButton, padding: "6px 12px" }} onClick={() => handleReviewDoc(doc, "approved", "")}>تأیید</button>
                      <button type="button" style={{ ...styles.smallButton, background: THEME.danger, padding: "6px 12px" }} onClick={() => setShowRejectFor(doc.id)}>رد / اصلاح</button>
                    </div>
                  ) : (
                    <>
                      <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit", marginTop: 6 }} value={reviewDraft[doc.id] || ""} onChange={(e) => setReviewDraft({ ...reviewDraft, [doc.id]: e.target.value })} placeholder="توضیح رد/اصلاح" dir="rtl" />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => handleReviewDoc(doc, "rejected", reviewDraft[doc.id])}>رد</button>
                        <button type="button" style={{ ...styles.smallButton, background: "#b45309" }} onClick={() => handleReviewDoc(doc, "needs_correction", reviewDraft[doc.id])}>نیاز به اصلاح</button>
                        <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setShowRejectFor(null)}>انصراف</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {personnel.occHealthPath === "no_certificate" && (
        <div style={{ ...styles.card, width: "auto" }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 8px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={16} /> فرآیند طب کار
          </h3>
          <p style={{ fontSize: 12, color: THEME.text2, margin: "0 0 8px" }}>
            تاریخ شروع به کار: <b>{personnel.startDate ? isoToJalaliDisplay(personnel.startDate) : "ثبت نشده"}</b>
          </p>
          {!personnel.occHealthVisitDeadline && (
            <p style={{ fontSize: 12, color: THEME.text3 }}>پس از تأیید مدارک اولیه، مهلت ۳ روزه مراجعه به طب کار به‌صورت خودکار فعال می‌شود.</p>
          )}
          {personnel.occHealthVisitDeadline && !docByType("health_visit_receipt") && (
            <p style={{ fontSize: 12, color: "#b45309" }}>مهلت مراجعه تا تاریخ {isoToJalaliDisplay(personnel.occHealthVisitDeadline)}</p>
          )}
          {personnel.occHealthResultDeadline && !docByType("health_final_result") && (
            <p style={{ fontSize: 12, color: "#b45309" }}>مهلت بارگذاری نتیجه تا تاریخ {isoToJalaliDisplay(personnel.occHealthResultDeadline)}</p>
          )}
          {isEmployer && (personnel.occHealthVisitDeadline || personnel.occHealthResultDeadline) && (
            <button
              type="button"
              style={{ ...styles.smallButton, marginTop: 8 }}
              onClick={async () => {
                await checkAndUpdateDeadlines([personnel]);
                alert("بررسی انجام شد. اگر مهلت گذشته بود، اعلان باید همین الان توی زنگوله ظاهر شده باشد.");
              }}
            >
              بررسی مهلت و ارسال اعلان همین الان
            </button>
          )}
        </div>
      )}

      {viewerSrc && <DocumentViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  );
}
