import React, { useState, useEffect } from "react";
import { UserPlus, KeyRound, Power, Pencil, Users, Trash2 } from "lucide-react";
import { THEME } from "../shared.js";
import {
  loadCompanies, loadAccountsByType, createAccount, updateAccount, setAccountActive, resetAccountPassword, deleteAccount,
  loadJobPositionsForCompany,
} from "./superAdminApi.js";

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${THEME.border}`, fontSize: 12.5, fontFamily: THEME.font, boxSizing: "border-box" };
const btnStyle = (bg) => ({ padding: "7px 14px", borderRadius: 8, border: "none", background: bg || THEME.teal, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font });

const TABS = [
  { key: "admin", label: "Admin Accounts" },
  { key: "hse_supervisor", label: "حساب‌های سرپرست/مدیر HSE" },
  { key: "employer", label: "Employer Accounts" },
  { key: "contractor", label: "Contractor Accounts" },
];

// دقیقاً همان الگوی اعتبارسنجی فرم‌های دیگر پروژه (PersonnelForm) — موبایل
// ایرانی ۱۱ رقمی با ۰۹ شروع می‌شود
function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidMobileFormat(phone) {
  return /^09\d{9}$/.test(phone);
}

function emptyForm() {
  return { name: "", username: "", password: "", companyId: "", jobPositionId: "", contactPersonName: "", startDate: "", contractDetails: "", phone: "", email: "" };
}

export default function AccountManagement({ currentAdmin }) {
  const [tab, setTab] = useState("admin");
  const [companies, setCompanies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [comp, accs] = await Promise.all([loadCompanies(), loadAccountsByType(tab)]);
    setCompanies(comp);
    setAccounts(accs);
    setLoading(false);
  };
  useEffect(() => { load(); setShowCreate(false); setEditingId(null); setForm(emptyForm()); setError(""); }, [tab]);

  const companyName = (id) => companies.find((c) => c.id === id)?.name || "—";

  const validateContactFields = () => {
    if (form.email && !isValidEmailFormat(form.email)) return "فرمت ایمیل نامعتبر است";
    if (form.phone && !isValidMobileFormat(form.phone)) return "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود";
    return "";
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.username.trim() || form.password.length < 8) {
      setError("نام، نام‌کاربری الزامی است و رمز عبور باید حداقل ۸ کاراکتر باشد");
      return;
    }
    const contactError = validateContactFields();
    if (contactError) { setError(contactError); return; }
    setSaving(true);
    setError("");
    const result = await createAccount(tab, form);
    setSaving(false);
    if (result?.__error || result?.error) { setError(result.message || result.error); return; }
    setShowCreate(false);
    setForm(emptyForm());
    await load();
  };

  const openEdit = (a) => {
    setEditingId(editingId === a.id ? null : a.id);
    setForm({
      name: a.name, username: a.username, password: "", companyId: a.company_id || "", jobPositionId: a.job_position_id || "",
      contactPersonName: a.contact_person_name || "", startDate: a.start_date || "", contractDetails: a.contract_details || "",
      phone: a.phone || "", email: a.email || "",
    });
    setError("");
  };

  const handleSaveEdit = async (id) => {
    const contactError = validateContactFields();
    if (contactError) { setError(contactError); return; }
    setSaving(true);
    setError("");
    const result = await updateAccount(tab, id, form);
    setSaving(false);
    if (result?.__error || result?.error) { setError(result.message || result.error); return; }
    setEditingId(null);
    await load();
  };

  const handleToggleActive = async (a) => {
    const result = await setAccountActive(tab, a.id, a.is_active === false);
    if (result?.__error || result?.error) { alert(result.message || result.error); return; }
    await load();
  };

  const handleResetPassword = async (id) => {
    if (newPassword.length < 8) { setError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد"); return; }
    setSaving(true);
    setError("");
    const result = await resetAccountPassword(tab, id, newPassword);
    setSaving(false);
    if (result?.__error || result?.error) { setError(result.message || result.error); return; }
    setResettingId(null);
    setNewPassword("");
    alert("رمز عبور با موفقیت بازنشانی شد");
  };

  const handleDeleteAccount = async (a) => {
    if (!confirm(`حساب «${a.name}» (${a.username}) برای همیشه حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    const result = await deleteAccount(tab, a.id);
    if (result?.__error || result?.error) { alert(result.message || result.error); return; }
    await load();
  };

  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
        <Users size={14} color={THEME.teal} /> Account Management
      </h3>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: `1px solid ${THEME.border}`, paddingBottom: 10 }}>
        {TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ ...btnStyle(tab === t.key ? THEME.navyDeep : THEME.navyMid), opacity: tab === t.key ? 1 : 0.75 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => { setShowCreate((v) => !v); setForm(emptyForm()); setError(""); }} style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <UserPlus size={13} /> حساب جدید
      </button>

      {tab === "contractor" && (
        <p style={{ fontSize: 10.5, color: THEME.text3, marginBottom: 10, lineHeight: 1.8 }}>
          هر حساب پیمانکار به دو چیز مشخص وصل است: «شرکت پیمانکار» (خودِ شرکتی که این حساب متعلق به آن است) و «شرکت کارفرما» (کدام مستأجر سامانه این پیمانکار زیرِ آن کار می‌کند). حساب ایجادشده اینجا خودکار در لیست حساب‌های همان شرکت کارفرما هم قابل‌مشاهده است.
        </p>
      )}

      {showCreate && (
        <AccountForm tab={tab} form={form} setForm={setForm} companies={companies} onSave={handleCreate} saving={saving} saveLabel="ایجاد حساب" showPassword />
      )}
      {error && <p style={{ color: THEME.danger, fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {loading ? (
        <p style={{ color: THEME.text3, fontSize: 12, textAlign: "center", padding: 20 }}>در حال بارگذاری...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                {tab === "contractor" ? (
                  <>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>نام و نام خانوادگی</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>نام پیمانکار</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>شرکت کارفرما</th>
                  </>
                ) : (
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>نام و نام خانوادگی</th>
                )}
                <th style={{ textAlign: "center", padding: "6px 8px" }}>نام‌کاربری</th>
                {tab !== "contractor" && <th style={{ textAlign: "center", padding: "6px 8px" }}>شرکت</th>}
                <th style={{ textAlign: "center", padding: "6px 8px" }}>وضعیت</th>
                <th style={{ padding: "6px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <React.Fragment key={a.id}>
                  <tr style={{ borderBottom: `1px solid ${THEME.border}`, opacity: a.is_active === false ? 0.5 : 1 }}>
                    {tab === "contractor" ? (
                      <>
                        <td style={{ padding: "8px" }}>{a.contact_person_name || "—"}</td>
                        <td style={{ padding: "8px", textAlign: "center", fontWeight: 600 }}>{a.name}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{companyName(a.company_id)}</td>
                      </>
                    ) : (
                      <td style={{ padding: "8px", fontWeight: 600 }}>{a.name}</td>
                    )}
                    <td style={{ padding: "8px", textAlign: "center", direction: "ltr" }}>{a.username}</td>
                    {tab !== "contractor" && <td style={{ padding: "8px", textAlign: "center" }}>{companyName(a.company_id)}</td>}
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: a.is_active === false ? "#eef1f5" : "#dcfce7", color: a.is_active === false ? "#5b6b7d" : "#166534", fontWeight: 600 }}>
                        {a.is_active === false ? "غیرفعال" : "فعال"}
                      </span>
                    </td>
                    <td style={{ padding: "8px", textAlign: "left", whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => openEdit(a)} style={{ ...btnStyle(THEME.navyMid), fontSize: 11, marginInlineEnd: 4 }} title="ویرایش">
                        <Pencil size={11} />
                      </button>
                      <button type="button" onClick={() => { setResettingId(resettingId === a.id ? null : a.id); setNewPassword(""); setError(""); }} style={{ ...btnStyle("#b45309"), fontSize: 11, marginInlineEnd: 4 }} title="Reset Password">
                        <KeyRound size={11} />
                      </button>
                      <button type="button" onClick={() => handleToggleActive(a)} style={{ ...btnStyle(a.is_active === false ? "#166534" : THEME.danger), fontSize: 11, marginInlineEnd: 4 }} title={a.is_active === false ? "فعال‌سازی" : "غیرفعال‌سازی"}>
                        <Power size={11} />
                      </button>
                      <button type="button" onClick={() => handleDeleteAccount(a)} style={{ ...btnStyle(THEME.danger), fontSize: 11 }} title="حذف حساب">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                  {editingId === a.id && (
                    <tr><td colSpan={tab === "contractor" ? 6 : 5} style={{ padding: 0 }}>
                      <AccountForm tab={tab} form={form} setForm={setForm} companies={companies} onSave={() => handleSaveEdit(a.id)} saving={saving} saveLabel="ذخیره‌ی تغییرات" showPassword={false} />
                    </td></tr>
                  )}
                  {resettingId === a.id && (
                    <tr><td colSpan={tab === "contractor" ? 6 : 5} style={{ padding: "10px 8px", background: THEME.bg }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input type="password" style={{ ...inputStyle, width: 220 }} placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="ltr" />
                        <button type="button" onClick={() => handleResetPassword(a.id)} style={btnStyle()} disabled={saving}>{saving ? "..." : "بازنشانی رمز"}</button>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={tab === "contractor" ? 6 : 5} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>حسابی یافت نشد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AccountForm({ tab, form, setForm, companies, onSave, saving, saveLabel, showPassword }) {
  const isContractor = tab === "contractor";
  const [jobPositions, setJobPositions] = useState([]);

  useEffect(() => {
    if (form.companyId) {
      loadJobPositionsForCompany(form.companyId).then(setJobPositions);
    } else {
      setJobPositions([]);
    }
  }, [form.companyId]);

  return (
    <div style={{ background: THEME.bg, padding: 14, borderRadius: 8, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>{isContractor ? "نام شرکت پیمانکار" : "نام و نام خانوادگی"}</label>
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="rtl" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>نام‌کاربری</label>
          <input style={inputStyle} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" disabled={!showPassword} />
        </div>
        {showPassword && (
          <div>
            <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>رمز عبور (حداقل ۸ کاراکتر)</label>
            <input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" />
          </div>
        )}
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>{isContractor ? "شرکت کارفرما (این پیمانکار تحت کدام کارفرما کار می‌کند)" : "شرکت"}</label>
          <select style={inputStyle} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value, jobPositionId: "" })} dir="rtl">
            <option value="">— انتخاب کنید —</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>شغل کاربر</label>
          <select style={inputStyle} value={form.jobPositionId} onChange={(e) => setForm({ ...form, jobPositionId: e.target.value })} dir="rtl" disabled={!form.companyId}>
            <option value="">{form.companyId ? "— انتخاب کنید —" : "اول شرکت را انتخاب کنید"}</option>
            {jobPositions.map((jp) => <option key={jp.id} value={jp.id}>{jp.title}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>تلفن (۱۱ رقمی، با ۰۹)</label>
          <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="09xxxxxxxxx" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>ایمیل</label>
          <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" placeholder="name@example.com" />
        </div>
        {isContractor && (
          <>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>نام و نام خانوادگی</label>
              <input style={inputStyle} value={form.contactPersonName} onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>جزئیات قرارداد</label>
              <input style={inputStyle} value={form.contractDetails} onChange={(e) => setForm({ ...form, contractDetails: e.target.value })} dir="rtl" />
            </div>
          </>
        )}
      </div>
      <button type="button" onClick={onSave} disabled={saving} style={btnStyle()}>{saving ? "در حال ذخیره..." : saveLabel}</button>
    </div>
  );
}
