import React, { useState, useEffect } from "react";
import { ShieldOff, X } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { loadActiveJobPositions } from "../jobpositions/jobPositionsApi.js";
import { loadVisibilityRules, setVisibilityRule, loadUsedJobPositionsByRole } from "./chatApi.js";

const ROLE_LABEL = { EMPLOYER: "کارفرما", CONTRACTOR: "پیمانکار" };

/**
 * "مدیریت دسترسی چت" — ماتریس (نقش + عنوان‌شغلی) × (نقش + عنوان‌شغلی).
 *
 * چرا نقش هم بخشی از هویته، نه فقط عنوان شغلی: یک عنوان شغلی مثل «سرپرست
 * کارگاه» می‌تواند هم سمت کارفرما (سرپرست کارگاهِ خودِ پروژه) هم سمت
 * پیمانکار (سرپرست کارگاهِ پیمانکار) استفاده شود — این دو نفر باید بتوانند
 * مستقل از هم بلاک شوند، وگرنه بلاک‌کردن «سرپرست کارگاه» یا هر دو طرف را
 * می‌گیرد یا هیچ‌کدام را (باگی که قبلاً همین‌جا وجود داشت).
 *
 * حساب‌های ادمین همیشه برای همه قابل‌مشاهده می‌مانند — عمداً در این ماتریس
 * نیستند.
 */
export default function ChatAccessManager({ onBack }) {
  const [positions, setPositions] = useState([]);
  const [rules, setRules] = useState([]);
  const [usedByRole, setUsedByRole] = useState({ employerJobPositionIds: new Set(), contractorJobPositionIds: new Set() });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [p, r, used] = await Promise.all([loadActiveJobPositions(), loadVisibilityRules(), loadUsedJobPositionsByRole()]);
    setPositions(p);
    setRules(r);
    setUsedByRole(used);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // هر عنوان شغلی فعال، فقط اگر واقعاً یک حساب واقعی با آن نقش وجودش داشته
  // باشد، به یک «هویت» تبدیل می‌شود — نه به‌صورت فرضی برای هر دو نقش.
  const identities = [];
  positions.forEach((p) => {
    if (usedByRole.employerJobPositionIds.has(p.id)) identities.push({ role: "EMPLOYER", jobPositionId: p.id, title: p.title });
    if (usedByRole.contractorJobPositionIds.has(p.id)) identities.push({ role: "CONTRACTOR", jobPositionId: p.id, title: p.title });
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

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به مدیریت سیستم</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <ShieldOff size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>مدیریت دسترسی چت</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginBottom: 18 }}>
        روی خانه‌ی تلاقی دو مورد کلیک کن تا آن‌ها نتوانند برای همدیگر «گفتگوی جدید» شروع کنند (گفتگوهای موجود، و چت‌های مرتبط با آنومالی/ریسک، تحت‌تأثیر این تنظیم نیستند). فقط عنوان‌های شغلی‌ای که واقعاً حداقل یک حساب کارفرما یا پیمانکار با آن‌ها ثبت شده نشان داده می‌شوند — اگر یک عنوان فقط سمت پیمانکار وجود دارد، نسخه‌ی کارفرمایش اینجا نمی‌آید. ادمین همیشه برای همه قابل‌مشاهده می‌ماند.
      </p>

      {identities.length < 2 && (
        <p style={{ color: THEME.text3, fontSize: 12.5 }}>برای تعریف قانون، حداقل به یک عنوان شغلی فعال (از «مدیریت عناوین شغلی») نیاز است.</p>
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
                      {id.title} ({ROLE_LABEL[id.role]})
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {identities.map((rowId) => (
                <tr key={`${rowId.role}-${rowId.jobPositionId}`} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ position: "sticky", insetInlineStart: 0, background: THEME.surface, padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {rowId.title} ({ROLE_LABEL[rowId.role]})
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
