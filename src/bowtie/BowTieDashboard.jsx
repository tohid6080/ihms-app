import React, { useState, useEffect } from "react";
import { Plus, Trash2, Search, ShieldCheck, GitBranch } from "lucide-react";
import { styles, THEME } from "../shared.js";
import {
  BOWTIE_STATUSES,
  bowtieStatusMeta,
  loadBowties,
  insertBowtie,
  updateBowtieDB,
  deleteBowtieDB,
} from "./bowtieApi.js";
import BowTieEditor from "./BowTieEditor.jsx";

/**
 * BowTie Risk Analysis — Dashboard (Phase 2).
 *
 * Scope: list + KPI counts + create/edit/delete BowTie records (metadata only).
 * The interactive diagram canvas is intentionally NOT built yet (Phase 3).
 * "Open canvas" is a placeholder button so the future entry point is visible
 * without pretending the feature exists yet.
 */
export default function BowTieDashboard({ onBack, currentUser, readOnly }) {
  const [openBowtie, setOpenBowtie] = useState(null);
  const [bowties, setBowties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [hazard, setHazard] = useState("");
  const [topEvent, setTopEvent] = useState("");
  const [site, setSite] = useState("");
  const [department, setDepartment] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    setBowties(await loadBowties());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = bowties.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${b.title} ${b.hazard} ${b.topEvent} ${b.site}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    total: bowties.length,
    draft: bowties.filter((b) => b.status === "draft").length,
    in_review: bowties.filter((b) => b.status === "in_review").length,
    approved: bowties.filter((b) => b.status === "approved").length,
  };

  const resetForm = () => {
    setTitle(""); setHazard(""); setTopEvent(""); setSite(""); setDepartment(""); setFormError("");
  };

  const handleCreate = async () => {
    if (!title.trim() || !hazard.trim() || !topEvent.trim()) {
      setFormError("عنوان، خطر (Hazard) و رویداد اصلی (Top Event) الزامی است");
      return;
    }
    setSaving(true);
    const inserted = await insertBowtie({
      title: title.trim(),
      hazard: hazard.trim(),
      topEvent: topEvent.trim(),
      site: site.trim(),
      department: department.trim(),
      createdBy: currentUser?.username || currentUser?.name || "",
    });
    setSaving(false);
    if (!inserted || inserted.__error) {
      setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`);
      return;
    }
    setBowties([inserted, ...bowties]);
    resetForm();
    setShowForm(false);
  };

  const startExpand = (b) => {
    if (expandedId === b.id) { setExpandedId(null); return; }
    setExpandedId(b.id);
    setEditData({
      title: b.title, hazard: b.hazard, topEvent: b.topEvent,
      site: b.site, department: b.department, status: b.status,
    });
  };

  const saveEdit = async (id) => {
    if (!editData.title?.trim() || !editData.hazard?.trim() || !editData.topEvent?.trim()) {
      alert("عنوان، خطر و رویداد اصلی نمی‌توانند خالی باشند");
      return;
    }
    setEditSaving(true);
    const updated = await updateBowtieDB(id, editData);
    setEditSaving(false);
    if (!updated || updated.__error) {
      alert(`خطا در ذخیره‌سازی: ${updated?.message || "نامشخص"}`);
      return;
    }
    setBowties(bowties.map((b) => (b.id === id ? updated : b)));
    setExpandedId(null);
  };

  const handleDelete = async (id, t) => {
    if (confirm(`آیا از حذف BowTie «${t}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`)) {
      await deleteBowtieDB(id);
      setBowties(bowties.filter((b) => b.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  if (openBowtie) {
    return <BowTieEditor bowtie={openBowtie} onBack={() => { setOpenBowtie(null); load(); }} readOnly={readOnly} />;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <ShieldCheck size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>BowTie Risk Analysis</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 18 }}>
        زیرماژول مدیریت ارزیابی ریسک — تحلیل خطرات به روش پروانه‌ای (BowTie)
      </p>

      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <div style={styles.statNum}>{counts.total}</div>
          <div style={styles.statLabel}>کل موارد</div>
        </div>
        <div style={{ ...styles.statBox, background: "#eef1f5" }}>
          <div style={{ ...styles.statNum, color: THEME.text2 }}>{counts.draft}</div>
          <div style={styles.statLabel}>پیش‌نویس</div>
        </div>
        <div style={{ ...styles.statBox, background: "#fef3c7" }}>
          <div style={{ ...styles.statNum, color: "#b45309" }}>{counts.in_review}</div>
          <div style={styles.statLabel}>در حال بررسی</div>
        </div>
        <div style={{ ...styles.statBox, background: "#dcfce7" }}>
          <div style={{ ...styles.statNum, color: "#166534" }}>{counts.approved}</div>
          <div style={styles.statLabel}>تأیید شده</div>
        </div>
      </div>

      {!readOnly && (
        <div
          style={{ ...styles.menuCard, background: THEME.teal, color: "#fff", justifyContent: "center", marginTop: 18 }}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={16} style={{ marginLeft: 6 }} />
          {showForm ? "بستن فرم" : "BowTie جدید"}
        </div>
      )}

      {showForm && !readOnly && (
        <div style={styles.card}>
          <label style={styles.label}>عنوان</label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} dir="rtl" placeholder="مثال: نشت گاز H2S در واحد فرآیندی" />

          <label style={styles.label}>خطر (Hazard)</label>
          <input style={styles.input} value={hazard} onChange={(e) => setHazard(e.target.value)} dir="rtl" placeholder="مثال: گاز سمی تحت فشار" />

          <label style={styles.label}>رویداد اصلی (Top Event)</label>
          <input style={styles.input} value={topEvent} onChange={(e) => setTopEvent(e.target.value)} dir="rtl" placeholder="مثال: رهاسازی ناگهانی گاز" />

          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>سایت / پروژه</label>
              <input style={styles.input} value={site} onChange={(e) => setSite(e.target.value)} dir="rtl" />
            </div>
            <div>
              <label style={styles.label}>واحد / دپارتمان</label>
              <input style={styles.input} value={department} onChange={(e) => setDepartment(e.target.value)} dir="rtl" />
            </div>
          </div>

          {formError && <p style={styles.error}>{formError}</p>}
          <button type="button" style={styles.button} onClick={handleCreate} disabled={saving}>
            {saving ? "در حال ثبت..." : "ثبت BowTie"}
          </button>
        </div>
      )}

      <div style={styles.filterBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, background: THEME.surface, borderRadius: 9, padding: "7px 11px", border: `1.5px solid ${THEME.border}` }}>
          <Search size={16} color={THEME.text3} />
          <input
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontFamily: THEME.font, background: "transparent" }}
            placeholder="جستجو (عنوان، خطر، رویداد، سایت)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir="rtl"
          />
        </div>
        <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} dir="rtl">
          <option value="all">همه وضعیت‌ها</option>
          {BOWTIE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <h3 style={{ marginTop: 20, fontSize: 15.5, color: THEME.navy, fontWeight: 700 }}>موارد ثبت‌شده ({filtered.length})</h3>
      {filtered.length === 0 && <p style={{ color: THEME.text3 }}>موردی یافت نشد.</p>}

      {filtered.map((b) => {
        const sm = bowtieStatusMeta(b.status);
        const isOpen = expandedId === b.id;
        return (
          <div key={b.id} style={{ ...styles.card, width: "auto", marginBottom: 12, borderInlineStart: `4px solid ${sm.color}`, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => startExpand(b)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: THEME.navy, fontSize: 14.5 }}>{b.title}</span>
                  <span style={{ ...styles.badge, color: sm.color, background: sm.bg }}>{sm.label}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: THEME.text }}>
                  <b style={{ color: THEME.text2 }}>خطر:</b> {b.hazard} &nbsp;·&nbsp; <b style={{ color: THEME.text2 }}>رویداد اصلی:</b> {b.topEvent}
                </div>
                <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 6, fontWeight: 500 }}>
                  {b.site && `${b.site}`} {b.department && `· ${b.department}`} {b.createdBy && `· ثبت توسط ${b.createdBy}`}
                </div>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${THEME.border}`, paddingTop: 16 }}>
                {readOnly ? (
                  <div style={{ fontSize: 13, color: THEME.text2, lineHeight: 1.9 }}>
                    <div><b>سایت/پروژه:</b> {b.site || "—"}</div>
                    <div><b>واحد/دپارتمان:</b> {b.department || "—"}</div>
                    <div><b>نسخه:</b> {b.version}</div>
                    <button
                      type="button"
                      style={{ ...styles.smallButton, background: THEME.navyMid, display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}
                      onClick={() => setOpenBowtie(b)}
                    >
                      <GitBranch size={14} /> مشاهده Canvas
                    </button>
                  </div>
                ) : (
                  <>
                    <label style={styles.label}>عنوان</label>
                    <input style={styles.input} value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} dir="rtl" />

                    <label style={styles.label}>خطر (Hazard)</label>
                    <input style={styles.input} value={editData.hazard} onChange={(e) => setEditData({ ...editData, hazard: e.target.value })} dir="rtl" />

                    <label style={styles.label}>رویداد اصلی (Top Event)</label>
                    <input style={styles.input} value={editData.topEvent} onChange={(e) => setEditData({ ...editData, topEvent: e.target.value })} dir="rtl" />

                    <div style={styles.formGrid}>
                      <div>
                        <label style={styles.label}>سایت / پروژه</label>
                        <input style={styles.input} value={editData.site} onChange={(e) => setEditData({ ...editData, site: e.target.value })} dir="rtl" />
                      </div>
                      <div>
                        <label style={styles.label}>واحد / دپارتمان</label>
                        <input style={styles.input} value={editData.department} onChange={(e) => setEditData({ ...editData, department: e.target.value })} dir="rtl" />
                      </div>
                    </div>

                    <label style={styles.label}>وضعیت</label>
                    <select style={styles.input} value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })} dir="rtl">
                      {BOWTIE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>

                    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                      <button type="button" style={styles.button} onClick={() => saveEdit(b.id)} disabled={editSaving}>
                        {editSaving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                      </button>
                      <button
                        type="button"
                        style={{ ...styles.smallButton, background: THEME.navyMid, display: "flex", alignItems: "center", gap: 6 }}
                        onClick={() => setOpenBowtie(b)}
                      >
                        <GitBranch size={14} /> باز کردن Canvas
                      </button>
                      <button type="button" style={{ ...styles.smallButton, background: THEME.danger }} onClick={() => handleDelete(b.id, b.title)}>
                        <Trash2 size={13} style={{ display: "inline", marginLeft: 4 }} />حذف
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
