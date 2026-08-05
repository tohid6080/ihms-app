import React, { useState, useEffect } from "react";
import { BarChart3, Users, Globe2, Radio, MonitorSmartphone, Chrome, MapPin, FileText } from "lucide-react";
import { SUPABASE_URL, THEME, styles } from "../shared.js";

// آدرس Edge Function — پروژه‌ی Supabase همان پروژه‌ی همیشگی است، فقط مسیر
// توابع (functions/v1/...) با REST API (rest/v1/...) فرق دارد.
const ANALYTICS_FN_URL = `${SUPABASE_URL}/functions/v1/ga4-analytics`;

/**
 * Admin → Analytics — real GA4 numbers, fetched through a Supabase Edge
 * Function that holds the Google service-account key server-side (see
 * supabase/functions/ga4-analytics). This page only ever talks to our own
 * Edge Function, never directly to Google, and never sees the service
 * account credentials.
 */
export default function AdminAnalytics({ onBack, currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ANALYTICS_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser?.username, password: currentUser?.password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error || "خطا در دریافت آمار"); setLoading(false); return; }
      setData(json);
    } catch (e) {
      setError("سرور آنالیتیکس در دسترس نیست — Edge Function را بررسی کنید");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <BarChart3 size={20} color={THEME.teal} />
        <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>آنالیتیکس (Google Analytics 4)</h2>
      </div>
      {data?.periodLabel && <p style={{ color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 18 }}>بازه‌ی زمانی: {data.periodLabel}</p>}

      {loading && <p style={{ color: THEME.text3, textAlign: "center", padding: "30px 0" }}>در حال دریافت آمار از Google Analytics...</p>}

      {!loading && error && (
        <div style={{ background: "#fdecec", border: `1px solid ${THEME.danger}`, borderRadius: 10, padding: 16 }}>
          <p style={{ color: THEME.danger, margin: 0, fontSize: 13 }}>{error}</p>
          <button type="button" style={{ ...styles.smallButton, marginTop: 10 }} onClick={load}>تلاش مجدد</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}`, overflow: "hidden", marginBottom: 14 }}>
            <StatBox icon={FileText} label="کل بازدیدها" value={data.totalVisits} />
            <StatBox icon={Users} label="بازدیدکنندگان یکتا" value={data.uniqueVisitors} />
            <StatBox icon={Users} label="کاربران فعال" value={data.activeUsers} />
            <StatBox icon={Radio} label="کاربران Realtime" value={data.realtimeUsers} color="#166534" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <Panel title="کشورها" icon={Globe2}><ListTable rows={data.countries} /></Panel>
            <Panel title="شهرها" icon={MapPin}><ListTable rows={data.cities} /></Panel>
            <Panel title="منابع ترافیک" icon={Globe2}><ListTable rows={data.trafficSources} valueLabel="نشست" /></Panel>
            <Panel title="دستگاه‌ها" icon={MonitorSmartphone}><ListTable rows={data.devices} /></Panel>
            <Panel title="مرورگرها" icon={Chrome}><ListTable rows={data.browsers} /></Panel>
            <Panel title="سیستم‌عامل‌ها" icon={MonitorSmartphone}><ListTable rows={data.operatingSystems} /></Panel>
            <Panel title="صفحات پربازدید" icon={FileText}><ListTable rows={data.topPages} valueLabel="بازدید" /></Panel>
            <Panel title="کاربران Realtime بر اساس کشور" icon={Radio}><ListTable rows={data.realtimeByCountry} /></Panel>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div style={{ flex: "1 1 140px", padding: "12px 16px", borderInlineEnd: `1px solid ${THEME.border}` }}>
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

function ListTable({ rows, valueLabel = "کاربر" }) {
  if (!rows || rows.length === 0) return <p style={{ fontSize: 11.5, color: THEME.text3, margin: 0 }}>داده‌ای موجود نیست</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: THEME.text2, marginBottom: 2 }}>
            <span dir="ltr" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160, textAlign: "right" }}>{r.label}</span>
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
