import React, { useState, useEffect } from "react";
import { GitBranch, Target as TargetIcon, History as HistoryIcon, Send, Play, CheckCircle2, XCircle, RotateCcw, Trash2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { loadReferenceGroups, loadTargetCategories, flattenChecklist } from "./tripodReferenceApi.js";
import {
  loadAnalysisById, transitionAnalysis, loadHistory, updateAnalysisFields,
  loadTargets, addTarget, deleteTarget,
  loadBranchesWithDetails, updateBranch, addBranchPrecondition, deleteBranchPrecondition, addBranchHiddenFailure, deleteBranchHiddenFailure,
  loadRootCauseSummary, loadTripodCorrectiveActions, createTripodCorrectiveAction, updateTripodCorrectiveActionStatus,
  TRIPOD_STATUS_LABELS, CA_STATUS_LABELS, EDITABLE_STATUSES,
} from "./tripodAnalysesApi.js";
import TogglePicker from "./ChecklistPicker.jsx";
import TripodTree from "./TripodTree.jsx";
import BarrierMappingPicker from "../bowtie/BarrierMappingPicker.jsx";

const TABS = [
  { key: "summary", label: "خلاصه" },
  { key: "build", label: "مسیرها و اشکالات پنهان" },
  { key: "tree", label: "درخت" },
  { key: "rootcause", label: "علل ریشه‌ای و اقدام اصلاحی" },
  { key: "history", label: "تاریخچه" },
];

export default function TripodAnalysisWorkspace({ analysisId, incident, currentUser, role, onBack }) {
  const [analysis, setAnalysis] = useState(undefined);
  const [refGroups, setRefGroups] = useState([]);
  const [targetCats, setTargetCats] = useState([]);
  const [targets, setTargets] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rootCause, setRootCause] = useState(null);
  const [correctiveActions, setCorrectiveActions] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("summary");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [a, t, br, rc, ca, hist] = await Promise.all([
      loadAnalysisById(analysisId), loadTargets(analysisId), loadBranchesWithDetails(analysisId),
      loadRootCauseSummary(analysisId), loadTripodCorrectiveActions(analysisId), loadHistory(analysisId),
    ]);
    setAnalysis(a); setTargets(t); setBranches(br); setRootCause(rc); setCorrectiveActions(ca); setHistory(hist);
  };

  useEffect(() => {
    loadReferenceGroups().then(setRefGroups);
    loadTargetCategories().then(setTargetCats);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  if (analysis === undefined) return <p style={{ color: THEME.text3, textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>;
  if (!analysis) return <p style={{ color: THEME.danger, textAlign: "center", padding: 40 }}>تحلیل یافت نشد.</p>;

  const editable = EDITABLE_STATUSES.has(analysis.status);

  const doAction = async (action, reason) => {
    setError(""); setBusy(true);
    const result = await transitionAnalysis(analysisId, action, role, currentUser?.name, reason);
    setBusy(false);
    if (result?.__error) { setError(result.message); return; }
    await refresh();
  };

  return (
    <div>
      <div style={styles.backLink} onClick={onBack}>بازگشت</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 17, color: THEME.navy, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <GitBranch size={19} color={THEME.teal} /> تحلیل Tripod Beta — حادثه {incident?.incidentNo}
          </h2>
          <p style={{ color: THEME.text3, fontSize: 12, margin: "4px 0 0" }}>
            وضعیت فعلی: <b style={{ color: THEME.navy }}>{TRIPOD_STATUS_LABELS[analysis.status] || analysis.status}</b>
            {analysis.isLocked && " — قفل‌شده"}
          </p>
        </div>
        <WorkflowActions analysis={analysis} role={role} busy={busy} onAction={doAction} />
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {analysis.rejectionReason && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 12.5, color: "#991b1b", margin: 0 }}>علت رد آخرین بازبینی: {analysis.rejectionReason}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, borderBottom: `1.5px solid ${THEME.border}`, marginBottom: 18, overflowX: "auto" }}>
        {TABS.map((tb) => (
          <button
            key={tb.key} type="button" onClick={() => setTab(tb.key)}
            style={{
              padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: THEME.font, fontSize: 12.5, whiteSpace: "nowrap",
              color: tab === tb.key ? THEME.teal : THEME.text3, fontWeight: tab === tb.key ? 700 : 500,
              borderBottom: tab === tb.key ? `2.5px solid ${THEME.teal}` : "2.5px solid transparent",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <SummaryTab analysis={analysis} editable={editable} targets={targets} targetCats={targetCats} onUpdateFields={async (f) => { await updateAnalysisFields(analysisId, f); await refresh(); }}
          onAddTarget={async (code, desc) => { await addTarget(analysisId, code, desc); await refresh(); }}
          onDeleteTarget={async (id) => { await deleteTarget(id); await refresh(); }} />
      )}
      {tab === "build" && (
        <BuildTab branches={branches} refGroups={refGroups} editable={editable} onRefresh={refresh} />
      )}
      {tab === "tree" && <TripodTree eventDescription={analysis.eventDescription} branches={branches} />}
      {tab === "rootcause" && (
        <RootCauseTab analysisId={analysisId} incident={incident} rootCause={rootCause} correctiveActions={correctiveActions} currentUser={currentUser}
          onRefresh={refresh} />
        <div>
          <RootCauseTab analysisId={analysisId} incident={incident} rootCause={rootCause} correctiveActions={correctiveActions} currentUser={currentUser}
            onRefresh={refresh} />
          <BarrierMappingPicker sourceType="tripod_rca" sourceId={analysisId} currentUser={currentUser} readOnly={role === "CONTRACTOR"} />
        </div>
      )}
      {tab === "history" && <HistoryTab history={history} />}
    </div>
  );
}

// ---------- اکشن‌های گردش‌کار ----------

function WorkflowActions({ analysis, role, busy, onAction }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const s = analysis.status;
  const buttons = [];

  if ((s === "NOT_REQUIRED" || s === "CANDIDATE") && (role === "EMPLOYER" || role === "ADMIN")) buttons.push({ label: "درخواست تحلیل", icon: Send, action: "request" });
  if (s === "REQUESTED" && role === "CONTRACTOR") buttons.push({ label: "شروع تحلیل", icon: Play, action: "start" });
  if (s === "IN_PROGRESS" && role === "CONTRACTOR") buttons.push({ label: "ارسال به کارفرما", icon: Send, action: "submit" });
  if (s === "EMPLOYER_REVIEW" && (role === "EMPLOYER" || role === "ADMIN")) {
    buttons.push({ label: "تأیید نهایی", icon: CheckCircle2, action: "approve" });
  }
  if (s === "REJECTED" && role === "CONTRACTOR") buttons.push({ label: "شروع بازبینی مجدد", icon: RotateCcw, action: "revise" });

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {buttons.map((b) => (
        <button key={b.action} type="button" disabled={busy} onClick={() => onAction(b.action)} style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 5, background: THEME.teal }}>
          <b.icon size={13} /> {b.label}
        </button>
      ))}
      {s === "EMPLOYER_REVIEW" && (role === "EMPLOYER" || role === "ADMIN") && !showReject && (
        <button type="button" disabled={busy} onClick={() => setShowReject(true)} style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 5, background: THEME.danger }}>
          <XCircle size={13} /> رد تحلیل
        </button>
      )}
      {showReject && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input style={{ ...styles.input, width: 200, marginTop: 0 }} placeholder="علت رد..." value={reason} onChange={(e) => setReason(e.target.value)} dir="rtl" />
          <button type="button" disabled={busy || !reason.trim()} onClick={async () => { await onAction("reject", reason); setShowReject(false); setReason(""); }} style={{ ...styles.smallButton, background: THEME.danger }}>ثبت رد</button>
          <button type="button" onClick={() => setShowReject(false)} style={{ ...styles.smallButton, background: THEME.text3 }}>انصراف</button>
        </div>
      )}
    </div>
  );
}

// ---------- تب خلاصه ----------

function SummaryTab({ analysis, editable, targets, targetCats, onUpdateFields, onAddTarget, onDeleteTarget }) {
  const [eventDesc, setEventDesc] = useState(analysis.eventDescription);
  const [hazardDesc, setHazardDesc] = useState(analysis.hazardDescription);
  const [newTargetCode, setNewTargetCode] = useState("");
  const [newTargetDesc, setNewTargetDesc] = useState("");

  useEffect(() => { setEventDesc(analysis.eventDescription); setHazardDesc(analysis.hazardDescription); }, [analysis.id]);

  return (
    <div>
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <label style={styles.label}>شرح رویداد (Event)</label>
        <textarea style={{ ...styles.input, minHeight: 60 }} value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} onBlur={() => editable && onUpdateFields({ event_description: eventDesc })} disabled={!editable} dir="rtl" />
        <label style={styles.label}>شرح خطر (Hazard)</label>
        <textarea style={{ ...styles.input, minHeight: 60 }} value={hazardDesc} onChange={(e) => setHazardDesc(e.target.value)} onBlur={() => editable && onUpdateFields({ hazard_description: hazardDesc })} disabled={!editable} dir="rtl" />
      </div>

      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18 }}>
        <h4 style={{ fontSize: 13.5, color: THEME.navy, fontWeight: 700, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <TargetIcon size={15} /> اهداف متأثر (Target)
        </h4>
        {targets.map((t) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${THEME.border}` }}>
            <span style={{ fontSize: 12.5 }}><b>{t.categoryTitle}</b>{t.description && ` — ${t.description}`}</span>
            {editable && <button type="button" onClick={() => onDeleteTarget(t.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={13} color={THEME.danger} /></button>}
          </div>
        ))}
        {editable && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <select style={{ ...styles.input, marginTop: 0, flex: 1, minWidth: 140 }} value={newTargetCode} onChange={(e) => setNewTargetCode(e.target.value)} dir="rtl">
              <option value="">— انتخاب دسته هدف —</option>
              {targetCats.map((c) => <option key={c.code} value={c.code}>{c.titleFa}</option>)}
            </select>
            <input style={{ ...styles.input, marginTop: 0, flex: 2, minWidth: 160 }} placeholder="توضیح (اختیاری)" value={newTargetDesc} onChange={(e) => setNewTargetDesc(e.target.value)} dir="rtl" />
            <button type="button" style={styles.smallButton} disabled={!newTargetCode} onClick={() => { onAddTarget(newTargetCode, newTargetDesc); setNewTargetCode(""); setNewTargetDesc(""); }}>افزودن</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- تب مسیرها ----------

function BuildTab({ branches, refGroups, editable, onRefresh }) {
  return (
    <div>
      {branches.map((b) => <PathCard key={b.id} path={b} refGroups={refGroups} editable={editable} onRefresh={onRefresh} />)}
    </div>
  );
}

function PathCard({ path, refGroups, editable, onRefresh }) {
  const [type, setType] = useState(path.surfaceFailureType || "unsafe_condition");
  const [text, setText] = useState(path.surfaceFailureText);
  const filled = !!path.surfaceFailureText;

  const handleSave = async () => {
    await updateBranch(path.id, { surfaceFailureType: type, surfaceFailureText: text });
    await onRefresh();
  };

  const precondItems = flattenChecklist(refGroups, "precondition");

  return (
    <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: THEME.navy }}>مسیر تحلیل {path.pathNo}</span>
        <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 999, background: filled ? "#dcfce7" : "#eef1f5", color: filled ? "#166534" : THEME.text3, fontWeight: 600 }}>{filled ? "تکمیل‌شده" : "خالی"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select style={{ ...styles.input, marginTop: 0, width: 140 }} value={type} onChange={(e) => setType(e.target.value)} disabled={!editable} dir="rtl">
          <option value="unsafe_condition">شرایط ناایمن</option>
          <option value="unsafe_act">اعمال ناایمن</option>
        </select>
        <input style={{ ...styles.input, marginTop: 0, flex: 1, minWidth: 200 }} placeholder="شرح اشکال سطحی این مسیر..." value={text} onChange={(e) => setText(e.target.value)} disabled={!editable} dir="rtl" />
        {editable && <button type="button" style={{ ...styles.smallButton, marginTop: 0 }} onClick={handleSave}>ذخیره</button>}
      </div>

      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 6 }}>پیش‌شرط‌ها و اشکالات پنهان این مسیر:</p>
        {(path.preconditions || []).length === 0 && <p style={{ fontSize: 12, color: THEME.text3, padding: "10px 0" }}>هنوز پیش‌شرطی برای این مسیر ثبت نشده.</p>}
        {path.preconditions.map((pc) => (
          <PreconditionItem key={pc.id} pc={pc} branchId={path.id} refGroups={refGroups} editable={editable} onRefresh={onRefresh} />
        ))}
        {editable && (
          <TogglePicker
            label="افزودن پیش‌شرط از چک‌لیست" items={precondItems} placeholder="جستجو در ۵۵ پیش‌شرط..."
            onSelect={async (item) => { await addBranchPrecondition(path.id, item.id); await onRefresh(); }}
          />
        )}
      </div>
    </div>
  );
}

function PreconditionItem({ pc, branchId, refGroups, editable, onRefresh }) {
  const group = refGroups.find((g) => g.groupNo === pc.groupNo);
  const scopedItems = group ? group.hiddenFailures.map((h) => ({ ...h, groupTitle: group.titleFa })) : [];

  return (
    <div style={{ background: THEME.bg, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 12 }}><b style={{ color: THEME.teal }}>{pc.code}</b> <span style={{ color: THEME.text3, fontSize: 10.5 }}>(گروه {pc.groupNo})</span></span>
        {editable && (
          <button type="button" onClick={async () => { if (!confirm("حذف این پیش‌شرط و همه‌ی اشکالات پنهان زیر آن؟")) return; await deleteBranchPrecondition(pc.id); await onRefresh(); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <Trash2 size={13} color={THEME.danger} />
          </button>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: THEME.text, lineHeight: 1.8, margin: "4px 0 8px" }}>{pc.text}</p>

      {(pc.hiddenFailures || []).length === 0 && <p style={{ fontSize: 11.5, color: THEME.text3, margin: "4px 0" }}>هنوز اشکال پنهانی برای این پیش‌شرط ثبت نشده.</p>}
      {pc.hiddenFailures.map((h) => (
        <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderTop: `1px solid ${THEME.border}` }}>
          <span style={{ fontSize: 11.5 }}><b style={{ color: "#b3261e" }}>{h.code} · {h.brfCode || "-"}</b> {h.text}</span>
          {editable && (
            <button type="button" onClick={async () => { await deleteBranchHiddenFailure(h.id); await onRefresh(); }} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
              <Trash2 size={12} color={THEME.danger} />
            </button>
          )}
        </div>
      ))}

      {editable && (
        <TogglePicker
          label={`افزودن اشکال پنهان (فقط گروه ${pc.groupNo})`} items={scopedItems} placeholder={`جستجو در اشکالات پنهان گروه ${pc.groupNo}...`}
          onSelect={async (item) => {
            const result = await addBranchHiddenFailure(branchId, pc.id, item.id, pc.groupNo, item.groupNo);
            if (result?.__error) { alert(result.message); return; }
            await onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ---------- تب علل ریشه‌ای ----------

function RootCauseTab({ analysisId, incident, rootCause, correctiveActions, currentUser, onRefresh }) {
  const [modalSrc, setModalSrc] = useState(null);

  if (!rootCause) return null;
  const tiers = [
    { key: "root_cause", label: "علل ریشه‌ای (۴ بار یا بیشتر تکرار)" },
    { key: "major_issue", label: "اشکالات مهم (۳ بار تکرار)" },
    { key: "hidden_issue", label: "اشکالات پنهان (۲ بار تکرار)" },
  ];

  return (
    <div>
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 13.5, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>خروجی ۱ — مجموع تکرار هر دسته اصلی (BRF)</h4>
        <SimpleTable
          headers={["کد", "نام دسته", "تعداد تکرار", ""]}
          rows={rootCause.byBrfCategory.map((item) => [
            item.brfCode || "-", item.brfNameFa || item.brfNameEn || "-", item.occurrences,
            <button key="btn" type="button" style={{ ...styles.smallButton, fontSize: 11 }} onClick={() => setModalSrc({ sourceType: "brf_category", brfCode: item.brfCode, titleFa: item.brfNameFa || item.brfNameEn, repeatCount: item.occurrences })}>صدور اقدام اصلاحی</button>,
          ])}
          emptyText="هنوز اشکال پنهانی ثبت نشده."
        />
      </div>

      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 13.5, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>خروجی ۲ — کدهای تکرارشده اشکال پنهان</h4>
        {tiers.map((tier) => {
          const items = rootCause.byHiddenFailureCode.filter((it) => it.classification === tier.key);
          if (items.length === 0) return null;
          return (
            <div key={tier.key} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: THEME.navy, marginBottom: 6 }}>{items.length} مورد — {tier.label}</p>
              <SimpleTable
                headers={["کد", "شرح", "تعداد", ""]}
                rows={items.map((it) => [
                  it.code, it.textFa, it.branchCount,
                  <button key="btn" type="button" style={{ ...styles.smallButton, fontSize: 11 }} onClick={() => setModalSrc({ sourceType: "hidden_failure_code", hiddenFailureCode: it.code, titleFa: it.textFa, repeatCount: it.branchCount, classification: it.classification })}>صدور اقدام اصلاحی</button>,
                ])}
              />
            </div>
          );
        })}
        {rootCause.byHiddenFailureCode.length === 0 && <p style={{ fontSize: 12, color: THEME.text3 }}>هنوز هیچ کدی در ۲ یا چند مسیر مستقل تکرار نشده است.</p>}
      </div>

      <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16 }}>
        <h4 style={{ fontSize: 13.5, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>اقدامات اصلاحی ثبت‌شده</h4>
        {correctiveActions.length === 0 && <p style={{ fontSize: 12, color: THEME.text3 }}>هنوز اقدام اصلاحی ثبت نشده.</p>}
        {correctiveActions.map((ca) => (
          <div key={ca.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${THEME.border}`, gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 12.5, margin: 0 }}><b>{ca.titleFa}</b> <span style={{ color: THEME.text3, fontSize: 11 }}>({ca.sourceType === "brf_category" ? `دسته BRF: ${ca.brfCode}` : `کد: ${ca.hiddenFailureCode}`}, تکرار: {ca.repeatCount})</span></p>
              <p style={{ fontSize: 11.5, color: THEME.text2, margin: "4px 0" }}>{ca.description}</p>
              <p style={{ fontSize: 11, color: THEME.text3, margin: 0 }}>مسئول: {ca.responsiblePerson}{ca.dueDate && ` · مهلت: ${toJalaliSafe(ca.dueDate)}`}</p>
            </div>
            <select
              style={{ ...styles.input, marginTop: 0, width: 130 }} value={ca.status} dir="rtl"
              onChange={async (e) => { await updateTripodCorrectiveActionStatus(ca.id, e.target.value); await onRefresh(); }}
            >
              {Object.entries(CA_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>

      {modalSrc && (
        <CorrectiveActionModal
          src={modalSrc} incident={incident} analysisId={analysisId} currentUser={currentUser}
          onClose={() => setModalSrc(null)}
          onSaved={async () => { setModalSrc(null); await onRefresh(); }}
        />
      )}
    </div>
  );
}

function SimpleTable({ headers, rows, emptyText }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
            {headers.map((h, i) => <th key={i} style={{ textAlign: i === 1 ? "right" : "center", padding: "6px 8px" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={headers.length} style={{ padding: 14, textAlign: "center", color: THEME.text3 }}>{emptyText}</td></tr>}
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${THEME.border}` }}>
              {row.map((cell, ci) => <td key={ci} style={{ padding: "6px 8px", textAlign: ci === 1 ? "right" : "center" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CorrectiveActionModal({ src, incident, analysisId, currentUser, onClose, onSaved }) {
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const classLabel = { root_cause: "علت ریشه‌ای", major_issue: "اشکال مهم", hidden_issue: "اشکال پنهان" }[src.classification];

  const handleSave = async () => {
    if (!description.trim() || !responsible.trim()) { setError("شرح و مسئول اقدام الزامی است"); return; }
    setSaving(true);
    const result = await createTripodCorrectiveAction(analysisId, {
      sourceType: src.sourceType, brfCode: src.brfCode, hiddenFailureCode: src.hiddenFailureCode,
      titleFa: src.titleFa, repeatCount: src.repeatCount, classification: src.classification,
      description, responsiblePerson: responsible, dueDate,
    }, currentUser?.name);
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    onSaved();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,63,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: THEME.surface, borderRadius: 14, padding: 22, maxWidth: 440, width: "100%", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 15, color: THEME.navy, fontWeight: 800, margin: "0 0 12px" }}>صدور اقدام اصلاحی</h3>
        <div style={{ background: THEME.bg, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11.5, color: THEME.text2, lineHeight: 1.9 }}>
          <div><b>حادثه:</b> {incident?.incidentNo}</div>
          <div><b>منبع:</b> {src.sourceType === "brf_category" ? "دسته اصلی (BRF)" : "کد اشکال پنهان"}</div>
          <div><b>عنوان/تعریف:</b> {src.titleFa}</div>
          <div><b>تعداد تکرار:</b> {src.repeatCount}{classLabel ? ` — ${classLabel}` : ""}</div>
        </div>
        <label style={styles.label}>شرح اقدام اصلاحی</label>
        <textarea style={{ ...styles.input, minHeight: 60 }} value={description} onChange={(e) => setDescription(e.target.value)} dir="rtl" />
        <label style={styles.label}>مسئول اقدام</label>
        <input style={styles.input} value={responsible} onChange={(e) => setResponsible(e.target.value)} dir="rtl" />
        <label style={styles.label}>مهلت انجام</label>
        <input type="date" style={styles.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {error && <p style={styles.error}>{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" style={styles.smallButton} onClick={handleSave} disabled={saving}>{saving ? "در حال ثبت..." : "ثبت اقدام اصلاحی"}</button>
          <button type="button" style={{ ...styles.smallButton, background: THEME.text3 }} onClick={onClose}>انصراف</button>
        </div>
      </div>
    </div>
  );
}

// ---------- تب تاریخچه ----------

function HistoryTab({ history }) {
  if (history.length === 0) return <p style={{ fontSize: 12, color: THEME.text3, textAlign: "center", padding: 30 }}>هنوز رخدادی ثبت نشده.</p>;
  return (
    <div>
      {history.map((h) => (
        <div key={h.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${THEME.border}` }}>
          <HistoryIcon size={14} color={THEME.text3} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 12.5, margin: 0 }}>
              {h.fromStatus ? `${TRIPOD_STATUS_LABELS[h.fromStatus] || h.fromStatus} ← ` : ""}
              <b style={{ color: THEME.navy }}>{TRIPOD_STATUS_LABELS[h.toStatus] || h.toStatus}</b>
              {h.changedBy && <span style={{ color: THEME.text3 }}> — توسط {h.changedBy}</span>}
            </p>
            <p style={{ fontSize: 11, color: THEME.text3, margin: "2px 0 0" }}>{toJalaliSafe(h.changedAt)}{h.note && ` — ${h.note}`}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
