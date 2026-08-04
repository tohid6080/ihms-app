import React, { useState, useEffect } from "react";
import { Tag } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadContractorsWithScaffoldCode, setContractorScaffoldCode } from "./scaffoldApi.js";

/**
 * Every contractor already registered in "مدیریت پیمانکاران" shows up here
 * automatically (same table, just reading it) — the admin only needs to
 * assign the 2-letter code used in that contractor's tag numbers
 * (Md1-XX-SC-01). No separate contractor list to maintain.
 */
export default function ScaffoldTagCodeManager({ onBack }) {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    const list = await loadContractorsWithScaffoldCode();
    setContractors(list);
    const d = {};
    list.forEach((c) => { d[c.id] = c.scaffoldTagCode; });
    setDrafts(d);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (contractorId) => {
    const code = (drafts[contractorId] || "").trim();
    if (code.length !== 2) {
      alert("کد باید دقیقاً ۲ حرف انگلیسی باشد (مثال: NN)");
      return;
    }
    setSavingId(contractorId);
    const result = await setContractorScaffoldCode(contractorId, code);
    setSavingId(null);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Tag size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>کد تگ داربست پیمانکاران</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 16 }}>
        هر پیمانکار برای اخذ تگ داربست به یک کد دوحرفی نیاز دارد (مثال: نصب نیرو = NN). تا این کد تعریف نشود، آن پیمانکار نمی‌تواند تگ جدید درخواست کند.
      </p>

      {contractors.length === 0 && <p style={{ color: THEME.text3 }}>هنوز پیمانکاری در سامانه ثبت نشده است.</p>}

      {contractors.map((c) => (
        <div key={c.id} style={{ ...styles.card, width: "auto", marginBottom: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: THEME.text }}>{c.name}</span>
          <input
            style={{ ...styles.input, width: 70, textAlign: "center", textTransform: "uppercase" }}
            value={drafts[c.id] || ""}
            onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: e.target.value.toUpperCase().slice(0, 2) }))}
            placeholder="XX"
            maxLength={2}
            dir="ltr"
          />
          <button type="button" style={styles.smallButton} onClick={() => handleSave(c.id)} disabled={savingId === c.id}>
            {savingId === c.id ? "..." : "ذخیره"}
          </button>
        </div>
      ))}
    </div>
  );
}
