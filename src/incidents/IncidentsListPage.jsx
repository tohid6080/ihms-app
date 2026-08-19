import React, { useState, useEffect } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe, JalaliDateInput } from "../personnel/jalaliDate.jsx";
import { INCIDENT_TYPES, loadIncidents, createIncident, deleteIncident } from "./incidentsApi.js";
import IncidentDetailPage from "./IncidentDetailPage.jsx";

const inputStyle = styles.input;

function emptyForm() {
  return {
    incidentNo: "", occurredAt: "", location: "", incidentType: "fatality", isDisabling: false,
    injuredPersonName: "", lostDays: "", financialCost: "", description: "", employerOrg: "", contractorOrg: "",
  };
}

export default function IncidentsListPage({ currentUser, role, readOnly }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    setLoading(true);
    setList(await loadIncidents());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (selectedId) {
    return <IncidentDetailPage incidentId={selectedId} currentUser={currentUser} role={role} readOnly={readOnly} onBack={() => { setSelectedId(null); load(); }} />;
  }

  const handleCreate = async () => {
    setError("");
    if (!form.incidentNo.trim() || !form.occurredAt) {
      setError("شماره حادثه و تاریخ وقوع الزامی است");
      return;
    }
    setSaving(true);
    const result = await createIncident(form, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setForm(emptyForm());
    setShowForm(false);
    await load();
  };

  const handleDelete = async (id, incidentNo) => {
    if (!confirm(`حادثه‌ی «${incidentNo}» حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    const result = await deleteIncident(id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 18, color: THEME.navy, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={20} color={THEME.teal} /> مدیریت حوادث
        </h2>
        {!readOnly && (
          <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={() => { setShowForm((v) => !v); setError(""); }}>
            <Plus size={14} /> ثبت حادثه جدید
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={styles.label}>شماره حادثه</label>
              <input style={inputStyle} value={form.incidentNo} onChange={(e) => setForm({ ...form, incidentNo: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>تاریخ وقوع</label>
              <JalaliDateInput value={form.occurredAt} onChange={(v) => setForm({ ...form, occurredAt: v })} />
            </div>
            <div>
              <label style={styles.label}>محل وقوع</label>
              <input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>نوع حادثه</label>
              <select style={inputStyle} value={form.incidentType} onChange={(e) => setForm({ ...form, incidentType: e.target.value })} dir="rtl">
                {INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>نام مصدوم (در صورت وجود)</label>
              <input style={inputStyle} value={form.injuredPersonName} onChange={(e) => setForm({ ...form, injuredPersonName: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>روزهای از‌کارافتادگی</label>
              <input type="number" style={inputStyle} value={form.lostDays} onChange={(e) => setForm({ ...form, lostDays: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label style={styles.label}>هزینه مالی (اختیاری)</label>
              <input type="number" style={inputStyle} value={form.financialCost} onChange={(e) => setForm({ ...form, financialCost: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label style={styles.label}>شرکت کارفرما</label>
              <input style={inputStyle} value={form.employerOrg} onChange={(e) => setForm({ ...form, employerOrg: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>شرکت پیمانکار</label>
              <input style={inputStyle} value={form.contractorOrg} onChange={(e) => setForm({ ...form, contractorOrg: e.target.value })} dir="rtl" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
              <input type="checkbox" id="isDisabling" checked={form.isDisabling} onChange={(e) => setForm({ ...form, isDisabling: e.target.checked })} />
              <label htmlFor="isDisabling" style={{ fontSize: 13, color: THEME.text2, cursor: "pointer" }}>حادثه ناتوان‌کننده است</label>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={styles.label}>شرح حادثه</label>
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} dir="rtl" />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type="button" style={{ ...styles.smallButton, marginTop: 12 }} onClick={handleCreate} disabled={saving}>
            {saving ? "در حال ثبت..." : "ثبت حادثه"}
          </button>
        </div>
      )}

      {loading && <p style={{ color: THEME.text3, textAlign: "center", padding: 30 }}>در حال بارگذاری...</p>}
      {!loading && list.length === 0 && <p style={{ color: THEME.text3, textAlign: "center", padding: 30 }}>هنوز هیچ حادثه‌ای ثبت نشده است.</p>}

      {!loading && list.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: THEME.surface, borderRadius: 10, overflow: "hidden" }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                <th style={{ textAlign: "right", padding: "10px" }}>شماره</th>
                <th style={{ textAlign: "center", padding: "10px" }}>تاریخ</th>
                <th style={{ textAlign: "center", padding: "10px" }}>نوع</th>
                <th style={{ textAlign: "center", padding: "10px" }}>ناتوان‌کننده</th>
                <th style={{ textAlign: "center", padding: "10px" }}>محل</th>
                <th style={{ padding: "10px" }} />
              </tr>
            </thead>
            <tbody>
              {list.map((inc) => (
                <tr key={inc.id} style={{ borderBottom: `1px solid ${THEME.border}`, cursor: "pointer" }} onClick={() => setSelectedId(inc.id)}>
                  <td style={{ padding: "10px", fontWeight: 700, color: THEME.navy }}>{inc.incidentNo}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{toJalaliSafe(inc.occurredAt)}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{INCIDENT_TYPES.find((t) => t.value === inc.incidentType)?.label || inc.incidentType}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>
                    {inc.isDisabling && <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>بله</span>}
                  </td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{inc.location || "—"}</td>
                  <td style={{ padding: "10px", textAlign: "left" }}>
                    {!readOnly && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(inc.id, inc.incidentNo); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Trash2 size={14} color={THEME.danger} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
