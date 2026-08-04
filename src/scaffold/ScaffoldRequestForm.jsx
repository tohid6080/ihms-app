import React, { useState } from "react";
import { Tag, CheckCircle2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { JalaliDateInput } from "../personnel/jalaliDate.jsx";
import DocUploadField from "../personnel/DocUploadField.jsx";
import DocumentViewerModal from "../personnel/DocumentViewerModal.jsx";
import { requestNewScaffoldTag, uploadScaffoldPhoto, deleteScaffoldPhoto } from "./scaffoldApi.js";

/**
 * Site photos are explicitly optional ("در صورت نیاز") so, unlike the
 * Machinery module, there's no hard document gate here — once the tag
 * number is generated the request already exists; photos are just an
 * optional attachment the contractor can add before or after.
 */
export default function ScaffoldRequestForm({ currentUser, contractorCode, onCreated, onBack }) {
  const [location, setLocation] = useState("");
  const [erectionDate, setErectionDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [viewerSrc, setViewerSrc] = useState(null);

  const handleSubmit = async () => {
    if (!location.trim() || !erectionDate) {
      setError("محل برپایی و تاریخ برپایی الزامی است");
      return;
    }
    setSaving(true);
    setError("");
    const result = await requestNewScaffoldTag({
      contractorId: currentUser?.contractorId || currentUser?.id || "",
      contractorName: currentUser?.name || "",
      contractorCode,
      location: location.trim(),
      erectionDate,
      purpose: purpose.trim(),
      createdBy: currentUser?.name || "",
    });
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setCreated(result);
  };

  const handleUploadPhoto = async (fileData, fileName, mimeType) => {
    const result = await uploadScaffoldPhoto(created.id, "request", fileData, fileName, mimeType);
    if (!result?.__error) setPhotos((prev) => [...prev, result]);
    return result;
  };
  const handleDeletePhoto = async (photo) => {
    await deleteScaffoldPhoto(photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  if (created) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <div style={{ ...styles.card, width: "auto", textAlign: "center" }}>
          <CheckCircle2 size={36} color="#166534" style={{ margin: "0 auto 10px" }} />
          <h3 style={{ margin: "0 0 6px", color: THEME.navy }}>درخواست ثبت شد</h3>
          <p style={{ fontSize: 13, color: THEME.text2 }}>شماره تگ اختصاص‌یافته:</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: THEME.teal, direction: "ltr" }}>{created.tagNumber}</p>
          <p style={{ fontSize: 12, color: THEME.text3 }}>این درخواست برای تأیید اولیه به کارفرما ارسال شد.</p>
        </div>

        <div style={{ ...styles.card, width: "auto", marginTop: 14 }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>تصاویر محل (اختیاری)</h3>
          {photos.map((p) => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <DocUploadField existingDoc={p} onConfirm={() => {}} onDelete={() => handleDeletePhoto(p)} onView={setViewerSrc} />
            </div>
          ))}
          <DocUploadField existingDoc={null} onConfirm={handleUploadPhoto} onView={setViewerSrc} />
        </div>

        <button type="button" style={{ ...styles.button, marginTop: 14 }} onClick={onBack}>بازگشت به لیست</button>
        {viewerSrc && <DocumentViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Tag size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>اخذ تگ داربست جدید</h2>
      </div>

      <div style={{ ...styles.card, width: "auto" }}>
        <label style={styles.label}>محل برپایی داربست *</label>
        <input style={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} dir="rtl" />

        <label style={styles.label}>تاریخ برپایی داربست *</label>
        <JalaliDateInput value={erectionDate} onChange={setErectionDate} />

        <label style={styles.label}>هدف یا شرح کار</label>
        <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={purpose} onChange={(e) => setPurpose(e.target.value)} dir="rtl" />

        {error && <p style={styles.error}>{error}</p>}
        <button type="button" style={styles.button} onClick={handleSubmit} disabled={saving}>
          {saving ? "در حال ثبت..." : "ثبت درخواست و ارسال برای تأیید اولیه"}
        </button>
      </div>
    </div>
  );
}
