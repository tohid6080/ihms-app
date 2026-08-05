import React, { useState, useEffect, useMemo } from "react";
import { BarChart3, Users, Radio, FileText, History } from "lucide-react";
import { THEME, styles } from "../shared.js";
import { toJalaliDateTime } from "../personnel/jalaliDate.jsx";
import { loadActivitySummary } from "./activityApi.js";

const ROLE_LABEL = { ADMIN: "ادمین", EMPLOYER: "کارفرما", CONTRACTOR: "پیمانکار" };
const EVENT_LABEL = { login: "ورود", logout: "خروج", page_view: "بازدید صفحه" };
const ACTIVE_WINDOW_MIN = 15; // چند دقیقه‌ی اخیر «فعال الان» حساب می‌شود

/**
 * Admin → Activity Dashboard — reads directly from `user_activity`, the
 * same Supabase project everything else in IHMS already uses. No external
 * service, no secrets, no separate deployment step — this replaced an
 * earlier GA4-based version for exactly that reason.
 */
export default function AdminAnalytics({ onBack, currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setRows(await loadActivitySummary());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const dailyVisits = useMemo(() => {
    const map = {};
    rows.filter((r) => r.event_type === "login").forEach((r) => {
      const day = (r.created_at || "").slice(0, 10);
      if (!day) return;
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [rows]);

  const activeUsersNow = useMemo(() => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MIN * 60 * 1000;
    const seen = new Set();
    rows.forEach((r) => {
      if (new Date(r.created_at).getTime() >= cutoff && r.username) seen.add(r.username);
    });
    return seen.size;
  }, [rows]);

  const totalUsersInPeriod = useMemo(() => {
    const seen = new Set();
    rows.forEach((r) => { if (r.username) seen.add(r.username); });
    return seen.size;
  }, [rows]);

  const topPages = useMemo(() => {
    const map = {};
    rows.filter((r) => r.event_type === "page_view").forEach((r) => {
      const page = r.page || "—";
      map[page] = (map[page] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [rows]);

  const recent = rows.slice(0, 30);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <BarChart3 size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>داشبورد فعالیت کاربران</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 18 }}>بر اساس ۳۰ روز اخیر — تماماً از داده‌ی داخلی سامانه</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, overflow: "hidden", marginBottom: 14 }}>
        <StatBox icon={Users} label="کاربران این بازه" value={totalUsersInPeriod} />
        <StatBox icon={Radio} label={`فعال (${ACTIVE_WINDOW_MIN} دقیقه‌ی اخیر)`} value={activeUsersNow} color="#166534" />
        <StatBox icon={FileText} label="کل رویدادهای ثبت‌شده" value={rows.length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 12, marginBottom: 12 }}>
        <Panel title="بازدید روزانه (ورود کاربران، ۱۴ روز اخیر)" icon={BarChart3}>
          <MiniBarChart data={dailyVisits.map(([d, c]) => ({ label: d.slice(5), value: c }))} />
        </Panel>
        <Panel title="پرکاربردترین ماژول‌ها/صفحات" icon={FileText}>
          <ListTable rows={topPages} />
        </Panel>
      </div>

      <Panel title="فعالیت‌های اخیر کاربران" icon={History}>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                <th style={{ textAlign: "right", padding: "5px 6px" }}>کاربر</th>
                <th style={{ textAlign: "center", padding: "5px 6px" }}>نقش</th>
                <th style={{ textAlign: "center", padding: "5px 6px" }}>رویداد</th>
                <th style={{ textAlign: "center", padding: "5px 6px" }}>صفحه</th>
                <th style={{ textAlign: "center", padding: "5px 6px" }}>زمان</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ padding: "6px", fontWeight: 600 }}>{r.full_name || r.username || "—"}</td>
                  <td style={{ padding: "6px", textAlign: "center" }}>{ROLE_LABEL[r.role] || r.role || "—"}</td>
                  <td style={{ padding: "6px", textAlign: "center" }}>{EVENT_LABEL[r.event_type] || r.event_type}</td>
                  <td style={{ padding: "6px", textAlign: "center", color: THEME.text3 }}>{r.page || "—"}</td>
                  <td style={{ padding: "6px", textAlign: "center", color: THEME.text3 }}>{toJalaliDateTime(r.created_at)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: THEME.text3 }}>هنوز فعالیتی ثبت نشده است</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div style={{ flex: "1 1 160px", padding: "12px 16px", borderInlineEnd: `1px solid ${THEME.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: THEME.text3, marginBottom: 4 }}>
        <Icon size={12} />
        <span style={{ fontSize: 10.5, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || THEME.navy }}>{(value ?? 0).toLocaleString("fa-IR")}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon size={13} color={THEME.teal} />
        <h3 style={{ fontSize: 12.5, color: THEME.navy, fontWeight: 700, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MiniBarChart({ data }) {
  if (data.length === 0) return <p style={{ fontSize: 11, color: THEME.text3, margin: 0 }}>داده‌ای موجود نیست</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d) => (
        <div key={d.label} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: THEME.text2, marginBottom: 2 }}>
            <span>{d.label}</span>
            <span style={{ fontWeight: 700 }}>{d.value}</span>
          </div>
          <div style={{ background: "#eef1f5", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: THEME.navy }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListTable({ rows }) {
  if (!rows || rows.length === 0) return <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0 }}>داده‌ای موجود نیست</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: THEME.text2, marginBottom: 2 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{r.label}</span>
            <span style={{ fontWeight: 700 }}>{r.value.toLocaleString("fa-IR")}</span>
          </div>
          <div style={{ background: "#eef1f5", borderRadius: 4, height: 5, overflow: "hidden" }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", background: THEME.teal }} />
          </div>
        </div>
      ))}
    </div>
  );
}
