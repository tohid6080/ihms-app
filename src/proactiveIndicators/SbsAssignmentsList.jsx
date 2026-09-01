import React, { useState, useEffect } from "react";
import { Target, Trash2, CheckCircle2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { loadSbsAssignments, loadSbsAssignmentsForContractor, updateSbsAssignmentStatus, deleteSbsAssignment, computeAssignmentProgress } from "./sbsApi.js";

const STATUS_META = {
  sent: { label: "ارسال‌شده", color: "#1d4ed8", bg: "#dbeafe" },
  in_progress: { label: "در حال انجام", color: "#b45309", bg: "#fef3c7" },
  completed: { label: "تکمیل‌شده", color: "#166534", bg: "#dcfce7" },
};

/**
 * فهرست هدف‌های نمونه‌برداری واگذارشده — طبق خواسته‌ی صریح: کارفرما هر
 * چیزی که فرستاده را می‌بیند (با پیشرفت واقعی هر پیمانکار)؛ پیمانکار
 * فقط هدف‌های خودش (یا سراسری) را می‌بیند و می‌تواند وضعیت را به‌روز کند.
 * پیشرفت همیشه از observations واقعی محاسبه می‌شود — یک عدد جدا و
 * دستکاری‌پذیر نیست.
 */
export default function SbsAssignmentsList({ role, currentUser, observations }) {
  const [assignments, setAssignments] = useState(null);
  const isContractor = role === "CONTRACTOR";

  const load = async () => {
    if (isContractor) {
      setAssignments(await loadSbsAssignmentsForContractor(currentUser?.id));
    } else {
      setAssignments(await loadSbsAssignments());
    }
  };
  useEffect(() => { load(); }, [role]);

  const handleStatusChange = async (id, status) => {
    const result = await updateSbsAssignmentStatus(id, status);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("این هدف نمونه‌برداری حذف شود؟")) return;
    const result = await deleteSbsAssignment(id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  if (assignments === null) return null;
  if (assignments.length === 0) return null;

  return (
    <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
        <Target size={15} /> {isContractor ? "هدف‌های نمونه‌برداری واگذارشده به شما" : "هدف‌های نمونه‌برداری ارسال‌شده"}
      </h3>
      {assignments.map((a) => {
        const progress = computeAssignmentProgress(a, observations, currentUser?.name);
        const meta = STATUS_META[a.status];
        return (
          <div key={a.id} style={{ padding: "12px 0", borderBottom: `1px solid ${THEME.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: THEME.navy }}>
                  {a.mode === "factory" ? "نمونه‌برداری کارخانه" : "نمونه‌برداری کارگاهی"} — {a.totalSampleSize.toLocaleString("fa-IR")} مشاهده
                </span>
                <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 999, background: meta.bg, color: meta.color, fontWeight: 600, marginRight: 8 }}>{meta.label}</span>
                <p style={{ fontSize: 11.5, color: THEME.text3, margin: "4px 0 0" }}>
                  {toJalaliSafe(a.createdAt)} — توسط {a.createdBy}{a.note && ` — ${a.note}`}
                </p>
              </div>
              {!isContractor && (
                <button type="button" onClick={() => handleDelete(a.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={13} color={THEME.danger} />
                </button>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: THEME.text2, marginBottom: 4 }}>
                <span>پیشرفت واقعی: {progress.done.toLocaleString("fa-IR")} از {progress.target.toLocaleString("fa-IR")} مشاهده</span>
                <span style={{ fontWeight: 700, color: THEME.navy }}>{progress.pct}٪</span>
              </div>
              <div style={{ height: 8, background: THEME.bg, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${progress.pct}%`, height: "100%", background: progress.pct >= 100 ? "#16a34a" : THEME.teal, borderRadius: 999 }} />
              </div>
            </div>

            {isContractor && a.status !== "completed" && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {a.status === "sent" && (
                  <button type="button" style={{ ...styles.smallButton, fontSize: 11 }} onClick={() => handleStatusChange(a.id, "in_progress")}>شروع نمونه‌برداری</button>
                )}
                <button type="button" style={{ ...styles.smallButton, fontSize: 11, display: "flex", alignItems: "center", gap: 4, background: "#166534" }} onClick={() => handleStatusChange(a.id, "completed")}>
                  <CheckCircle2 size={12} /> اعلام تکمیل
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
