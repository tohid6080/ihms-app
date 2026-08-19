import React, { useState, useEffect, useMemo } from "react";
import { Plus, Paperclip, X, CheckCircle2, Filter } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { JalaliDateInput, toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { fileToBase64 } from "../personnel/fileHelpers.js";
import {
  loadCorrectiveActions, createCorrectiveAction, updateCorrectiveAction, approveCorrectiveAction,
  uploadCorrectiveActionFile, loadContractorsForDropdown, computeKpis, isOverdue,
  SOURCE_OPTIONS, PRIORITY_OPTIONS, STATUS_META, STATUS_ORDER,
} from "./correctiveActionsApi.js";

const EMPTY_FORM = {
  actionNumber: "", source: "other", nonconformanceDescription: "", rootCause: "", actionDescription: "",
  responsibleContractorId: "", responsibleContractorName: "", responsiblePerson: "", projectName: "",
  dueDate: "", priority: "medium", status: "open", completedAt: "", executorNotes: "", attachments: [],
  approvedBy: "", approvedAt: "", approverNotes: "",
};

const EMPTY_FILTERS = { contractorId: "", projectName: "", responsiblePerson: "", status: "", priority: "", search: "" };

export default function CorrectiveActionsDashboard({ onBack, currentUser }) {
  const [list, setList] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [kpiFilter, setKpiFilter] = useState(""); // کلیک روی یک کارت KPI، لیست را فیلتر می‌کند

  const isContractor = currentUser?.role === "CONTRACTOR";

  const load = async () => {
    const [rows, contractorRows] = await Promise.all([loadCorrectiveActions(), loadContractorsForDropdown()]);
    setList(rows);
    setContractors(contractorRows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const kpis = useMemo(() => computeKpis(list), [list]);

  const filtered = useMemo(() => {
    const explicitlyWantsClosed = kpiFilter === "closed" || filters.status === "closed";
    return list.filter((a) => {
      // طبق خواسته‌ی صریح: در لیست پیش‌فرض، اقدامات «بسته‌شده» نمایش داده
      // نشوند — مگر اینکه کاربر خودش صریحاً بخواهد ببیندشان
      if (!explicitlyWantsClosed && a.status === "closed") return false;
      if (kpiFilter === "overdue" && !isOverdue(a)) return false;
      if (kpiFilter && kpiFilter !== "overdue" && a.status !== kpiFilter) return false;
      if (filters.contractorId && a.responsibleContractorId !== filters.contractorId) return false;
      if (filters.projectName && !a.projectName.toLowerCase().includes(filters.projectName.toLowerCase())) return false;
      if (filters.responsiblePerson && !a.responsiblePerson.toLowerCase().includes(filters.responsiblePerson.toLowerCase())) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.priority && a.priority !== filters.priority) return false;
      if (filters.search && !(`${a.actionNumber} ${a.nonconformanceDescription}`.toLowerCase().includes(filters.search.toLowerCase()))) return false;
      return true;
    });
  }, [list, filters, kpiFilter]);

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setError(""); setShowForm(true); };
  const openEdit = (a) => {
    setForm({
      actionNumber: a.actionNumber, source: a.source, nonconformanceDescription: a.nonconformanceDescription,
      rootCause: a.rootCause, actionDescription: a.actionDescription, responsibleContractorId: a.responsibleContractorId,
      responsibleContractorName: a.responsibleContractorName, responsiblePerson: a.responsiblePerson, projectName: a.projectName,
      dueDate: a.dueDate, priority: a.priority, status: a.status, completedAt: a.completedAt, executorNotes: a.executorNotes,
      attachments: a.attachments, approvedBy: a.approvedBy, approvedAt: a.approvedAt, approverNotes: a.approverNotes,
    });
    setEditingId(a.id);
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nonconformanceDescription.trim()) { setError("شرح عدم انطباق الزامی است"); return; }
    setSaving(true);
    setError("");
    const result = editingId
      ? await updateCorrectiveAction(editingId, form)
      : await createCorrectiveAction(form, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setShowForm(false);
    await load();
  };

  const handleApprove = async () => {
    if (!editingId) return;
    setSaving(true);
    // اول تغییرات فعلی فرم ذخیره شود، بعد وضعیت به «بسته‌شده» تغییر کند
    const saveResult = await updateCorrectiveAction(editingId, form);
    if (saveResult?.__error) { setSaving(false); setError(saveResult.message); return; }
    const result = await approveCorrectiveAction(editingId, currentUser?.name, form.approverNotes);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setShowForm(false);
    await load();
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadCorrectiveActionFile(base64, file.name, file.type);
      setUploading(false);
      if (result?.__error) { setError(result.message); return; }
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, result] }));
    } catch (e) {
      setUploading(false);
      setError(e?.message || "خطا در آپلود فایل");
    }
  };

  const removeAttachment = (idx) => {
    setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }));
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  // ---------- فرم ثبت/ویرایش ----------
  if (showForm) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <div style={styles.backLink} onClick={() => setShowForm(false)}>← انصراف</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, color: THEME.navy, fontWeight: 700, margin: 0 }}>{editingId ? "ویرایش اقدام اصلاحی" : "اقدام اصلاحی جدید"}</h2>
          {editingId && <StatusBadge status={form.status} />}
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>اطلاعات اصلی</h3>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>شماره اقدام اصلاحی</label>
              <input style={styles.input} value={form.actionNumber} onChange={(e) => setForm({ ...form, actionNumber: e.target.value })} dir="ltr" placeholder="خودکار در صورت خالی‌بودن" />
            </div>
            <div>
              <label style={styles.label}>منبع شناسایی عدم انطباق</label>
              <select style={styles.input} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} dir="rtl">
                {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <label style={styles.label}>شرح عدم انطباق</label>
          <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={form.nonconformanceDescription} onChange={(e) => setForm({ ...form, nonconformanceDescription: e.target.value })} dir="rtl" />

          <label style={styles.label}>علت ریشه‌ای</label>
          <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit" }} value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} dir="rtl" />

          <label style={styles.label}>شرح اقدام اصلاحی / پیشگیرانه</label>
          <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={form.actionDescription} onChange={(e) => setForm({ ...form, actionDescription: e.target.value })} dir="rtl" />
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>مسئولیت و زمان‌بندی</h3>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>شرکت / پیمانکار مسئول</label>
              <select
                style={styles.input}
                value={form.responsibleContractorId}
                onChange={(e) => {
                  const c = contractors.find((x) => x.id === e.target.value);
                  setForm({ ...form, responsibleContractorId: e.target.value, responsibleContractorName: c?.name || "" });
                }}
                dir="rtl"
              >
                <option value="">— انتخاب کنید —</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>مسئول اجرا (نام شخص)</label>
              <input style={styles.input} value={form.responsiblePerson} onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })} dir="rtl" />
            </div>
          </div>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>پروژه</label>
              <input style={styles.input} value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>اولویت</label>
              <select style={styles.input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} dir="rtl">
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>مهلت انجام</label>
              <JalaliDateInput value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} allowEmpty />
            </div>
            <div>
              <label style={styles.label}>وضعیت اقدام</label>
              <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} dir="rtl">
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>اجرا و مستندسازی</h3>
          <label style={styles.label}>تاریخ انجام</label>
          <JalaliDateInput value={form.completedAt} onChange={(v) => setForm({ ...form, completedAt: v })} allowEmpty />
          <label style={styles.label}>توضیحات مسئول اجرا</label>
          <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit" }} value={form.executorNotes} onChange={(e) => setForm({ ...form, executorNotes: e.target.value })} dir="rtl" />

          <label style={styles.label}>مستندات و تصاویر</label>
          {form.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {form.attachments.map((att, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f3f5", borderRadius: 8, padding: "6px 10px" }}>
                  <a href={att.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: THEME.tealDeep, textDecoration: "none" }}>{att.name}</a>
                  <button type="button" onClick={() => removeAttachment(i)} style={{ background: "none", border: "none", cursor: "pointer", color: THEME.text3 }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <label style={{ ...styles.smallButton, display: "inline-flex", alignItems: "center", gap: 6, background: THEME.navyMid, cursor: "pointer" }}>
            <Paperclip size={13} /> {uploading ? "در حال آپلود..." : "افزودن فایل"}
            <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => { handleFileUpload(e.target.files?.[0]); e.target.value = ""; }} disabled={uploading} />
          </label>
        </div>

        {!isContractor && (
          <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>تأیید HSE / کارفرما</h3>
            {form.approvedBy
              ? <p style={{ fontSize: 11.5, color: THEME.text2 }}>تأییدشده توسط <b>{form.approvedBy}</b> در تاریخ {toJalaliSafe(form.approvedAt)}</p>
              : <p style={{ fontSize: 11.5, color: THEME.text3 }}>هنوز تأیید نشده</p>}
            <label style={styles.label}>توضیحات تأییدکننده</label>
            <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit" }} value={form.approverNotes} onChange={(e) => setForm({ ...form, approverNotes: e.target.value })} dir="rtl" />
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={styles.button} onClick={handleSave} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره"}</button>
          {!isContractor && editingId && form.status !== "closed" && (
            <button type="button" style={{ ...styles.button, background: "#166534", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={handleApprove} disabled={saving}>
              <CheckCircle2 size={15} /> تأیید و بستن
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- لیست + داشبورد ----------
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>لیست اقدامات اصلاحی</h2>
        <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={openNew}>
          <Plus size={13} /> اقدام جدید
        </button>
      </div>

      {/* کارت‌های آماری KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 16 }}>
        <KpiCard label="کل اقدامات" value={kpis.total} active={kpiFilter === ""} onClick={() => setKpiFilter("")} color={THEME.navy} />
        <KpiCard label="باز" value={kpis.open} active={kpiFilter === "open"} onClick={() => setKpiFilter("open")} color={STATUS_META.open.bg} />
        <KpiCard label="در حال انجام" value={kpis.in_progress} active={kpiFilter === "in_progress"} onClick={() => setKpiFilter("in_progress")} color={STATUS_META.in_progress.bg} />
        <KpiCard label="منتظر تأیید" value={kpis.done_pending_approval} active={kpiFilter === "done_pending_approval"} onClick={() => setKpiFilter("done_pending_approval")} color="#b45309" />
        <KpiCard label="بسته شده" value={kpis.closed} active={kpiFilter === "closed"} onClick={() => setKpiFilter("closed")} color={STATUS_META.closed.bg} />
        <KpiCard label="منقضی شده" value={kpis.expired} active={kpiFilter === "expired"} onClick={() => setKpiFilter("expired")} color={STATUS_META.expired.bg} />
        <KpiCard label="سررسید شده" value={kpis.overdue} active={kpiFilter === "overdue"} onClick={() => setKpiFilter("overdue")} color="#7c2d12" />
      </div>

      {/* فیلترها */}
      <button type="button" onClick={() => setShowFilters((v) => !v)} style={{ ...styles.smallButton, background: THEME.navyMid, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Filter size={13} /> فیلترها
      </button>
      {showFilters && (
        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>پیمانکار</label>
              <select style={styles.input} value={filters.contractorId} onChange={(e) => setFilters({ ...filters, contractorId: e.target.value })} dir="rtl">
                <option value="">همه</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>پروژه</label>
              <input style={styles.input} value={filters.projectName} onChange={(e) => setFilters({ ...filters, projectName: e.target.value })} dir="rtl" />
            </div>
          </div>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>مسئول اقدام</label>
              <input style={styles.input} value={filters.responsiblePerson} onChange={(e) => setFilters({ ...filters, responsiblePerson: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>وضعیت</label>
              <select style={styles.input} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} dir="rtl">
                <option value="">همه</option>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>اولویت</label>
              <select style={styles.input} value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} dir="rtl">
                <option value="">همه</option>
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>جستجو (شماره / شرح عدم انطباق)</label>
              <input style={styles.input} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} dir="rtl" />
            </div>
          </div>
          <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setFilters(EMPTY_FILTERS)}>پاک‌کردن فیلترها</button>
        </div>
      )}

      {filtered.length === 0 && <p style={{ color: THEME.text3, textAlign: "center", padding: "30px 0" }}>موردی پیدا نشد</p>}

      {filtered.map((a) => (
        <div key={a.id} style={{ ...styles.card, width: "auto", marginBottom: 8, cursor: "pointer" }} onClick={() => openEdit(a)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: THEME.navy, fontSize: 13, direction: "ltr" }}>{a.actionNumber}</span>
                <StatusBadge status={a.status} />
                {isOverdue(a) && <span style={{ fontSize: 10, background: "#7c2d12", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>سررسید شده</span>}
                {a.autoGenerated && <span style={{ fontSize: 10, background: THEME.tealSoft, color: THEME.tealDeep, padding: "2px 8px", borderRadius: 999 }}>⚙️ خودکار (BowTie)</span>}
              </div>
              <div style={{ fontSize: 12, color: THEME.text2, marginTop: 5 }}>{a.nonconformanceDescription.slice(0, 130)}{a.nonconformanceDescription.length > 130 ? "…" : ""}</div>
              <div style={{ fontSize: 10.5, color: THEME.text3, marginTop: 5 }}>
                {a.responsibleContractorName && <>پیمانکار: {a.responsibleContractorName} · </>}
                {a.responsiblePerson && <>مسئول: {a.responsiblePerson} · </>}
                {a.dueDate && <>مهلت: {toJalaliSafe(a.dueDate)} · </>}
                {a.createdAt && <>ایجاد: {toJalaliSafe(a.createdAt)}</>}
              </div>
              <div style={{ fontSize: 10.5, color: THEME.text3, marginTop: 3 }}>
                {a.completedAt && <>تاریخ انجام (پیمانکار): {toJalaliSafe(a.completedAt)} · </>}
                {a.approvedAt
                  ? <>تأیید کارفرما: {toJalaliSafe(a.approvedAt)}{a.approvedBy && ` (${a.approvedBy})`}</>
                  : <span style={{ color: "#b45309" }}>هنوز توسط کارفرما تأیید نشده</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, color, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? color : THEME.surface, color: active ? "#fff" : THEME.text, border: `1.5px solid ${active ? color : THEME.border}`,
        borderRadius: 10, padding: "10px 8px", textAlign: "center", cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.open;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, background: meta.bg, color: meta.color, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {meta.emoji} {meta.label}
    </span>
  );
}
