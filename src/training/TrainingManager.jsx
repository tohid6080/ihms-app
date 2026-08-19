import React, { useState, useEffect } from "react";
import { GraduationCap, Plus, Trash2, X } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadActiveJobPositions } from "../jobpositions/jobPositionsApi.js";
import {
  loadTrainingCourses, createTrainingCourse, updateTrainingCourse, deleteTrainingCourse,
  loadRequirementsMatrix, setRequirement,
} from "./trainingApi.js";

/**
 * "مدیریت آموزش‌های تخصصی" — lives under مدیریت سیستم. Two things happen
 * here: (1) CRUD on the list of training courses, (2) a course × job-title
 * matrix — click a cell to toggle whether that job requires that course.
 * Same shape as the paper matrix this replaced; PersonnelDetail reads this
 * matrix live to show each person's required trainings.
 */
export default function TrainingManager({ onBack }) {
  const [courses, setCourses] = useState([]);
  const [positions, setPositions] = useState([]);
  const [matrix, setMatrix] = useState([]); // [{trainingId, jobPositionId}]
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [c, p, m] = await Promise.all([loadTrainingCourses(true), loadActiveJobPositions(), loadRequirementsMatrix()]);
    setCourses(c);
    setPositions(p);
    setMatrix(m);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isRequired = (trainingId, jobPositionId) => matrix.some((m) => m.trainingId === trainingId && m.jobPositionId === jobPositionId);

  const toggleCell = async (trainingId, jobPositionId) => {
    const currentlyRequired = isRequired(trainingId, jobPositionId);
    // به‌روزرسانی خوش‌بینانه — بدون معطلی صفحه به‌روز می‌شود
    setMatrix((prev) => (currentlyRequired ? prev.filter((m) => !(m.trainingId === trainingId && m.jobPositionId === jobPositionId)) : [...prev, { trainingId, jobPositionId }]));
    const result = await setRequirement(trainingId, jobPositionId, !currentlyRequired);
    if (result?.__error) { alert(result.message); await load(); }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    setError("");
    const result = await createTrainingCourse(newTitle.trim(), newDesc.trim());
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setNewTitle(""); setNewDesc("");
    await load();
  };

  const handleToggleActive = async (course) => {
    await updateTrainingCourse(course.id, { isActive: !course.isActive });
    await load();
  };

  const handleDelete = async (course) => {
    if (!confirm(`دوره‌ی «${course.title}» و تمام ارتباط‌هایش با عناوین شغلی حذف شود؟`)) return;
    const result = await deleteTrainingCourse(course.id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به مدیریت سیستم</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <GraduationCap size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>مدیریت آموزش‌های تخصصی</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18 }}>
        دوره‌های آموزشی موردنیاز سازمان را تعریف کن و مشخص کن هر عنوان شغلی به کدام دوره‌ها نیاز دارد. این ماتریس در ثبت/ویرایش پرسنل به‌صورت خودکار استفاده می‌شود.
      </p>

      <div style={{ ...styles.card, width: "auto", marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>دوره‌ی آموزشی جدید</h3>
        <div style={styles.formGrid}>
          <input style={styles.input} placeholder="عنوان دوره (مثال: آموزش کار در ارتفاع)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} dir="rtl" />
          <input style={styles.input} placeholder="توضیحات (اختیاری)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} dir="rtl" />
        </div>
        {error && <p style={styles.error}>{error}</p>}
        <button type="button" style={{ ...styles.button, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={handleCreate} disabled={saving || !newTitle.trim()}>
          <Plus size={15} /> {saving ? "در حال ثبت..." : "افزودن دوره"}
        </button>
      </div>

      <div style={{ ...styles.card, width: "auto", marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>دوره‌های تعریف‌شده ({courses.length})</h3>
        {courses.length === 0 && <p style={{ color: THEME.text3, fontSize: 12.5 }}>هنوز دوره‌ای ثبت نشده است.</p>}
        {courses.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${THEME.border}` }}>
            <span style={{ flex: 1, fontSize: 13, color: c.isActive ? THEME.text : THEME.text3, textDecoration: c.isActive ? "none" : "line-through" }}>{c.title}</span>
            <button type="button" style={{ ...styles.smallButton, background: c.isActive ? THEME.text3 : "#166534" }} onClick={() => handleToggleActive(c)}>
              {c.isActive ? "غیرفعال کردن" : "فعال کردن"}
            </button>
            <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => handleDelete(c)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ ...styles.card, width: "auto" }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, margin: "0 0 4px", fontWeight: 700 }}>ماتریس آموزش بر اساس عنوان شغلی</h3>
        <p style={{ fontSize: 11.5, color: THEME.text3, margin: "0 0 12px" }}>روی هر خانه کلیک کن تا الزامی/غیرالزامی شدن آن دوره برای آن شغل تغییر کند.</p>
        {(courses.length === 0 || positions.length === 0) && (
          <p style={{ color: THEME.text3, fontSize: 12.5 }}>برای نمایش ماتریس، حداقل یک دوره و یک عنوان شغلی (از «مدیریت عناوین شغلی») لازم است.</p>
        )}
        {courses.length > 0 && positions.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", insetInlineStart: 0, background: THEME.surface, padding: "6px 10px", textAlign: "right", borderBottom: `1.5px solid ${THEME.border}`, whiteSpace: "nowrap" }}>عنوان آموزش</th>
                  {positions.map((p) => (
                    <th key={p.id} style={{ padding: "6px 8px", borderBottom: `1.5px solid ${THEME.border}`, minWidth: 70 }}>
                      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10.5, color: THEME.text2, whiteSpace: "nowrap", margin: "0 auto", height: 90 }}>{p.title}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses.filter((c) => c.isActive).map((c) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ position: "sticky", insetInlineStart: 0, background: THEME.surface, padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{c.title}</td>
                    {positions.map((p) => {
                      const req = isRequired(c.id, p.id);
                      return (
                        <td key={p.id} style={{ padding: 2, textAlign: "center" }}>
                          <div
                            onClick={() => toggleCell(c.id, p.id)}
                            style={{ width: 26, height: 26, margin: "0 auto", borderRadius: 5, cursor: "pointer", background: req ? THEME.teal : "#eef1f5", border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            {req && <X size={13} color="#fff" style={{ transform: "rotate(45deg)" }} />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
