import React, { useState, useEffect, useMemo } from "react";
import { Users, Filter } from "lucide-react";
import { THEME, styles } from "../shared.js";
import { JalaliDateInput, toJalaliSafe } from "../personnel/jalaliDate.jsx";
import { loadActivitySummary } from "./activityApi.js";

const ROLE_LABEL = { ADMIN: "ادمین", EMPLOYER: "کارفرما", CONTRACTOR: "پیمانکار" };

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
function formatDuration(ms) {
  if (ms === null || ms === undefined) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} دقیقه`;
  return `${h} ساعت و ${m} دقیقه`;
}

/**
 * یک ردیف رویداد لاگین را با اولین رویداد خروج بعد از آن (و قبل از لاگین
 * بعدی) جفت می‌کند تا مدت حضور واقعی هر نشست به دست بیاید. اگر کاربر بدون
 * زدن دکمه‌ی خروج، مرورگر را ببندد، آن نشست بدون تاریخ/ساعت خروج و بدون
 * مدت‌زمان نمایش داده می‌شود (نه یک عدد نادرست حدسی).
 */
function computeAttendance(rows) {
  const byUser = {};
  rows.forEach((r) => {
    if (!r.username) return;
    if (!byUser[r.username]) byUser[r.username] = { username: r.username, fullName: r.full_name || r.username, role: r.role || "", events: [], failedCount: 0 };
    if (r.event_type === "login" || r.event_type === "logout") byUser[r.username].events.push(r);
    if (r.event_type === "failed_login") byUser[r.username].failedCount += 1;
  });

  return Object.values(byUser).map((u) => {
    const sessions = [];
    let openLogin = null;
    u.events.forEach((e) => {
      if (e.event_type === "login") {
        if (openLogin) sessions.push({ login: openLogin, logout: null });
        openLogin = e;
      } else if (e.event_type === "logout" && openLogin) {
        sessions.push({ login: openLogin, logout: e });
        openLogin = null;
      }
    });
    if (openLogin) sessions.push({ login: openLogin, logout: null });

    const loginCount = u.events.filter((e) => e.event_type === "login").length;
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const durationMs = lastSession?.logout ? new Date(lastSession.logout.created_at) - new Date(lastSession.login.created_at) : null;

    return {
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      lastLoginAt: lastSession ? lastSession.login.created_at : null,
      lastLogoutAt: lastSession?.logout ? lastSession.logout.created_at : null,
      durationMs,
      loginCount,
      failedCount: u.failedCount,
    };
  }).sort((a, b) => (b.lastLoginAt || "").localeCompare(a.lastLoginAt || ""));
}

// فهرست جداگانه‌ی تلاش‌های ناموفق اخیر — چون ممکن است روی نام‌کاربری‌ای
// باشد که اصلاً هیچ‌وقت وارد نشده (پس در جدول حضور اصلاً ردیفی ندارد)
function computeRecentFailedAttempts(rows) {
  return rows
    .filter((r) => r.event_type === "failed_login")
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 20);
}

export default function AdminAnalytics({ onBack, currentUser }) {
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userFilter, setUserFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setRawRows(await loadActivitySummary(fromDate || undefined, toDate || undefined));
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const attendance = useMemo(() => computeAttendance(rawRows), [rawRows]);
  const recentFailed = useMemo(() => computeRecentFailedAttempts(rawRows), [rawRows]);

  const userOptions = useMemo(() => {
    const map = {};
    rawRows.forEach((r) => { if (r.username) map[r.username] = r.full_name || r.username; });
    return Object.entries(map).sort(([, a], [, b]) => a.localeCompare(b, "fa"));
  }, [rawRows]);

  const filtered = userFilter === "all" ? attendance : attendance.filter((a) => a.username === userFilter);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Users size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>حضور و فعالیت کاربران</h2>
      </div>
      <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 16 }}>میزان حضور هر کاربر در سامانه، بر اساس آخرین نشست ورود/خروج</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: 14 }}>
        <div>
          <label style={{ ...styles.label, display: "flex", alignItems: "center", gap: 4 }}><Filter size={12} /> کاربر</label>
          <select style={styles.filterSelect} value={userFilter} onChange={(e) => setUserFilter(e.target.value)} dir="rtl">
            <option value="all">همه کاربران</option>
            {userOptions.map(([username, name]) => <option key={username} value={username}>{name}</option>)}
          </select>
        </div>
        <div>
          <label style={styles.label}>از تاریخ</label>
          <JalaliDateInput value={fromDate} onChange={setFromDate} allowEmpty />
        </div>
        <div>
          <label style={styles.label}>تا تاریخ</label>
          <JalaliDateInput value={toDate} onChange={setToDate} allowEmpty />
        </div>
        <button type="button" style={styles.smallButton} onClick={load}>اعمال فیلتر</button>
      </div>

      {loading && <p style={{ color: THEME.text3, textAlign: "center", padding: 30 }}>در حال بارگذاری...</p>}

      {!loading && (
        <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${THEME.border}`, color: THEME.text3 }}>
                <th style={{ textAlign: "right", padding: "8px 10px" }}>نام کاربر</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>نقش</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>تاریخ آخرین ورود</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>ساعت ورود</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>تاریخ خروج</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>ساعت خروج</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>مدت حضور</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>تعداد دفعات ورود</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>تلاش ناموفق</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.username} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{a.fullName}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{ROLE_LABEL[a.role] || a.role || "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{toJalaliSafe(a.lastLoginAt) || "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{formatTime(a.lastLoginAt)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{a.lastLogoutAt ? toJalaliSafe(a.lastLogoutAt) : "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{a.lastLogoutAt ? formatTime(a.lastLogoutAt) : "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{formatDuration(a.durationMs)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700 }}>{a.loginCount}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: a.failedCount >= 3 ? THEME.danger : a.failedCount > 0 ? "#d97706" : THEME.text3 }}>{a.failedCount}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: THEME.text3 }}>در این بازه فعالیتی ثبت نشده است</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && recentFailed.length > 0 && (
        <div style={{ background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, marginTop: 16, padding: 14 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: THEME.navy, marginTop: 0, marginBottom: 10 }}>تلاش‌های ناموفق ورود اخیر</p>
          {recentFailed.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < recentFailed.length - 1 ? `1px solid ${THEME.border}` : "none", fontSize: 12 }}>
              <span style={{ color: THEME.text, fontWeight: 600 }}>{r.username}</span>
              <span style={{ color: THEME.text3 }}>{toJalaliSafe(r.created_at)} — {formatTime(r.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
