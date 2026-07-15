// ---------- ماژول مشترک ----------
// این فایل شامل چیزهایی است که هم App.jsx و هم ماژول‌های فرعی (مثل bowtie/)
// به آن نیاز دارند: اتصال Supabase، توکن‌های طراحی (THEME/styles) و چند تابع
// کمکی عمومی. جدا نگه‌داشتن این‌ها از App.jsx از وابستگی حلقوی (circular
// import) بین App.jsx و ماژول‌های فرعی جلوگیری می‌کند.

export const APP_NAME = "Integrated HSE Management System";

// نکته امنیتی: فقط از کلید publishable/anon استفاده می‌شود، هرگز کلید secret را
// داخل کد سمت مرورگر قرار ندهید چون هرکسی که اپ را باز کند می‌تواند آن را ببیند.
const SUPABASE_URL = "https://zmmxiyqlwkqjzghbcydi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PnB5Mp5wo_EOzJHa7HGwBQ_gqF1gvo0";

export async function sb(path, options = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Supabase error", res.status, text);
      return { __error: true, status: res.status, message: text || `HTTP ${res.status}` };
    }
    if (res.status === 204) return [];
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (e) {
    console.error("Supabase fetch failed", e);
    return { __error: true, status: 0, message: String((e && e.message) || e) };
  }
}

export function sbOk(rows) {
  return Array.isArray(rows);
}
export function sbErrMsg(rows) {
  if (rows && rows.__error) return rows.message;
  return "خطای نامشخص";
}

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- توکن‌های طراحی (پالت و تایپوگرافی سازمانی) ----------
export const THEME = {
  navy: "#0e2a3f",
  navyDeep: "#0a1f30",
  navyMid: "#123a54",
  teal: "#0d8f8a",
  tealDeep: "#0a7570",
  tealSoft: "#e3f5f4",
  bg: "#f2f5f8",
  surface: "#ffffff",
  border: "#e3e8ee",
  borderStrong: "#cbd5e1",
  text: "#152535",
  text2: "#5b6b7d",
  text3: "#93a1b0",
  danger: "#c92a2a",
  dangerBg: "#fdecec",
  font: "'Vazirmatn', 'Inter', Tahoma, Arial, sans-serif",
};

export const styles = {
  centerScreen: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: `radial-gradient(1100px 500px at 15% -10%, ${THEME.tealSoft} 0%, transparent 55%), linear-gradient(160deg, #f6f8fa 0%, #e9eef3 100%)`, fontFamily: THEME.font, padding: 20 },
  brandBadge: { width: 44, height: 44, borderRadius: 12, background: THEME.teal, display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: THEME.surface, padding: 30, borderRadius: 16, boxShadow: "0 1px 2px rgba(15,42,63,0.04), 0 12px 32px -12px rgba(15,42,63,0.14)", border: `1px solid ${THEME.border}`, width: 340, direction: "rtl", marginBottom: 14 },
  label: { display: "block", marginBottom: 6, marginTop: 16, fontSize: 13, fontWeight: 600, color: THEME.text2, letterSpacing: "0.01em" },
  input: { width: "100%", padding: "11px 13px", borderRadius: 9, border: `1.5px solid ${THEME.border}`, fontSize: 14.5, boxSizing: "border-box", fontFamily: THEME.font, color: THEME.text, background: "#fbfcfd", outline: "none", transition: "border-color .15s" },
  button: { width: "100%", marginTop: 24, padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(180deg, ${THEME.teal}, ${THEME.tealDeep})`, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 6px 16px -6px rgba(13,143,138,0.5)", fontFamily: THEME.font, letterSpacing: "0.01em" },
  smallButton: { padding: "9px 16px", borderRadius: 8, border: "none", background: THEME.navyMid, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font },
  error: { color: THEME.danger, fontSize: 13, marginTop: 12, marginBottom: 0, fontWeight: 500 },
  hint: { fontSize: 11.5, color: THEME.text3, marginTop: 18, textAlign: "center", direction: "ltr", letterSpacing: "0.02em" },
  dashboardWrapper: { direction: "rtl", fontFamily: THEME.font, minHeight: "100vh", background: THEME.bg },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(120deg, ${THEME.navy}, ${THEME.navyDeep})`, color: "#fff", padding: "18px 22px", boxShadow: "0 4px 18px -6px rgba(10,31,48,0.45)", position: "sticky", top: 0, zIndex: 20 },
  appNameTag: { fontSize: 10.5, opacity: 0.6, marginBottom: 3, direction: "ltr", textAlign: "right", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 },
  logoutButton: { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: THEME.font },
  menuList: { padding: "20px 18px 32px", display: "flex", flexDirection: "column", gap: 10, maxWidth: 520, margin: "0 auto" },
  menuList2: { display: "flex", flexDirection: "column", gap: 10 },
  menuCard: { background: THEME.surface, padding: "17px 18px", borderRadius: 13, boxShadow: "0 1px 2px rgba(15,42,63,0.04), 0 4px 14px -8px rgba(15,42,63,0.12)", border: `1px solid ${THEME.border}`, cursor: "pointer", fontSize: 14.5, fontWeight: 600, color: THEME.text, display: "flex", alignItems: "center" },
  anomalyMenuCard: { borderInlineStart: `3px solid ${THEME.teal}`, background: THEME.tealSoft },
  userRow: { background: THEME.surface, padding: "14px 18px", borderRadius: 12, border: `1px solid ${THEME.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14.5 },
  backLink: { cursor: "pointer", color: THEME.teal, marginBottom: 18, fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(78px, 1fr))", gap: 10, marginTop: 8 },
  statBox: { background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 13, padding: "14px 8px", textAlign: "center", boxShadow: "0 1px 2px rgba(15,42,63,0.03)" },
  statNum: { fontSize: 21, fontWeight: 700, color: THEME.navy, fontFamily: THEME.font },
  statLabel: { fontSize: 10.5, color: THEME.text3, marginTop: 3, fontWeight: 600 },
  filterBar: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" },
  filterSelect: { padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${THEME.border}`, fontSize: 13, background: THEME.surface, color: THEME.text, fontFamily: THEME.font },
  badge: { fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#eef1f5", color: THEME.text2, fontWeight: 600 },
  photoGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  photoThumbWrap: { position: "relative", width: 80, height: 80 },
  photoThumb: { width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: `1px solid ${THEME.border}`, cursor: "pointer" },
  photoRemoveBtn: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: THEME.danger, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  photoViewerOverlay: { position: "fixed", inset: 0, background: "rgba(10,20,30,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  photoViewerImg: { maxWidth: "100%", maxHeight: "90vh", borderRadius: 10 },
  photoViewerClose: { position: "absolute", top: 20, left: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
};
