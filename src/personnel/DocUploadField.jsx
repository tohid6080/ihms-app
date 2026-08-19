import React, { useState } from "react";
import { Camera, ImagePlus, X, Loader2, FileText } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { fileToBase64, isPdfDataUrl } from "./fileHelpers.js";

/**
 * Reusable document upload control.
 * Flow: pick (camera or gallery/PDF) → compress → staged preview with
 * replace/cancel → explicit "تأیید و بارگذاری" commits via onConfirm().
 * Nothing is sent anywhere until the user confirms the staged file.
 */
export default function DocUploadField({ existingDoc, onConfirm, onDelete, onView, disabled, allowReplace = true }) {
  const [staged, setStaged] = useState(null); // { data, name, mime }
  const [stage, setStage] = useState("idle"); // idle | compressing | uploading | error
  const [error, setError] = useState("");

  const pick = async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) { setError("فقط فایل تصویر یا PDF مجاز است"); return; }
    setError("");
    setStage("compressing");
    try {
      const data = await fileToBase64(file);
      setStaged({ data, name: file.name, mime: file.type });
      setStage("idle");
    } catch (e) {
      setError(e?.message || "خطا در پردازش فایل. دوباره تلاش کنید.");
      setStage("error");
    }
  };

  const confirmUpload = async () => {
    if (!staged) return;
    setStage("uploading");
    setError("");
    try {
      const result = await onConfirm(staged.data, staged.name, staged.mime);
      if (result?.__error) throw new Error(result.message);
      setStaged(null);
      setStage("idle");
    } catch (e) {
      setError(e?.message || "خطا در بارگذاری. اتصال اینترنت را بررسی کنید.");
      setStage("error");
    }
  };

  const cancelStaged = () => { setStaged(null); setStage("idle"); setError(""); };

  const displayDoc = staged || (existingDoc ? { data: existingDoc.fileData, name: existingDoc.fileName } : null);
  const showPickers = !staged && (!existingDoc || allowReplace);

  return (
    <div>
      {displayDoc && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          {isPdfDataUrl(displayDoc.data) ? (
            <button type="button" onClick={() => onView(displayDoc.data)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <FileText size={44} color={THEME.text2} />
            </button>
          ) : (
            <img
              src={displayDoc.data}
              alt=""
              onClick={() => onView(displayDoc.data)}
              style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: `1px solid ${THEME.border}` }}
            />
          )}
          <span style={{ fontSize: 11, color: THEME.text3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayDoc.name}</span>
          {staged && (
            <button type="button" onClick={cancelStaged} style={{ background: "none", border: "none", cursor: "pointer" }} title="لغو">
              <X size={16} color={THEME.danger} />
            </button>
          )}
        </div>
      )}

      {stage === "compressing" && <ProgressLine label="در حال فشرده‌سازی تصویر..." />}
      {stage === "uploading" && <ProgressLine label="در حال بارگذاری..." />}
      {error && <p style={styles.error}>{error}</p>}

      {staged && stage !== "uploading" && !disabled && (
        <button type="button" style={{ ...styles.smallButton, marginTop: 4 }} onClick={confirmUpload}>تأیید و بارگذاری</button>
      )}

      {!disabled && showPickers && stage !== "uploading" && (
        <div style={{ display: "flex", gap: 8, marginTop: staged ? 8 : 0 }}>
          <label style={pickerBtnStyle(THEME.teal)}>
            <Camera size={14} /> گرفتن عکس
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <label style={pickerBtnStyle(THEME.navyMid)}>
            <ImagePlus size={14} /> گالری / PDF
            <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
          </label>
        </div>
      )}

      {!disabled && existingDoc && !staged && allowReplace && onDelete && (
        <button type="button" onClick={() => onDelete(existingDoc)} style={{ ...styles.smallButton, background: THEME.danger, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <X size={13} /> حذف مدرک
        </button>
      )}
    </div>
  );
}

function pickerBtnStyle(bg) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: "#fff", borderRadius: 8,
    padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font, border: "none",
  };
}

function ProgressLine({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: THEME.text2, margin: "6px 0" }}>
      <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
      {label}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
