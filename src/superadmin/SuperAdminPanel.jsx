import React, { useState, useEffect } from "react";
import { ShieldAlert, Plus, LogOut, Send, CreditCard, AlertTriangle, UserPlus, KeyRound } from "lucide-react";
import { THEME } from "../shared.js";
import { toJalaliSafe, JalaliDateInput } from "../personnel/jalaliDate.jsx";
import {
  loadCompanies, createCompany, updateCompany, deleteCompany,
  loadCompanyPayments, addCompanyPayment, sendAnnouncement,
  createCompanyUserAccount, loadCompanyUserAccounts,
  SUBSCRIPTION_TYPES, SUBSCRIPTION_STATUSES, subscriptionStatusMeta,
} from "./superAdminApi.js";

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${THEME.border}`, fontSize: 12.5, fontFamily: THEME.font, boxSizing: "border-box" };
const btnStyle = (bg) => ({ padding: "7px 14px", borderRadius: 8, border: "none", background: bg || THEME.teal, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font });

export default function SuperAdminPanel({ currentAdmin, onLogout }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("trial");
  const [expandedId, setExpandedId] = useState(null);
  const [payments, setPayments] = useState({});
  const [announceTarget, setAnnounceTarget] = useState("all");
  const [announceText, setAnnounceText] = useState("");
  const [announceSending, setAnnounceSending] = useState(false);

  const load = async () => {
    setCompanies(await loadCompanies());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createCompany({ name: newName.trim(), subscriptionType: newType });
    if (!result?.__error) { setNewName(""); setShowCreate(false); await load(); }
  };

  const handleUpdate = async (id, patch) => {
    await updateCompany(id, patch);
    await load();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`شرکت «${name}» و تمام سوابقش حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    await deleteCompany(id);
    await load();
  };

  const toggleExpand = async (c) => {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    if (!payments[c.id]) setPayments((prev) => ({ ...prev, [c.id]: loadCompanyPayments(c.id) }));
  };

  const handleAddPayment = async (companyId, amount, planType) => {
    if (!amount) return;
    await addCompanyPayment(companyId, Number(amount), planType, "");
    setPayments((prev) => ({ ...prev, [companyId]: loadCompanyPayments(companyId) }));
  };

  const handleSendAnnouncement = async () => {
    if (!announceText.trim()) return;
    setAnnounceSending(true);
    await sendAnnouncement(announceTarget === "all" ? null : announceTarget, announceText.trim());
    setAnnounceSending(false);
    setAnnounceText("");
    alert("پیام ارسال شد.");
  };

  const summary = {
    total: companies.length,
    active: companies.filter((c) => c.subscriptionStatus === "active").length,
    expired: companies.filter((c) => c.subscriptionStatus === "expired").length,
    disabled: companies.filter((c) => c.subscriptionStatus === "disabled").length,
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ background: THEME.bg, minHeight: "100vh", fontFamily: THEME.font }}>
      <div style={{ background: THEME.navyDeep, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={18} />
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Super Admin — مالک سامانه</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{currentAdmin?.fullName}</span>
          <button type="button" onClick={onLogout} style={{ ...btnStyle("rgba(255,255,255,0.15)"), display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={13} /> خروج
          </button>
        </div>
      </div>

      <div style={{ padding: 18, maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, overflow: "hidden", marginBottom: 16 }}>
          <StatBox label="کل شرکت‌ها" value={summary.total} />
          <StatBox label="اشتراک فعال" value={summary.active} color="#166534" />
          <StatBox label="منقضی" value={summary.expired} color="#c92a2a" />
          <StatBox label="غیرفعال" value={summary.disabled} color="#5b6b7d" />
        </div>

        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#92400e" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.9 }}>
            <b>وضعیت فعلی:</b> ثبت شرکت و مدیریت اشتراک کاملاً واقعی و کاربردیه. اما «آمار مصرف هر شرکت» (تعداد پرسنل/آنومالی/فضای واقعی)، «تحلیل هوشمند»، و «مانیتورینگ سیستم» هنوز نمایش داده نمی‌شن —
            چون داده‌های سامانه هنوز بین شرکت‌ها جدا نشده (فاز ۲: افزودن company_id به همه‌ی جدول‌ها). تا اون مهاجرت انجام نشه، نمایش این اعداد یعنی یا خالی باشن یا ساختگی —
            که هیچ‌کدوم قابل‌اتکا نیست.
          </p>
        </div>

        <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: 0 }}>شرکت‌های مشتری</h3>
            <button type="button" onClick={() => setShowCreate((v) => !v)} style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={13} /> شرکت جدید
            </button>
          </div>

          {showCreate && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", background: THEME.bg, padding: 12, borderRadius: 8 }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="نام شرکت" value={newName} onChange={(e) => setNewName(e.target.value)} dir="rtl" />
              <select style={inputStyle} value={newType} onChange={(e) => setNewType(e.target.value)} dir="rtl">
                {SUBSCRIPTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button type="button" onClick={handleCreate} style={btnStyle()}>ثبت</button>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>نام شرکت</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>تاریخ ثبت‌نام</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>نوع اشتراک</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>وضعیت</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>پایان اشتراک</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>آخرین ورود</th>
                  <th style={{ padding: "6px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const sm = subscriptionStatusMeta(c.subscriptionStatus);
                  return (
                    <React.Fragment key={c.id}>
                      <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{toJalaliSafe(c.registeredAt) || "—"}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{SUBSCRIPTION_TYPES.find((t) => t.value === c.subscriptionType)?.label}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: sm.bg, color: sm.color, fontWeight: 600 }}>{sm.label}</span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{toJalaliSafe(c.subscriptionEndDate) || "—"}</td>
                        <td style={{ padding: "8px", textAlign: "center", color: THEME.text3 }}>{c.lastLoginAt ? toJalaliSafe(c.lastLoginAt) : "هنوز وارد نشده"}</td>
                        <td style={{ padding: "8px", textAlign: "left" }}>
                          <button type="button" onClick={() => toggleExpand(c)} style={{ ...btnStyle(THEME.navyMid), fontSize: 11 }}>
                            {expandedId === c.id ? "بستن" : "مدیریت"}
                          </button>
                        </td>
                      </tr>
                      {expandedId === c.id && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <CompanyManagePanel
                              company={c}
                              onUpdate={(patch) => handleUpdate(c.id, patch)}
                              onDelete={() => handleDelete(c.id, c.name)}
                              paymentsPromise={payments[c.id]}
                              onAddPayment={(amount, planType) => handleAddPayment(c.id, amount, planType)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {companies.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>هنوز شرکتی ثبت نشده است</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: 16 }}>
          <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
            <Send size={14} color={THEME.teal} /> ارسال پیام سیستمی
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select style={{ ...inputStyle, width: 180 }} value={announceTarget} onChange={(e) => setAnnounceTarget(e.target.value)} dir="rtl">
              <option value="all">همه‌ی شرکت‌ها</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input style={{ ...inputStyle, flex: 1, minWidth: 200 }} placeholder="متن پیام..." value={announceText} onChange={(e) => setAnnounceText(e.target.value)} dir="rtl" />
            <button type="button" onClick={handleSendAnnouncement} disabled={announceSending} style={btnStyle()}>
              {announceSending ? "در حال ارسال..." : "ارسال"}
            </button>
          </div>
          <p style={{ fontSize: 10.5, color: THEME.text3, marginTop: 8, marginBottom: 0 }}>
            پیام در جدول ثبت می‌شود؛ نمایش آن داخل پنل شرکت‌های مشتری بخشی از فاز ۲ است (نیاز به مسیر نمایش اعلان سیستمی در پنل هر شرکت).
          </p>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex: "1 1 140px", padding: "12px 16px", borderInlineEnd: `1px solid ${THEME.border}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || THEME.navy }}>{value}</div>
      <div style={{ fontSize: 11, color: THEME.text3, marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function CompanyManagePanel({ company, onUpdate, onDelete, paymentsPromise, onAddPayment }) {
  const [status, setStatus] = useState(company.subscriptionStatus);
  const [type, setType] = useState(company.subscriptionType);
  const [endDate, setEndDate] = useState(company.subscriptionEndDate);
  const [quota, setQuota] = useState(company.storageQuotaMb);
  const [paymentsList, setPaymentsList] = useState([]);
  const [payAmount, setPayAmount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [newAccName, setNewAccName] = useState("");
  const [newAccUsername, setNewAccUsername] = useState("");
  const [newAccPassword, setNewAccPassword] = useState("");
  const [newAccRole, setNewAccRole] = useState("admin");
  const [accError, setAccError] = useState("");
  const [accSaving, setAccSaving] = useState(false);

  const loadAccounts = () => loadCompanyUserAccounts(company.id).then(setAccounts);
  useEffect(() => { loadAccounts(); }, [company.id]);

  useEffect(() => {
    if (paymentsPromise) paymentsPromise.then(setPaymentsList);
  }, [paymentsPromise]);

  const handleCreateAccount = async () => {
    if (!newAccName.trim() || !newAccUsername.trim() || !newAccPassword) {
      setAccError("نام، نام کاربری و رمز عبور الزامی است");
      return;
    }
    setAccSaving(true);
    setAccError("");
    const result = await createCompanyUserAccount(company.id, { name: newAccName, username: newAccUsername, password: newAccPassword, role: newAccRole });
    setAccSaving(false);
    if (result?.__error) { setAccError(result.message); return; }
    setNewAccName(""); setNewAccUsername(""); setNewAccPassword("");
    await loadAccounts();
  };

  return (
    <div style={{ background: THEME.bg, padding: 16, borderTop: `2px solid ${THEME.teal}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>وضعیت اشتراک</label>
          <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)} dir="rtl">
            {SUBSCRIPTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>نوع پلن</label>
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)} dir="rtl">
            {SUBSCRIPTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>تاریخ پایان اشتراک</label>
          <JalaliDateInput value={endDate} onChange={setEndDate} allowEmpty />
        </div>
        <div>
          <label style={{ fontSize: 11, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>سقف فضا (مگابایت)</label>
          <input type="number" style={inputStyle} value={quota} onChange={(e) => setQuota(e.target.value)} dir="ltr" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" style={btnStyle()} onClick={() => onUpdate({ subscriptionStatus: status, subscriptionType: type, subscriptionEndDate: endDate, storageQuotaMb: Number(quota) })}>
          ذخیره‌ی تغییرات
        </button>
        <button type="button" style={btnStyle(THEME.danger)} onClick={onDelete}>حذف شرکت</button>
      </div>

      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 12, marginBottom: 16 }}>
        <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <UserPlus size={13} /> حساب‌های کاربری این شرکت
        </h4>
        {accounts.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>هنوز هیچ حساب کاربری برای این شرکت ساخته نشده — بدون حساب، هیچ‌کس نمی‌تواند وارد سایت اصلی شود.</p>}
        {accounts.map((a) => (
          <div key={a.id} style={{ fontSize: 11.5, color: THEME.text2, padding: "4px 0", borderBottom: `1px solid ${THEME.border}`, display: "flex", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.name}</span>
            <span style={{ direction: "ltr" }}>({a.username})</span>
            <span style={{ marginInlineStart: "auto", fontSize: 10, color: THEME.text3 }}>{a.role === "admin" ? "ادمین" : "کارفرما"}</span>
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 10 }}>
          <input style={inputStyle} placeholder="نام و نام خانوادگی" value={newAccName} onChange={(e) => setNewAccName(e.target.value)} dir="rtl" />
          <input style={{ ...inputStyle, direction: "ltr" }} placeholder="نام کاربری" value={newAccUsername} onChange={(e) => setNewAccUsername(e.target.value)} />
          <input style={{ ...inputStyle, direction: "ltr" }} placeholder="رمز عبور" value={newAccPassword} onChange={(e) => setNewAccPassword(e.target.value)} />
          <select style={inputStyle} value={newAccRole} onChange={(e) => setNewAccRole(e.target.value)} dir="rtl">
            <option value="admin">ادمین</option>
            <option value="employer">کارفرما</option>
          </select>
        </div>
        {accError && <p style={{ color: THEME.danger, fontSize: 11.5, marginTop: 6 }}>{accError}</p>}
        <button type="button" style={{ ...btnStyle(), marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleCreateAccount} disabled={accSaving}>
          <KeyRound size={13} /> {accSaving ? "در حال ثبت..." : "ایجاد حساب"}
        </button>
      </div>

      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 12 }}>
        <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <CreditCard size={13} /> تاریخچه‌ی پرداخت
        </h4>
        {paymentsList.length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3 }}>پرداختی ثبت نشده است.</p>}
        {paymentsList.map((p) => (
          <div key={p.id} style={{ fontSize: 11.5, color: THEME.text2, padding: "4px 0", borderBottom: `1px solid ${THEME.border}` }}>
            {toJalaliSafe(p.payment_date)} — {p.amount?.toLocaleString("fa-IR")} تومان {p.plan_type && `(${p.plan_type})`}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input type="number" style={{ ...inputStyle, width: 140 }} placeholder="مبلغ (تومان)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} dir="ltr" />
          <button type="button" style={btnStyle()} onClick={() => { onAddPayment(payAmount, type); setPayAmount(""); }}>ثبت پرداخت</button>
        </div>
      </div>
    </div>
  );
}
