import React, { useState, useEffect } from "react";
import { Inbox, CheckCircle2, XCircle, UserCheck, Clock } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import {
  loadPendingGateItems, approveGateItem, rejectGateItem, assignGateItem, loadCompanyStaffOptions, GATE_STATUS_LABELS,
} from "../hseGateApi.js";

const MODULE_LABELS = {
  anomalyReport: "مدیریت عدم انطباق‌ها",
  personnelAccess: "مدیریت ورود و تردد پرسنل",
  machineryManagement: "مدیریت ماشین‌آلات",
  riskAssessment: "مدیریت ارزیابی ریسک",
  scaffoldManagement: "مدیریت داربست",
};

/**
 * صندوق ورودی سرپرست/مدیر HSE — طبق طرح تأییدشده. دو جهت کاملاً متفاوت:
 *   employer_to_contractor: کارشناس کارفرما یک مورد ثبت کرده و منتظر
 *     تأیید سرپرست/مدیر HSE است تا سمت پیمانکار آزاد شود (تأیید/رد).
 *   contractor_to_employer: پیمانکار یک مورد گزارش کرده و سرپرست/مدیر
 *     HSE باید آن را به یک کارشناس مشخص کارفرما واگذار کند.
 */
export default function HseGateInbox({ currentUser, onBack }) {
  const [items, setItems] = useState(null);
  const [staff, setStaff] = useState([]);
  const [tab, setTab] = useState("employer_to_contractor");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [assignTo, setAssignTo] = useState("");
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [pending, staffOptions] = await Promise.all([loadPendingGateItems(), loadCompanyStaffOptions()]);
    setItems(pending);
    setStaff(staffOptions);
  };
  useEffect(() => { load(); }, []);

  if (items === null) return <p style={{ color: THEME.text3, textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>;

  const filtered = items.filter((it) => it.direction === tab);

  const handleApprove = async (id) => {
    setBusy(id); setMessage("");
    const result = await approveGateItem(id, currentUser?.name);
    setBusy(null);
    if (result?.__error) { setMessage(result.message); return; }
    await load();
  };

  const openReject = (id) => { setRejectingId(id); setRejectNote(""); setMessage(""); };
  const confirmReject = async () => {
    setBusy(rejectingId);
    const result = await rejectGateItem(rejectingId, currentUser?.name, rejectNote);
    setBusy(null);
    if (result?.__error) { setMessage(result.message); return; }
    setRejectingId(null);
    await load();
  };

  const openAssign = (id) => { setAssigningId(id); setAssignTo(""); setMessage(""); };
  const confirmAssign = async () => {
    setBusy(assigningId);
    const result = await assignGateItem(assigningId, assignTo, currentUser?.name);
    setBusy(null);
    if (result?.__error) { setMessage(result.message); return; }
    setAssigningId(null);
    await load();
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>بازگشت</div>}
      <h2 style={{ fontSize: 18, color: THEME.navy, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <Inbox size={20} color={THEME.teal} /> صندوق ورودی سرپرست/مدیر HSE
      </h2>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18, lineHeight: 1.9 }}>
        هیچ موردی بدون تأیید یا واگذاری شما به سمت مقابل نمی‌رود.
      </p>
      {message && <p style={styles.error}>{message}</p>}

      <div style={{ display: "flex", gap: 4, borderBottom: `1.5px solid ${THEME.border}`, marginBottom: 16 }}>
        <button
          type="button" onClick={() => setTab("employer_to_contractor")}
          style={{
            padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: THEME.font, fontSize: 12.5,
            color: tab === "employer_to_contractor" ? THEME.teal : THEME.text3, fontWeight: tab === "employer_to_contractor" ? 700 : 500,
            borderBottom: tab === "employer_to_contractor" ? `2.5px solid ${THEME.teal}` : "2.5px solid transparent",
          }}
        >
          در انتظار تأیید برای پیمانکار ({items.filter((it) => it.direction === "employer_to_contractor").length})
        </button>
        <button
          type="button" onClick={() => setTab("contractor_to_employer")}
          style={{
            padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: THEME.font, fontSize: 12.5,
            color: tab === "contractor_to_employer" ? THEME.teal : THEME.text3, fontWeight: tab === "contractor_to_employer" ? 700 : 500,
            borderBottom: tab === "contractor_to_employer" ? `2.5px solid ${THEME.teal}` : "2.5px solid transparent",
          }}
        >
          گزارش‌شده از پیمانکار — نیازمند واگذاری ({items.filter((it) => it.direction === "contractor_to_employer").length})
        </button>
      </div>

      {filtered.length === 0 && <p style={{ fontSize: 12.5, color: THEME.text3, textAlign: "center", padding: 30 }}>موردی در این بخش نیست.</p>}

      {filtered.map((it) => (
        <div key={it.id} style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: THEME.tealSoft, color: THEME.tealDeep, fontWeight: 700 }}>
                {MODULE_LABELS[it.moduleKey] || it.moduleKey}
              </span>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: THEME.navy, margin: "8px 0 3px" }}>{it.recordLabel || it.recordId}</p>
              <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> ارسال‌شده توسط {it.submittedBy} — {toJalaliSafe(it.createdAt)}
              </p>
            </div>
          </div>

          {tab === "employer_to_contractor" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => handleApprove(it.id)} disabled={busy === it.id}
                style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 5, background: "#166534" }}>
                <CheckCircle2 size={13} /> تأیید و ارسال به پیمانکار
              </button>
              <button type="button" onClick={() => openReject(it.id)} disabled={busy === it.id}
                style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 5, background: THEME.danger }}>
                <XCircle size={13} /> رد
              </button>
            </div>
          )}

          {tab === "contractor_to_employer" && (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => openAssign(it.id)} disabled={busy === it.id}
                style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 5 }}>
                <UserCheck size={13} /> واگذاری به کارشناس
              </button>
            </div>
          )}

          {rejectingId === it.id && (
            <div style={{ background: THEME.dangerBg, borderRadius: 9, padding: 12, marginTop: 10 }}>
              <label style={{ fontSize: 11.5, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>دلیل رد (الزامی)</label>
              <textarea style={{ ...styles.input, marginTop: 0, minHeight: 50 }} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} dir="rtl" />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" style={styles.smallButton} onClick={confirmReject} disabled={busy === it.id}>ثبت رد</button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setRejectingId(null)}>انصراف</button>
              </div>
            </div>
          )}

          {assigningId === it.id && (
            <div style={{ background: THEME.bg, borderRadius: 9, padding: 12, marginTop: 10 }}>
              <label style={{ fontSize: 11.5, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>واگذاری به</label>
              <select style={{ ...styles.input, marginTop: 0 }} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} dir="rtl">
                <option value="">انتخاب کارشناس</option>
                {staff.map((s) => <option key={s.username} value={s.username}>{s.name}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" style={styles.smallButton} onClick={confirmAssign} disabled={busy === it.id || !assignTo}>ثبت واگذاری</button>
                <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={() => setAssigningId(null)}>انصراف</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
