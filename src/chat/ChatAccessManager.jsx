import React, { useState, useEffect } from "react";
import { ShieldOff, X, Plus } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadActiveJobPositions } from "../jobpositions/jobPositionsApi.js";
import {
  loadVisibilityRules, setVisibilityRule, loadUsedJobPositionsByRole,
  loadExtraIdentities, addExtraIdentity, removeExtraIdentity,
} from "./chatApi.js";

const ROLE_LABEL = { ADMIN: "ادمین", EMPLOYER: "کارفرما", CONTRACTOR: "پیمانکار" };

// ادمین معمولاً عنوان شغلی مشخصی ندارد، برای همین هویتش یک ردیف/ستون ثابت
// در ماتریس است (jobPositionId=null)، نه چیزی که از «مدیریت عناوین شغلی» بیاید.
const ADMIN_IDENTITY = { role: "ADMIN", jobPositionId: null, title: "ادمین" };

/**
 * "مدیریت دسترسی چت" — ماتریس (نقش + عنوان‌شغلی) × (نقش + عنوان‌شغلی).
 *
 * چرا نقش هم بخشی از هویته، نه فقط عنوان شغلی: یک عنوان شغلی مثل «سرپرست
 * کارگاه» می‌تواند هم سمت کارفرما هم سمت پیمانکار استفاده شود — این دو نفر
 * باید بتوانند مستقل از هم بلاک شوند.
 *
 * لیست پایه‌ی ماتریس، «ادمین» (همیشه ثابت) + عناوینی است که واقعاً حساب
 * واقعی با آن نقش دارند — اما چون گاهی لازم است عنوانی را زودتر از ساختن
 * حساب واقعی‌اش در ماتریس تنظیم کرد، امکان «افزودن دستی» هم هست (جدول
 * chat_matrix_extra_identities).
 *
 * برخلاف نسخه‌ی قبلی، ادمین دیگر از بلاک‌شدن معاف نیست — اگر خانه‌ی
 * تلاقی «ادمین» با یک (نقش+عنوان شغلی) خاص بلاک شود، آن افراد در «گفتگوی
 * جدید» ادمین را نمی‌بینند و برعکس.
 */
export default function ChatAccessManager({ onBack }) {
  const [positions, setPositions] = useState([]);
  const [rules, setRules] = useState([]);
  const [usedByRole, setUsedByRole] = useState({ employerJobPositionIds: new Set(), contractorJobPositionIds: new Set() });
  const [extraIdentities, setExtraIdentities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addPositionId, setAddPositionId] = useState("");
  const [addRole, setAddRole] = useState("EMPLOYER");

  const load = async () => {
    const [p, r, used, extra] = await Promise.all([loadActiveJobPositions(), loadVisibilityRules(), loadUsedJobPositionsByRole(), loadExtraIdentities()]);
    setPositions(p);
    setRules(r);
    setUsedByRole(used);
    setExtraIdentities(extra);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // پایه: «ادمین» (ثابت) + عناوینی که واقعاً حساب دارند + عناوینی که دستی اضافه شده‌اند
  const identities = [];
  const seen = new Set();
  const addIdentity = (role, jobPositionId, title) => {
    const key = `${role}-${jobPositionId}`;
    if (seen.has(key)) return;
    seen.add(key);
    identities.push({ role, jobPositionId, title });
  };
  addIdentity(ADMIN_IDENTITY.role, ADMIN_IDENTITY.jobPositionId, ADMIN_IDENTITY.title);
  positions.forEach((p) => {
    if (usedByRole.employerJobPositionIds.has(p.id)) addIdentity("EMPLOYER", p.id, p.title);
    if (usedByRole.contractorJobPositionIds.has(p.id)) addIdentity("CONTRACTOR", p.id, p.title);
  });
  extraIdentities.forEach((e) => {
    const pos = positions.find((p) => p.id === e.jobPositionId);
    if (pos) addIdentity(e.role, e.jobPositionId, pos.title);
  });

  const sameIdentity = (a, b) => a.role === b.role && a.jobPositionId === b.jobPositionId;

  const isBlocked = (a, b) => rules.some((r) =>
    (r.roleA === a.role && r.jobPositionIdA === a.jobPositionId && r.roleB === b.role && r.jobPositionIdB === b.jobPositionId) ||
    (r.roleA === b.role && r.jobPositionIdA === b.jobPositionId && r.roleB === a.role && r.jobPositionIdB === a.jobPositionId)
  );

  const toggleCell = async (a, b) => {
    const currentlyBlocked = isBlocked(a, b);
    setRules((prev) => (currentlyBlocked
      ? prev.filter((r) => !(
          (r.roleA === a.role && r.jobPositionIdA === a.jobPositionId && r.roleB === b.role && r.jobPositionIdB === b.jobPositionId) ||
          (r.roleA === b.role && r.jobPositionIdA === b.jobPositionId && r.roleB === a.role && r.jobPositionIdB === a.jobPositionId)
        ))
      : [...prev, { roleA: a.role, jobPositionIdA: a.jobPositionId, roleB: b.role, jobPositionIdB: b.jobPositionId }]));
    const result = await setVisibilityRule(a.role, a.jobPositionId, b.role, b.jobPositionId, !currentlyBlocked);
    if (result?.__error) { alert(result.message); await load(); }
  };

  const handleAddIdentity = async () => {
    if (!addPositionId) return;
    const result = await addExtraIdentity(addPositionId, addRole);
    if (result?.__error) { alert(result.message); return; }
    setAddPositionId("");
    setShowAdd(false);
    await load();
  };

  const handleRemoveExtra = async (jobPositionId, role) => {
    if (!confirm("این عنوان از ماتریس حذف شود؟ (قوانین بلاک ثبت‌شده برایش هم پاک می‌شود چون دیگر در جدول نیست)")) return;
    await removeExtraIdentity(jobPositionId, role);
    await load();
  };

  // آیا این هویت جزو «دستی‌اضافه‌شده»هاست (نه خودکار از روی حساب واقعی، نه خودِ ادمین)؟
  const isExtra = (id) => id.role !== "ADMIN" && extraIdentities.some((e) => e.jobPositionId === id.jobPositionId && e.role === id.role)
    && !((id.role === "EMPLOYER" && usedByRole.employerJobPositionIds.has(id.jobPositionId)) || (id.role === "CONTRACTOR" && usedByRole.contractorJobPositionIds.has(id.jobPositionId)));

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به مدیریت سیستم</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldOff size={20} color={THEME.teal} />
          <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>مدیریت دسترسی چت</h2>
        </div>
        <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowAdd((v) => !v)}>
          <Plus size={14} /> افزودن عنوان به ماتریس
        </button>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 14 }}>
        روی خانه‌ی تلاقی دو مورد کلیک کن تا آن‌ها نتوانند برای همدیگر «گفتگوی جدید» شروع کنند. «ادمین» یک ردیف/ستون ثابت است (چون معمولاً عنوان شغلی ندارد) و — برخلاف قبل — قابل‌بلاک‌شدن است. عناوینی که حساب واقعی دارند خودکار نشان داده می‌شوند؛ عناوینی که هنوز حسابی باهاشون نیست را می‌توانی با دکمه‌ی بالا دستی اضافه کنی.
      </p>

      {showAdd && (
        <div style={{ ...styles.card, width: "auto", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={styles.label}>عنوان شغلی</label>
            <select style={styles.input} value={addPositionId} onChange={(e) => setAddPositionId(e.target.value)} dir="rtl">
              <option value="">— انتخاب کنید —</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>سمت</label>
            <select style={styles.input} value={addRole} onChange={(e) => setAddRole(e.target.value)} dir="rtl">
              <option value="EMPLOYER">کارفرما</option>
              <option value="CONTRACTOR">پیمانکار</option>
            </select>
          </div>
          <button type="button" style={styles.button} onClick={handleAddIdentity} disabled={!addPositionId}>افزودن</button>
        </div>
      )}

      {identities.length < 2 && (
        <p style={{ color: THEME.text3, fontSize: 12.5 }}>برای تعریف قانون، حداقل به دو مورد در ماتریس نیاز است — از دکمه‌ی «افزودن عنوان به ماتریس» استفاده کن.</p>
      )}

      {identities.length >= 2 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", insetInlineStart: 0, background: THEME.surface, padding: "6px 10px", textAlign: "right", borderBottom: `1.5px solid ${THEME.border}`, whiteSpace: "nowrap" }} />
                {identities.map((id) => (
                  <th key={`${id.role}-${id.jobPositionId}`} style={{ padding: "6px 8px", borderBottom: `1.5px solid ${THEME.border}`, minWidth: 70 }}>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, color: THEME.text2, whiteSpace: "nowrap", margin: "0 auto", height: 110 }}>
                      {id.title} {id.role !== "ADMIN" ? `(${ROLE_LABEL[id.role]})` : ""}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {identities.map((rowId) => (
                <tr key={`${rowId.role}-${rowId.jobPositionId}`} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ position: "sticky", insetInlineStart: 0, background: THEME.surface, padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {rowId.title} {rowId.role !== "ADMIN" ? `(${ROLE_LABEL[rowId.role]})` : ""}
                    {isExtra(rowId) && (
                      <button type="button" onClick={() => handleRemoveExtra(rowId.jobPositionId, rowId.role)} title="حذف از ماتریس" style={{ background: "none", border: "none", cursor: "pointer", marginRight: 6, color: THEME.text3 }}>
                        <X size={11} />
                      </button>
                    )}
                  </td>
                  {identities.map((colId) => {
                    if (sameIdentity(rowId, colId)) {
                      return <td key={`${colId.role}-${colId.jobPositionId}`} style={{ padding: 2, textAlign: "center", background: "#f4f6f8" }} />;
                    }
                    const blocked = isBlocked(rowId, colId);
                    return (
                      <td key={`${colId.role}-${colId.jobPositionId}`} style={{ padding: 2, textAlign: "center" }}>
                        <div
                          onClick={() => toggleCell(rowId, colId)}
                          title={blocked ? "بلاک‌شده — کلیک برای رفع" : "کلیک برای بلاک‌کردن"}
                          style={{ width: 26, height: 26, margin: "0 auto", borderRadius: 5, cursor: "pointer", background: blocked ? THEME.danger : "#eef1f5", border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          {blocked && <X size={13} color="#fff" />}
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
  );
}
