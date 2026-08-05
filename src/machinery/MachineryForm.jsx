import React, { useState } from "react";
import { Truck, CheckCircle2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { JalaliDateInput } from "../personnel/jalaliDate.jsx";
import DocUploadField from "../personnel/DocUploadField.jsx";
import DocumentViewerModal from "../personnel/DocumentViewerModal.jsx";
import {
  MACHINE_TYPES, OWNERSHIP_STATUSES, LICENSE_TYPES, TRAFFIC_STATUSES, MACHINERY_DOC_TYPES,
  insertMachinery, updateMachineryInfo, submitMachineryForReview,
  uploadMachineryDocument, deleteMachineryDocument, getMissingRequiredDocs,
} from "./machineryApi.js";

/**
 * Registration/edit form for a machine — three distinct actions, not one:
 *
 *  1. First save ("ذخیره‌ی اطلاعات و افزودن مدارک") — creates the record as
 *     a "draft" (invisible to the employer) so it gets a real id, and the
 *     documents section appears immediately on the SAME screen — no need
 *     to leave and come back to upload files, which was the actual bug
 *     being reported (documents only ever showed up after a first save).
 *  2. "ذخیره‌ی تغییرات" — updates text fields without touching approval
 *     status or submitting anything.
 *  3. "ارسال برای تأیید کارفرما" — hard-gated: computes which required
 *     documents are still missing and refuses to submit (with a specific
 *     list) until every one of them is uploaded. Only this action makes
 *     the machine visible/actionable to the employer.
 */
export default function MachineryForm({ existingMachinery, existingDocuments, currentUser, onSaved, onBack }) {
  const [machinery, setMachinery] = useState(existingMachinery || null);
  const [project, setProject] = useState(existingMachinery?.project || "");
  const [machineName, setMachineName] = useState(existingMachinery?.machineName || "");
  const [machineType, setMachineType] = useState(existingMachinery?.machineType || "heavy");
  const [plateNumber, setPlateNumber] = useState(existingMachinery?.plateNumber || "");
  const [chassisNumber, setChassisNumber] = useState(existingMachinery?.chassisNumber || "");
  const [manufactureYear, setManufactureYear] = useState(existingMachinery?.manufactureYear || "");
  const [ownershipStatus, setOwnershipStatus] = useState(existingMachinery?.ownershipStatus || "owned");
  const [insuranceExpiry, setInsuranceExpiry] = useState(existingMachinery?.insuranceExpiry || "");
  const [insuranceIssueDate, setInsuranceIssueDate] = useState(existingMachinery?.insuranceIssueDate || "");
  const [inspectionExpiry, setInspectionExpiry] = useState(existingMachinery?.inspectionExpiry || "");
  const [inspectionIssueDate, setInspectionIssueDate] = useState(existingMachinery?.inspectionIssueDate || "");
  const [healthCertIssueDate, setHealthCertIssueDate] = useState(existingMachinery?.healthCertIssueDate || "");
  const [healthCertExpiry, setHealthCertExpiry] = useState(existingMachinery?.healthCertExpiry || "");
  const [driverName, setDriverName] = useState(existingMachinery?.driverName || "");
  const [driverLicenseType, setDriverLicenseType] = useState(existingMachinery?.driverLicenseType || "grade_one");
  const [driverLicenseIssueDate, setDriverLicenseIssueDate] = useState(existingMachinery?.driverLicenseIssueDate || "");
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState(existingMachinery?.driverLicenseExpiry || "");
  const [backupDriverName, setBackupDriverName] = useState(existingMachinery?.backupDriverName || "");
  const [backupDriverLicenseIssueDate, setBackupDriverLicenseIssueDate] = useState(existingMachinery?.backupDriverLicenseIssueDate || "");
  const [backupDriverLicenseExpiry, setBackupDriverLicenseExpiry] = useState(existingMachinery?.backupDriverLicenseExpiry || "");
  const [deviceCode, setDeviceCode] = useState(existingMachinery?.deviceCode || "");
  const [trafficStatus, setTrafficStatus] = useState(existingMachinery?.trafficStatus || "active");
  const [unsafeBehavior, setUnsafeBehavior] = useState(existingMachinery?.unsafeBehavior || "");
  const [docs, setDocs] = useState(() => {
    const map = {};
    (existingDocuments || []).forEach((d) => { map[d.docType] = d; });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [viewerSrc, setViewerSrc] = useState(null);

  const missingRequired = getMissingRequiredDocs(Object.keys(docs));

  const buildRecord = () => ({
    contractorId: currentUser?.contractorId || currentUser?.id || "",
    contractorName: currentUser?.name || "",
    project: project.trim(),
    machineName: machineName.trim(),
    machineType, plateNumber: plateNumber.trim(), chassisNumber: chassisNumber.trim(),
    manufactureYear: manufactureYear.trim(), ownershipStatus,
    insuranceExpiry, insuranceIssueDate, inspectionExpiry, inspectionIssueDate,
    healthCertIssueDate, healthCertExpiry,
    driverName: driverName.trim(), driverLicenseType, driverLicenseIssueDate, driverLicenseExpiry,
    backupDriverName: backupDriverName.trim(), backupDriverLicenseIssueDate, backupDriverLicenseExpiry,
    deviceCode: deviceCode.trim(), trafficStatus, unsafeBehavior: unsafeBehavior.trim(),
    createdBy: currentUser?.name || "",
  });

  const validateBasics = () => {
    if (!machineName.trim() || !plateNumber.trim()) {
      setError("نام ماشین‌آلات و شماره پلاک الزامی است");
      return false;
    }
    return true;
  };

  // ذخیره (اولین بار می‌سازد؛ بعدش فقط به‌روزرسانی — بدون ارسال برای تأیید)
  const handleSave = async () => {
    if (!validateBasics()) return;
    setSaving(true);
    setError("");
    const record = buildRecord();
    const result = machinery
      ? await updateMachineryInfo(machinery.id, record)
      : await insertMachinery(record);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setMachinery(result); // فرم روی همین صفحه می‌ماند، بخش مدارک همین الان ظاهر می‌شود
  };

  // ارسال واقعی برای بررسی کارفرما — قفل تا مدارک الزامی کامل شود
  const handleSubmitForReview = async () => {
    if (!validateBasics()) return;
    if (missingRequired.length > 0) {
      setError(`قبل از ارسال، این مدارک الزامی را بارگذاری کنید: ${missingRequired.map((d) => d.label).join("، ")}`);
      return;
    }
    setSubmitting(true);
    setError("");
    const record = buildRecord();
    const result = await submitMachineryForReview(machinery.id, record, Object.keys(docs));
    setSubmitting(false);
    if (result?.__error) { setError(result.message); return; }
    onSaved && onSaved(result);
  };

  const handleUploadDoc = async (docType, fileData, fileName, mimeType) => {
    if (!machinery?.id) {
      return { __error: true, message: "ابتدا دکمه‌ی «ذخیره‌ی اطلاعات» را بزنید، سپس مدارک را بارگذاری نمایید." };
    }
    const result = await uploadMachineryDocument(machinery.id, docType, fileData, fileName, mimeType);
    if (!result?.__error) setDocs((prev) => ({ ...prev, [docType]: result }));
    return result;
  };

  const handleDeleteDoc = async (docType, doc) => {
    if (!confirm("این مدرک حذف شود؟")) return;
    await deleteMachineryDocument(doc.id);
    setDocs((prev) => {
      const next = { ...prev };
      delete next[docType];
      return next;
    });
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Truck size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>
          {machinery ? "ویرایش ماشین‌آلات" : "ثبت ماشین‌آلات جدید"}
        </h2>
      </div>

      {machinery?.reviewNote && (
        <div style={{ ...styles.card, width: "auto", marginBottom: 14, background: "#fef3c7", border: "1px solid #fde68a" }}>
          <p style={{ fontSize: 12.5, color: "#92400e", margin: 0 }}><b>یادداشت کارفرما:</b> {machinery.reviewNote}</p>
        </div>
      )}

      <div style={{ ...styles.card, width: "auto" }}>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>پروژه / شرکت</label>
            <input style={styles.input} value={project} onChange={(e) => setProject(e.target.value)} dir="rtl" />
          </div>
          <div>
            <label style={styles.label}>نام ماشین‌آلات *</label>
            <input style={styles.input} value={machineName} onChange={(e) => setMachineName(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>نوع ماشین‌آلات</label>
            <select style={styles.input} value={machineType} onChange={(e) => setMachineType(e.target.value)} dir="rtl">
              {MACHINE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>شماره پلاک *</label>
            <input style={styles.input} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>شماره شاسی (مطابق کارت ماشین)</label>
            <input style={styles.input} value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} dir="rtl" />
          </div>
          <div>
            <label style={styles.label}>سال ساخت</label>
            <input style={styles.input} value={manufactureYear} onChange={(e) => setManufactureYear(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>وضعیت مالکیت</label>
            <select style={styles.input} value={ownershipStatus} onChange={(e) => setOwnershipStatus(e.target.value)} dir="rtl">
              {OWNERSHIP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>وضعیت تردد</label>
            <select style={styles.input} value={trafficStatus} onChange={(e) => setTrafficStatus(e.target.value)} dir="rtl">
              {TRAFFIC_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>تاریخ صدور بیمه‌نامه</label>
            <JalaliDateInput value={insuranceIssueDate} onChange={setInsuranceIssueDate} allowEmpty />
          </div>
          <div>
            <label style={styles.label}>تاریخ انقضای بیمه‌نامه</label>
            <JalaliDateInput value={insuranceExpiry} onChange={setInsuranceExpiry} allowEmpty />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>تاریخ صدور معاینه فنی</label>
            <JalaliDateInput value={inspectionIssueDate} onChange={setInspectionIssueDate} allowEmpty />
          </div>
          <div>
            <label style={styles.label}>تاریخ انقضای معاینه فنی</label>
            <JalaliDateInput value={inspectionExpiry} onChange={setInspectionExpiry} allowEmpty />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>تاریخ صدور سرتیفیکیت سلامت (ماشین‌آلات سنگین)</label>
            <JalaliDateInput value={healthCertIssueDate} onChange={setHealthCertIssueDate} allowEmpty />
          </div>
          <div>
            <label style={styles.label}>تاریخ انقضای سرتیفیکیت سلامت</label>
            <JalaliDateInput value={healthCertExpiry} onChange={setHealthCertExpiry} allowEmpty />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>نام راننده</label>
            <input style={styles.input} value={driverName} onChange={(e) => setDriverName(e.target.value)} dir="rtl" />
          </div>
          <div>
            <label style={styles.label}>نوع گواهینامه راننده</label>
            <select style={styles.input} value={driverLicenseType} onChange={(e) => setDriverLicenseType(e.target.value)} dir="rtl">
              {LICENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>تاریخ صدور گواهینامه راننده</label>
            <JalaliDateInput value={driverLicenseIssueDate} onChange={setDriverLicenseIssueDate} allowEmpty />
          </div>
          <div>
            <label style={styles.label}>تاریخ انقضای گواهینامه راننده</label>
            <JalaliDateInput value={driverLicenseExpiry} onChange={setDriverLicenseExpiry} allowEmpty />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>نام جانشین راننده (دارای گواهینامه)</label>
            <input style={styles.input} value={backupDriverName} onChange={(e) => setBackupDriverName(e.target.value)} dir="rtl" />
          </div>
          <div>
            <label style={styles.label}>کد دستگاه</label>
            <input style={styles.input} value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>تاریخ صدور گواهینامه جانشین راننده</label>
            <JalaliDateInput value={backupDriverLicenseIssueDate} onChange={setBackupDriverLicenseIssueDate} allowEmpty />
          </div>
          <div>
            <label style={styles.label}>تاریخ انقضای گواهینامه جانشین راننده</label>
            <JalaliDateInput value={backupDriverLicenseExpiry} onChange={setBackupDriverLicenseExpiry} allowEmpty />
          </div>
        </div>

        <div>
          <label style={styles.label}>رفتار ناایمن (در صورت مشاهده)</label>
          <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit" }} value={unsafeBehavior} onChange={(e) => setUnsafeBehavior(e.target.value)} dir="rtl" />
        </div>

        {error && <p style={styles.error}>{error}</p>}
        <button type="button" style={{ ...styles.button, background: THEME.text3 }} onClick={handleSave} disabled={saving}>
          {saving ? "در حال ذخیره..." : machinery ? "ذخیره‌ی تغییرات" : "ذخیره‌ی اطلاعات و افزودن مدارک"}
        </button>
      </div>

      {machinery && (
        <div style={{ ...styles.card, width: "auto", marginTop: 14 }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 4px", fontWeight: 700 }}>مدارک</h3>
          <p style={{ fontSize: 11.5, color: THEME.text3, margin: "0 0 12px" }}>موارد ستاره‌دار برای ارسال به کارفرما الزامی هستند.</p>
          {MACHINERY_DOC_TYPES.map((dt) => (
            <div key={dt.value} style={{ marginBottom: 14 }}>
              <label style={styles.label}>
                {dt.label}{dt.required && <span style={{ color: THEME.danger }}> *</span>}
                {docs[dt.value] && <CheckCircle2 size={13} color="#166534" style={{ marginInlineStart: 6, verticalAlign: "middle" }} />}
              </label>
              <DocUploadField
                existingDoc={docs[dt.value] || null}
                onConfirm={(data, name, mime) => handleUploadDoc(dt.value, data, name, mime)}
                onDelete={docs[dt.value] ? (doc) => handleDeleteDoc(dt.value, doc) : null}
                onView={setViewerSrc}
              />
            </div>
          ))}

          {missingRequired.length > 0 && (
            <p style={{ fontSize: 11.5, color: THEME.danger, marginBottom: 10 }}>
              مدارک الزامی باقی‌مانده: {missingRequired.map((d) => d.label).join("، ")}
            </p>
          )}

          <button
            type="button"
            style={{ ...styles.button, background: missingRequired.length > 0 ? THEME.text3 : THEME.teal }}
            onClick={handleSubmitForReview}
            disabled={submitting}
          >
            {submitting ? "در حال ارسال..." : "ارسال برای تأیید کارفرما"}
          </button>
        </div>
      )}

      {viewerSrc && <DocumentViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  );
}
