import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { JalaliDateInput } from "./jalaliDate.jsx";
import DocUploadField from "./DocUploadField.jsx";
import DocumentViewerModal from "./DocumentViewerModal.jsx";
import { insertPersonnel, updatePersonnelDB, upsertDocument, loadContractorOptions, isSpecialJob } from "./personnelApi.js";

/**
 * Phase 2.2 — Personnel registration form.
 * Handles: basic info, automatic qualification-required detection, and the
 * occupational-health branch at registration time (has-certificate vs. no
 * certificate). The full 7-document upload/review UI is Phase 2.3 — this
 * form only inline-handles the ONE certificate upload for the "has
 * certificate" path, per the explicit Phase 2.2 requirements.
 */

// اعتبارسنجی کد ملی ایران (الگوریتم استاندارد رقم کنترلی)
function isValidNationalCode(code) {
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false; // همه ارقام یکسان، نامعتبر
  const check = parseInt(code[9], 10);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(code[i], 10) * (10 - i);
  const remainder = sum % 11;
  return (remainder < 2 && check === remainder) || (remainder >= 2 && check === 11 - remainder);
}
function isValidMobile(phone) {
  return /^09\d{9}$/.test((phone || "").trim());
}

export default function PersonnelForm({ onBack, onSaved, currentUser }) {
  const [contractors, setContractors] = useState([]);
  const [loadingContractors, setLoadingContractors] = useState(true);

  const [fullName, setFullName] = useState("");
  const [nationalCode, setNationalCode] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState("");

  const [occHealthPath, setOccHealthPath] = useState(""); // has_certificate | no_certificate
  const [occHealthDate, setOccHealthDate] = useState("");
  const [certFile, setCertFile] = useState(null); // { data, name, mime }
  const [viewerSrc, setViewerSrc] = useState(null);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setContractors(await loadContractorOptions());
      setLoadingContractors(false);
    })();
  }, []);

  const special = isSpecialJob(jobTitle);

  const handleCertConfirm = async (data, name, mime) => {
    setCertFile({ data, name, mime });
    setErrors((er) => { const c = { ...er }; delete c.cert; return c; });
    return null;
  };

  const validate = () => {
    const er = {};
    if (!fullName.trim() || fullName.trim().length < 3) er.fullName = "نام و نام خانوادگی را کامل وارد کنید";
    if (!nationalCode.trim()) er.nationalCode = "کد ملی الزامی است";
    else if (!isValidNationalCode(nationalCode.trim())) er.nationalCode = "کد ملی معتبر نیست";
    if (!contractorId) er.contractorId = "انتخاب شرکت پیمانکار الزامی است";
    if (!jobTitle.trim()) er.jobTitle = "عنوان شغلی الزامی است";
    if (!phone.trim()) er.phone = "شماره تماس الزامی است";
    else if (!isValidMobile(phone)) er.phone = "شماره موبایل معتبر نیست (مثال: 09123456789)";
    if (!startDate) er.startDate = "تاریخ شروع به کار الزامی است";
    if (!occHealthPath) er.occHealthPath = "وضعیت طب کار را مشخص کنید";
    if (occHealthPath === "has_certificate") {
      if (!certFile) er.cert = "بارگذاری گواهی طب کار الزامی است";
      if (!occHealthDate) er.occHealthDate = "تاریخ انجام طب کار الزامی است";
    }
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!validate()) { setFormError("لطفاً خطاهای فرم را برطرف کنید"); return; }
    setSaving(true);
    const contractor = contractors.find((c) => c.id === contractorId);
    const inserted = await insertPersonnel({
      fullName: fullName.trim(),
      nationalCode: nationalCode.trim(),
      contractorId,
      contractorName: contractor?.name || "",
      jobTitle: jobTitle.trim(),
      phone: phone.trim(),
      startDate,
      createdBy: currentUser?.name || currentUser?.username || "",
    });
    if (!inserted || inserted.__error) {
      setSaving(false);
      setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`);
      return;
    }

    if (occHealthPath === "has_certificate") {
      await updatePersonnelDB(inserted.id, { occHealthPath, occHealthDate }, currentUser?.name || currentUser?.username);
      await upsertDocument(inserted.id, "health_certificate", certFile.data, certFile.name, certFile.mime, currentUser?.name || currentUser?.username);
    } else {
      await updatePersonnelDB(inserted.id, { occHealthPath }, currentUser?.name || currentUser?.username);
    }

    setSaving(false);
    onSaved ? onSaved(inserted) : onBack && onBack();
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت</div>}
      <h2 style={{ margin: "0 0 4px", color: THEME.navy, fontSize: 18, fontWeight: 700 }}>ثبت پرسنل جدید</h2>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 18 }}>
        مدیریت ورود و تردد پرسنل — اطلاعات پایه و وضعیت طب کار
      </p>

      <div style={styles.card}>
        <label style={styles.label}>نام و نام خانوادگی</label>
        <input style={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} dir="rtl" />
        {errors.fullName && <p style={styles.error}>{errors.fullName}</p>}

        <label style={styles.label}>کد ملی</label>
        <input style={styles.input} value={nationalCode} onChange={(e) => setNationalCode(e.target.value.replace(/\D/g, "").slice(0, 10))} dir="ltr" inputMode="numeric" />
        {errors.nationalCode && <p style={styles.error}>{errors.nationalCode}</p>}

        <label style={styles.label}>شرکت پیمانکار</label>
        {loadingContractors ? (
          <p style={{ fontSize: 12.5, color: THEME.text3 }}>در حال بارگذاری لیست پیمانکاران...</p>
        ) : (
          <select style={styles.input} value={contractorId} onChange={(e) => setContractorId(e.target.value)} dir="rtl">
            <option value="">— انتخاب کنید —</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {errors.contractorId && <p style={styles.error}>{errors.contractorId}</p>}

        <label style={styles.label}>عنوان شغلی</label>
        <input style={styles.input} list="job-title-suggestions" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} dir="rtl" placeholder="مثال: جوشکار، داربست‌بند، کارگر عمومی..." />
        <datalist id="job-title-suggestions">
          <option value="داربست‌بند" /><option value="اپراتور جرثقیل" /><option value="ریگر" /><option value="نصاب" /><option value="برقکار" />
        </datalist>
        {errors.jobTitle && <p style={styles.error}>{errors.jobTitle}</p>}

        {special && (
          <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, padding: 12, marginTop: 12, display: "flex", gap: 8 }}>
            <AlertTriangle size={17} color="#c2410c" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#7c2d12", margin: 0, lineHeight: 1.7 }}>
              توجه: تأیید صلاحیت کارفرما برای مشاغل داربست‌بند، اپراتور جرثقیل، ریگر، نصاب و برقکار الزامی است و تا قبل از تأیید، شروع به کار در سایت امکان‌پذیر نخواهد بود.
              بارگذاری فرم تأیید صلاحیت پس از ثبت، در بخش مدارک این پرسنل انجام می‌شود.
            </p>
          </div>
        )}

        <label style={styles.label}>شماره تماس</label>
        <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} dir="ltr" inputMode="numeric" placeholder="09123456789" />
        {errors.phone && <p style={styles.error}>{errors.phone}</p>}

        <label style={styles.label}>تاریخ شروع به کار</label>
        <JalaliDateInput value={startDate} onChange={setStartDate} />
        {errors.startDate && <p style={styles.error}>{errors.startDate}</p>}
      </div>

      <div style={styles.card}>
        <h3 style={{ fontSize: 14.5, color: THEME.navy, margin: "0 0 4px", fontWeight: 700 }}>وضعیت طب کار</h3>
        <p style={{ fontSize: 11.5, color: THEME.text3, marginTop: 0, marginBottom: 12 }}>آیا این فرد در حال حاضر گواهی معتبر طب کار دارد؟</p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setOccHealthPath("has_certificate")}
            style={{
              flex: 1, padding: "12px 8px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font,
              border: occHealthPath === "has_certificate" ? `2px solid ${THEME.teal}` : `1.5px solid ${THEME.border}`,
              background: occHealthPath === "has_certificate" ? THEME.tealSoft : "#fff", color: occHealthPath === "has_certificate" ? THEME.tealDeep : THEME.text2,
            }}
          >
            دارای گواهی معتبر
          </button>
          <button
            type="button"
            onClick={() => { setOccHealthPath("no_certificate"); setCertFile(null); setOccHealthDate(""); }}
            style={{
              flex: 1, padding: "12px 8px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font,
              border: occHealthPath === "no_certificate" ? `2px solid ${THEME.navyMid}` : `1.5px solid ${THEME.border}`,
              background: occHealthPath === "no_certificate" ? "#eef1f5" : "#fff", color: occHealthPath === "no_certificate" ? THEME.navy : THEME.text2,
            }}
          >
            فاقد گواهی
          </button>
        </div>
        {errors.occHealthPath && <p style={styles.error}>{errors.occHealthPath}</p>}

        {occHealthPath === "has_certificate" && (
          <div style={{ marginTop: 14 }}>
            <label style={styles.label}>تاریخ انجام طب کار</label>
            <JalaliDateInput value={occHealthDate} onChange={setOccHealthDate} allowEmpty />
            {errors.occHealthDate && <p style={styles.error}>{errors.occHealthDate}</p>}

            <label style={styles.label}>گواهی طب کار (عکس یا PDF)</label>
            <DocUploadField
              existingDoc={certFile ? { fileData: certFile.data, fileName: certFile.name } : null}
              onConfirm={handleCertConfirm}
              onDelete={() => setCertFile(null)}
              onView={setViewerSrc}
              allowReplace
            />
            {errors.cert && <p style={styles.error}>{errors.cert}</p>}
          </div>
        )}

        {occHealthPath === "no_certificate" && (
          <p style={{ fontSize: 11.5, color: THEME.text3, marginTop: 12, lineHeight: 1.8 }}>
            پس از تأیید مدارک اولیه توسط کارفرما، مهلت ۳ روزه برای مراجعه به طب کار و سپس مهلت ۷ روزه برای بارگذاری نتیجه به‌صورت خودکار برای این پرسنل فعال می‌شود.
          </p>
        )}
      </div>

      {formError && <p style={styles.error}>{formError}</p>}
      <button type="button" style={styles.button} onClick={handleSubmit} disabled={saving}>
        {saving ? "در حال ثبت..." : "ثبت پرسنل"}
      </button>

      {viewerSrc && <DocumentViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  );
}
