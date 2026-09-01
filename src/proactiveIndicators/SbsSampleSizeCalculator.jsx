import React, { useState, useEffect } from "react";
import { Calculator, Plus, Trash2, Send } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadContractorOptions } from "../personnel/personnelApi.js";
import { createSbsAssignment } from "./sbsApi.js";

/**
 * ماشین‌حساب تعیین حجم نمونه SBS — پورت دقیق فرمول فایل راهنمای HSE
 * (public/hse_guide.html، بخش ۴): N = K² × (1−P) / (S² × P)، با
 * K≈۱٫۶۴ برای حد اطمینان ۹۵٪.
 *
 * طبق خواسته‌ی صریح: فقط کارفرما/سرپرست HSE (role=EMPLOYER یا ADMIN)
 * محاسبه و ارسال می‌کند؛ پیمانکار فقط هدف نهایی را می‌بیند (در
 * SbsAssignmentsList)، نه این ماشین‌حساب را.
 */
const K_95 = 1.64;

function computeSampleSize(pilotTotal, pilotUnsafe, precisionPct) {
  const p = pilotTotal > 0 ? pilotUnsafe / pilotTotal : 0;
  const s = precisionPct / 100;
  if (p <= 0 || p >= 1 || s <= 0) return null;
  const n = (K_95 ** 2 * (1 - p)) / (s ** 2 * p);
  return { p, n: Math.ceil(n) };
}

export default function SbsSampleSizeCalculator({ currentUser, onClose, onSent }) {
  const [mode, setMode] = useState("factory"); // factory | workshop
  const [pilotTotal, setPilotTotal] = useState("200");
  const [pilotUnsafe, setPilotUnsafe] = useState("");
  const [precisionPct, setPrecisionPct] = useState("5");
  const [population, setPopulation] = useState("");
  const [workshops, setWorkshops] = useState([{ id: 1, name: "کارگاه شماره ۱", workers: "" }]);
  const [contractors, setContractors] = useState([]);
  const [targetContractorId, setTargetContractorId] = useState("all");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadContractorOptions().then(setContractors); }, []);

  const total = Number(pilotTotal) || 0;
  const unsafe = Number(pilotUnsafe) || 0;
  const precision = Number(precisionPct) || 0;
  const result = unsafe > 0 && total > 0 ? computeSampleSize(total, unsafe, precision) : null;

  const pop = Number(population) || 0;
  const perPerson = result && pop > 0 ? Math.ceil(result.n / pop) : null;
  const finalTotalIndividual = perPerson && pop > 0 ? perPerson * pop : null;

  const totalWorkers = workshops.reduce((sum, w) => sum + (Number(w.workers) || 0), 0);

  const addWorkshop = () => setWorkshops([...workshops, { id: Date.now(), name: `کارگاه شماره ${workshops.length + 1}`, workers: "" }]);
  const removeWorkshop = (id) => setWorkshops(workshops.filter((w) => w.id !== id));
  const updateWorkshop = (id, field, value) => setWorkshops(workshops.map((w) => (w.id === id ? { ...w, [field]: value } : w)));

  const workshopBreakdown = mode === "workshop" && result && totalWorkers > 0
    ? workshops.map((w) => {
        const workers = Number(w.workers) || 0;
        const share = totalWorkers > 0 ? Math.round((workers / totalWorkers) * result.n) : 0;
        const perPersonWs = workers > 0 ? Math.ceil(share / workers) : 0;
        return { name: w.name, workers, share, perPerson: perPersonWs, finalTotal: perPersonWs * workers };
      })
    : null;

  const handleSend = async () => {
    setError(""); setSentMessage("");
    if (!result) { setError("ابتدا حجم نمونه را محاسبه کنید"); return; }
    setSending(true);
    const result_ = await createSbsAssignment({
      contractorId: targetContractorId === "all" ? null : targetContractorId,
      mode, pilotTotal: total, pilotUnsafe: unsafe, precisionPct: precision, calculatedP: result.p,
      totalSampleSize: result.n, population: mode === "factory" ? pop : null, perPerson: mode === "factory" ? perPerson : null,
      workshopBreakdown, note,
    }, currentUser?.name);
    setSending(false);
    if (result_?.__error) { setError(result_.message); return; }
    setSentMessage("هدف نمونه‌برداری برای پیمانکار ارسال شد.");
    if (onSent) onSent();
  };

  return (
    <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ fontSize: 14, color: THEME.navy, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Calculator size={16} /> محاسبه و واگذاری حجم نمونه
        </h3>
        {onClose && <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: THEME.text3 }}>بستن</button>}
      </div>
      <p style={{ fontSize: 11.5, color: THEME.text3, marginBottom: 14, lineHeight: 1.9 }}>
        فرمول تعیین حجم نمونه (حد اطمینان ۹۵٪): N = K² × (۱−P) / (S² × P) — طبق راهنمای HSE. بعد از محاسبه، هدف نهایی را برای پیمانکار ارسال می‌کنید تا نمونه‌برداری واقعی را انجام دهد.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setMode("factory")} style={{ ...styles.smallButton, background: mode === "factory" ? THEME.teal : THEME.text3, flex: 1 }}>کارخانه</button>
        <button type="button" onClick={() => setMode("workshop")} style={{ ...styles.smallButton, background: mode === "workshop" ? THEME.teal : THEME.text3, flex: 1 }}>کارگاه</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div>
          <label style={styles.label}>تعداد کل مشاهدات پایلوت</label>
          <input type="number" style={styles.input} value={pilotTotal} onChange={(e) => setPilotTotal(e.target.value)} dir="ltr" placeholder="پیش‌فرض راهنما: ۲۰۰" />
        </div>
        <div>
          <label style={styles.label}>تعداد رفتار ناایمن در پایلوت</label>
          <input type="number" style={styles.input} value={pilotUnsafe} onChange={(e) => setPilotUnsafe(e.target.value)} dir="ltr" />
        </div>
        <div>
          <label style={styles.label}>دقت مدنظر S (٪)</label>
          <input type="number" style={styles.input} value={precisionPct} onChange={(e) => setPrecisionPct(e.target.value)} dir="ltr" placeholder="پیش‌فرض راهنما: ۵" />
        </div>
      </div>

      {result && (
        <div style={{ background: THEME.bg, borderRadius: 9, padding: 14, marginTop: 14 }}>
          <p style={{ fontSize: 12.5, color: THEME.text2, margin: "0 0 4px" }}>
            نسبت رفتار ناایمن در پایلوت (P): <b style={{ color: THEME.navy }}>{(result.p * 100).toFixed(1)}٪</b>
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, color: THEME.teal, margin: "6px 0" }}>
            حجم نمونه‌ی کل لازم: {result.n.toLocaleString("fa-IR")} مشاهده
          </p>
        </div>
      )}

      {result && mode === "factory" && (
        <div style={{ marginTop: 14 }}>
          <label style={styles.label}>جمعیت آماری (تعداد کارکنان کارخانه)</label>
          <input type="number" style={styles.input} value={population} onChange={(e) => setPopulation(e.target.value)} dir="ltr" />
          {perPerson != null && (
            <div style={{ background: "#eaf0fa", borderRadius: 9, padding: 12, marginTop: 10 }}>
              <p style={{ fontSize: 12.5, color: "#2c4a6b", margin: 0, lineHeight: 1.9 }}>
                {result.n.toLocaleString("fa-IR")} ÷ {pop.toLocaleString("fa-IR")} ≈ به‌ازای هر نفر <b>{perPerson}</b> مشاهده لازم است
                (جمعاً <b>{finalTotalIndividual.toLocaleString("fa-IR")}</b> مشاهده در طول سال).
              </p>
            </div>
          )}
        </div>
      )}

      {result && mode === "workshop" && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: THEME.navy, marginBottom: 8 }}>توزیع نمونه بین کارگاه‌ها (متناسب با تعداد کارگران هر کارگاه)</p>
          {workshops.map((w) => (
            <div key={w.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input style={{ ...styles.input, marginTop: 0, flex: 2 }} value={w.name} onChange={(e) => updateWorkshop(w.id, "name", e.target.value)} dir="rtl" />
              <input type="number" style={{ ...styles.input, marginTop: 0, flex: 1 }} value={w.workers} onChange={(e) => updateWorkshop(w.id, "workers", e.target.value)} dir="ltr" placeholder="تعداد کارگر" />
              {workshops.length > 1 && (
                <button type="button" onClick={() => removeWorkshop(w.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={14} color={THEME.danger} />
                </button>
              )}
            </div>
          ))}
          <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }} onClick={addWorkshop}>
            <Plus size={12} /> افزودن کارگاه
          </button>

          {workshopBreakdown && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>کارگاه</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>تعداد کارگران</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>سهم از نمونه‌ی کل</th>
                    <th style={{ textAlign: "center", padding: "6px 8px" }}>مشاهدات نهایی</th>
                  </tr>
                </thead>
                <tbody>
                  {workshopBreakdown.map((w) => (
                    <tr key={w.name} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "6px 8px" }}>{w.name}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{w.workers.toLocaleString("fa-IR")}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{w.share.toLocaleString("fa-IR")}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: THEME.navy }}>
                        {w.finalTotal.toLocaleString("fa-IR")} <span style={{ color: THEME.text3, fontWeight: 400 }}>({w.perPerson} به‌ازای هر نفر)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ background: THEME.dangerBg, border: `1px solid ${THEME.danger}`, borderRadius: 9, padding: 14, marginTop: 16 }}>
          <h4 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: "0 0 10px" }}>ارسال هدف نمونه‌برداری برای پیمانکار</h4>
          <label style={styles.label}>پیمانکار مقصد</label>
          <select style={styles.input} value={targetContractorId} onChange={(e) => setTargetContractorId(e.target.value)} dir="rtl">
            <option value="all">همه‌ی پیمانکاران این شرکت</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={styles.label}>یادداشت برای پیمانکار (اختیاری)</label>
          <input style={styles.input} value={note} onChange={(e) => setNote(e.target.value)} dir="rtl" placeholder="مثلاً: نمونه‌برداری فصل بهار" />
          {error && <p style={styles.error}>{error}</p>}
          {sentMessage && <p style={{ fontSize: 12.5, color: "#166534", marginTop: 10, fontWeight: 600 }}>{sentMessage}</p>}
          <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6, marginTop: 12 }} onClick={handleSend} disabled={sending}>
            <Send size={13} /> {sending ? "در حال ارسال..." : "ارسال به پیمانکار"}
          </button>
        </div>
      )}
    </div>
  );
}
