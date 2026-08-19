import React, { useState, useEffect } from "react";
import { ShieldAlert, Plus, Trash2, Link as LinkIcon } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliSafe } from "../personnel/jalaliDate.jsx";
import {
  loadHcmsAssessments, saveHcmsAssessment, deleteHcmsAssessment, approveHcmsAssessment,
  computeRiskLevel, worstLevel, RISK_LEVEL_META, parseRpnCode,
} from "./hcmsApi.js";
import { loadFieldSuggestions, learnFromApprovedAssessment } from "../riskknowledge/riskKnowledgeApi.js";
import RiskMatrixPreview from "./RiskMatrixPreview.jsx";

const EMPTY_FORM = {
  process: "", activity: "", activityType: "", unit: "", equipment: "",
  hazard: "", environmentalAspect: "", riskOrOpportunity: "", cause: "", consequence: "",
  existingControls: "", defensiveBarriers: "", legalRequirement: "",
  initialRpn: { human: "", equipment: "", environment: "", reputation: "" },
  permitToWork: "", proposedControls: "", recoveryPlan: "", responsiblePerson: "", targetDate: "", proposedControlsResult: "",
  residualRpn: { human: "", equipment: "", environment: "", reputation: "" },
  emergencyCondition: "", criticalElement: "", status: "active",
};

const CATEGORY_LABELS = { human: "انسان", equipment: "تجهیزات", environment: "محیط‌زیست", reputation: "اعتبار" };

export default function HcmsDashboard({ onBack, currentUser, focusAnomalyId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [initialLevels, setInitialLevels] = useState({});
  const [residualLevels, setResidualLevels] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState({ cause: [], consequence: [], existingControls: [], proposedControls: [] });
  const isContractor = currentUser?.role === "CONTRACTOR";

  const load = async () => {
    const rows = await loadHcmsAssessments();
    setList(rows);
    setLoading(false);
    if (focusAnomalyId) {
      const match = rows.find((r) => r.linkedAnomalyId === focusAnomalyId);
      if (match) openEdit(match);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // با هر تغییر در کدهای RPN، سطح هر دسته را زنده محاسبه و نمایش می‌دهد —
  // این همان چیزی است که کاربر واقعاً وارد می‌کند؛ همه‌چیز دیگر خودکار است.
  useEffect(() => {
    (async () => {
      const entries = await Promise.all(Object.entries(form.initialRpn).map(async ([k, v]) => [k, await computeRiskLevel(v)]));
      setInitialLevels(Object.fromEntries(entries));
    })();
  }, [form.initialRpn]);
  useEffect(() => {
    (async () => {
      const entries = await Promise.all(Object.entries(form.residualRpn).map(async ([k, v]) => [k, await computeRiskLevel(v)]));
      setResidualLevels(Object.fromEntries(entries));
    })();
  }, [form.residualRpn]);

  const initialOverall = worstLevel(Object.values(initialLevels));
  const residualOverall = worstLevel(Object.values(residualLevels));

  // با هر تغییر در فعالیت/خطر/جنبه‌ی زیست‌محیطی، بانک اطلاعاتی جستجو می‌شود
  // و پیشنهادهای هر فیلد (علت/پیامد/کنترل موجود/کنترل پیشنهادی) به‌روز
  // می‌شوند — این پیشنهادها فقط راهنما هستند، کاربر آزاد است انتخاب کند،
  // ویرایش کند، یا نادیده بگیرد.
  useEffect(() => {
    const query = { activity: form.activity, hazard: form.hazard, environmentalAspect: form.environmentalAspect };
    if (!query.activity?.trim() && !query.hazard?.trim() && !query.environmentalAspect?.trim()) {
      setSuggestions({ cause: [], consequence: [], existingControls: [], proposedControls: [] });
      return;
    }
    (async () => {
      const [cause, consequence, existingControls, proposedControls] = await Promise.all([
        loadFieldSuggestions(query, "cause"),
        loadFieldSuggestions(query, "consequence"),
        loadFieldSuggestions(query, "existingControls"),
        loadFieldSuggestions(query, "recommendedControls"),
      ]);
      setSuggestions({ cause, consequence, existingControls, proposedControls });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.activity, form.hazard, form.environmentalAspect]);

  // یک گزینه‌ی پیشنهادی را به فیلد فرم اضافه می‌کند (اگر از قبل نبود)، در
  // یک خط جدید — کاربر بعداً می‌تواند آزادانه ویرایش یا حذفش کند
  const applySuggestion = (fieldKey, value) => {
    setForm((prev) => {
      const current = prev[fieldKey] || "";
      if (current.includes(value)) return prev;
      const updated = current ? `${current}\n${value}` : value;
      return { ...prev, [fieldKey]: updated };
    });
  };

  const openNew = () => { setForm({ ...EMPTY_FORM, status: isContractor ? "pending_review" : "active" }); setEditingId(null); setError(""); setShowForm(true); };
  const openEdit = (rec) => {
    setForm({
      process: rec.process, activity: rec.activity, activityType: rec.activityType, unit: rec.unit, equipment: rec.equipment,
      hazard: rec.hazard, environmentalAspect: rec.environmentalAspect, riskOrOpportunity: rec.riskOrOpportunity, cause: rec.cause, consequence: rec.consequence,
      existingControls: rec.existingControls, defensiveBarriers: rec.defensiveBarriers, legalRequirement: rec.legalRequirement,
      initialRpn: rec.initialRpn,
      permitToWork: rec.permitToWork, proposedControls: rec.proposedControls, recoveryPlan: rec.recoveryPlan, responsiblePerson: rec.responsiblePerson, targetDate: rec.targetDate, proposedControlsResult: rec.proposedControlsResult,
      residualRpn: rec.residualRpn,
      emergencyCondition: rec.emergencyCondition, criticalElement: rec.criticalElement,
      linkedAnomalyId: rec.linkedAnomalyId, status: rec.status || "active",
    });
    setEditingId(rec.id);
    setError("");
    setShowForm(true);
  };

  const setRpnField = (which, category, value) => {
    setForm((prev) => ({ ...prev, [which]: { ...prev[which], [category]: value } }));
  };

  const handleSave = async () => {
    if (!form.activity.trim()) { setError("عنوان فعالیت الزامی است"); return; }
    for (const [k, v] of Object.entries(form.initialRpn)) {
      if (v && !parseRpnCode(v)) { setError(`کد RPN اولیه (${CATEGORY_LABELS[k]}) نامعتبر است — فرمت درست مثل «4C» (عدد ۰ تا ۵ + حرف A تا E)`); return; }
    }
    for (const [k, v] of Object.entries(form.residualRpn)) {
      if (v && !parseRpnCode(v)) { setError(`کد RPN باقیمانده (${CATEGORY_LABELS[k]}) نامعتبر است`); return; }
    }
    setSaving(true);
    setError("");
    const result = await saveHcmsAssessment({ ...form, id: editingId, createdBy: currentUser?.name });
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setShowForm(false);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("این ارزیابی ریسک حذف شود؟")) return;
    const result = await deleteHcmsAssessment(id);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === list.length ? [] : list.map((r) => r.id)));
  };
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`${selectedIds.length} ارزیابی ریسک انتخاب‌شده کامل حذف شوند؟ این عملیات قابل بازگشت نیست.`)) return;
    setBulkDeleting(true);
    // از همان تابع حذف تکی موجود استفاده می‌شود — بدون افزودن مسیر جدید در لایه‌ی داده
    for (const id of selectedIds) {
      await deleteHcmsAssessment(id);
    }
    setBulkDeleting(false);
    setSelectedIds([]);
    await load();
  };

  const handleApprove = async () => {
    if (!editingId) return;
    setSaving(true);
    // اول تغییرات فعلی فرم را ذخیره کن (شاید کارفرما چیزی را ویرایش کرده)، بعد وضعیت را تأیید‌شده کن
    const saveResult = await saveHcmsAssessment({ ...form, id: editingId, createdBy: currentUser?.name });
    if (saveResult?.__error) { setSaving(false); setError(saveResult.message); return; }
    const approveResult = await approveHcmsAssessment(editingId);
    setSaving(false);
    if (approveResult?.__error) { setError(approveResult.message); return; }
    // بعد از تأیید نهایی، بانک اطلاعاتی از این ارزیابی «یاد می‌گیرد» — اگر
    // سناریوی واقعاً جدیدی بود، به بانک اضافه می‌شود؛ اگر شکست بخورد،
    // مانع ذخیره‌شدن خودِ ارزیابی نمی‌شود (best-effort)
    learnFromApprovedAssessment(
      { ...form, id: editingId, proposedControls: form.proposedControls, initialRpn: form.initialRpn?.human || form.initialRpn?.environment, residualRpn: form.residualRpn?.human || form.residualRpn?.environment },
      currentUser?.name
    ).catch(() => {});
    setShowForm(false);
    await load();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  if (showForm) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <div style={styles.backLink} onClick={() => setShowForm(false)}>← انصراف</div>
        <h2 style={{ fontSize: 17, color: THEME.navy, fontWeight: 700, marginBottom: 4 }}>{editingId ? "ویرایش ارزیابی ریسک HCMS" : "ارزیابی ریسک HCMS جدید"}</h2>
        {form.linkedAnomalyId && (
          <p style={{ fontSize: 11.5, color: THEME.teal, display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <LinkIcon size={12} /> این ارزیابی به یک آنومالی متصل است
          </p>
        )}
        {form.status === "pending_review" && (
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.8 }}>
              {isContractor
                ? <>این ارزیابی پس از ذخیره برای بررسی و <b>تأیید کارفرما</b> ارسال می‌شود.</>
                : <>این رکورد یا خودکار (از یک آنومالی) ساخته شده یا توسط پیمانکار ارسال شده و <b>هنوز نهایی نیست</b>. لطفاً همه‌ی فیلدها را بررسی، در صورت نیاز اصلاح کن، سپس «تأیید نهایی» را بزن.</>}
            </p>
          </div>
        )}

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>اطلاعات فعالیت</h3>
          <div style={styles.formGrid}>
            <div><label style={styles.label}>فرآیند</label><input style={styles.input} value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} dir="rtl" /></div>
            <div><label style={styles.label}>فعالیت *</label><input style={styles.input} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} dir="rtl" /></div>
          </div>
          <div style={styles.formGrid}>
            <div><label style={styles.label}>واحد</label><input style={styles.input} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} dir="rtl" /></div>
            <div><label style={styles.label}>تجهیز</label><input style={styles.input} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} dir="rtl" /></div>
          </div>
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>شناسایی خطر</h3>
          <label style={styles.label}>خطر (ایمنی و بهداشت)</label>
          <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={form.hazard} onChange={(e) => setForm({ ...form, hazard: e.target.value })} dir="rtl" />
          <label style={styles.label}>جنبه‌های زیست‌محیطی</label>
          <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={form.environmentalAspect} onChange={(e) => setForm({ ...form, environmentalAspect: e.target.value })} dir="rtl" />

          <label style={styles.label}>علت</label>
          <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit" }} value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} dir="rtl" />
          <SuggestionChips items={suggestions.cause} onPick={(v) => applySuggestion("cause", v)} />
          <label style={styles.label}>پیامد</label>
          <input style={styles.input} value={form.consequence} onChange={(e) => setForm({ ...form, consequence: e.target.value })} dir="rtl" />
          <SuggestionChips items={suggestions.consequence} onPick={(v) => applySuggestion("consequence", v)} />
          <label style={styles.label}>کنترل‌های موجود</label>
          <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit" }} value={form.existingControls} onChange={(e) => setForm({ ...form, existingControls: e.target.value })} dir="rtl" />
          <SuggestionChips items={suggestions.existingControls} onPick={(v) => applySuggestion("existingControls", v)} />
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 4px", fontWeight: 700 }}>ریسک اولیه</h3>
          <p style={{ fontSize: 11, color: THEME.text3, margin: "0 0 10px" }}>فقط کد RPN را وارد کن (مثال: «4C» = شدت ۴، احتمال C) — سطح ریسک خودکار محاسبه می‌شود.</p>
          <RiskMatrixPreview />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            {Object.keys(CATEGORY_LABELS).map((k) => (
              <div key={k}>
                <label style={styles.label}>{CATEGORY_LABELS[k]}</label>
                <input style={{ ...styles.input, direction: "ltr", textAlign: "center" }} value={form.initialRpn[k]} onChange={(e) => setRpnField("initialRpn", k, e.target.value)} placeholder="مثال: 4C" />
                {initialLevels[k] && <LevelBadge level={initialLevels[k]} />}
              </div>
            ))}
          </div>
          {initialOverall && <div style={{ marginTop: 10 }}>سطح کلی: <LevelBadge level={initialOverall} /></div>}
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 10px", fontWeight: 700 }}>اقدامات کنترلی</h3>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Permit to Work?</label>
              <select style={styles.input} value={form.permitToWork} onChange={(e) => setForm({ ...form, permitToWork: e.target.value })} dir="rtl">
                <option value="">—</option><option value="YES">YES</option><option value="NO">NO</option>
              </select>
            </div>
            <div><label style={styles.label}>مسئول اجرا</label><input style={styles.input} value={form.responsiblePerson} onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })} dir="rtl" /></div>
          </div>
          <label style={styles.label}>کنترل‌های پیشنهادی</label>
          <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={form.proposedControls} onChange={(e) => setForm({ ...form, proposedControls: e.target.value })} dir="rtl" />
          <SuggestionChips items={suggestions.proposedControls} onPick={(v) => applySuggestion("proposedControls", v)} />
          <label style={styles.label}>برنامه بازیابی (Recovery Plan)</label>
          <textarea style={{ ...styles.input, minHeight: 50, fontFamily: "inherit" }} value={form.recoveryPlan} onChange={(e) => setForm({ ...form, recoveryPlan: e.target.value })} dir="rtl" />
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: THEME.navy, margin: "0 0 4px", fontWeight: 700 }}>ریسک باقیمانده (بعد از کنترل‌های پیشنهادی)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
            {Object.keys(CATEGORY_LABELS).map((k) => (
              <div key={k}>
                <label style={styles.label}>{CATEGORY_LABELS[k]}</label>
                <input style={{ ...styles.input, direction: "ltr", textAlign: "center" }} value={form.residualRpn[k]} onChange={(e) => setRpnField("residualRpn", k, e.target.value)} placeholder="مثال: 1B" />
                {residualLevels[k] && <LevelBadge level={residualLevels[k]} />}
              </div>
            ))}
          </div>
          {residualOverall && <div style={{ marginTop: 10 }}>سطح کلی: <LevelBadge level={residualOverall} /></div>}
        </div>

        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>شرایط اضطرار</label>
              <select style={styles.input} value={form.emergencyCondition} onChange={(e) => setForm({ ...form, emergencyCondition: e.target.value })} dir="rtl">
                <option value="">—</option><option value="Yes">دارد</option><option value="No">ندارد</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Critical Element?</label>
              <select style={styles.input} value={form.criticalElement} onChange={(e) => setForm({ ...form, criticalElement: e.target.value })} dir="rtl">
                <option value="">—</option><option value="Yes">بله</option><option value="No">خیر</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={styles.button} onClick={handleSave} disabled={saving}>
            {saving ? "در حال ذخیره..." : (isContractor && form.status === "pending_review" ? "ارسال برای تأیید کارفرما" : "ذخیره‌ی ارزیابی ریسک")}
          </button>
          {!isContractor && form.status === "pending_review" && (
            <button type="button" style={{ ...styles.button, background: "#166534" }} onClick={handleApprove} disabled={saving}>تأیید نهایی</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به مدیریت ارزیابی ریسک</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={20} color={THEME.teal} />
          <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>HCMS — سیستم مدیریت و کنترل خطرات</h2>
        </div>
        <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={openNew}>
          <Plus size={14} /> ارزیابی جدید
        </button>
      </div>

      {list.length === 0 && <p style={{ color: THEME.text3, textAlign: "center", padding: "30px 0" }}>هنوز ارزیابی ریسکی ثبت نشده است</p>}

      {list.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: THEME.text2, cursor: "pointer" }}>
            <input type="checkbox" checked={selectedIds.length === list.length && list.length > 0} onChange={toggleSelectAll} />
            انتخاب همه ({list.length})
          </label>
          {selectedIds.length > 0 && (
            <button
              type="button"
              style={{ ...styles.smallButton, background: THEME.danger, display: "flex", alignItems: "center", gap: 6 }}
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              <Trash2 size={12} /> {bulkDeleting ? "در حال حذف..." : `حذف ${selectedIds.length} مورد انتخاب‌شده`}
            </button>
          )}
        </div>
      )}

      {list.map((rec) => (
        <div key={rec.id} style={{ ...styles.card, width: "auto", marginBottom: 10, border: selectedIds.includes(rec.id) ? `1.5px solid ${THEME.danger}` : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 200 }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(rec.id)}
                onChange={() => toggleSelect(rec.id)}
                style={{ marginTop: 4, flexShrink: 0 }}
              />
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openEdit(rec)}>
                <div style={{ fontWeight: 700, color: THEME.navy, fontSize: 14 }}>
                  {rec.activity}
                  {rec.linkedAnomalyId && <LinkIcon size={12} color={THEME.teal} style={{ marginRight: 6, display: "inline" }} />}
                  {rec.status === "pending_review" && (
                    <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 999, fontWeight: 600, marginRight: 6 }}>در انتظار بررسی کارفرما</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 4 }}>{rec.hazard || rec.environmentalAspect || "—"}</div>
                <div style={{ fontSize: 10.5, color: THEME.text3, marginTop: 4 }}>{toJalaliSafe(rec.createdAt)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {rec.initialLevelOverall && <LevelBadge level={rec.initialLevelOverall} label="اولیه" />}
              {rec.residualLevelOverall && <LevelBadge level={rec.residualLevelOverall} label="باقیمانده" />}
              <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={(e) => { e.stopPropagation(); handleDelete(rec.id); }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuggestionChips({ items, onPick }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 10, color: THEME.text3, alignSelf: "center" }}>پیشنهاد بانک اطلاعاتی:</span>
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(item)}
          title={item}
          style={{
            fontSize: 10.5, padding: "3px 9px", borderRadius: 999, background: "#eef1f5", color: THEME.navyMid,
            border: `1px solid ${THEME.border}`, cursor: "pointer", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          + {item}
        </button>
      ))}
    </div>
  );
}

function LevelBadge({ level, label }) {
  const meta = RISK_LEVEL_META[level];
  if (!meta) return null;
  return (
    <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 999, background: meta.bg, color: meta.color, fontWeight: 600, display: "inline-block", marginTop: 4 }}>
      {label ? `${label}: ` : ""}{meta.label}
    </span>
  );
}
