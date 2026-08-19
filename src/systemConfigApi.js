import { sb, sbOk, getCurrentCompanyId } from "./shared.js";

/**
 * پیکربندی سامانه — سراسری (نه به‌ازای شرکت)، چون Super Admin «مالک کل
 * سامانه» است، نه یک شرکت خاص. این لایه هم از داخل SuperAdminPanel (برای
 * نوشتن) و هم از داخل App.jsx (برای خواندن و اعمال روی Sidebar/داشبورد
 * واقعی) استفاده می‌شود.
 */

// ---------- مدیریت ماژول‌ها ----------

export async function loadModuleConfig() {
  const rows = await sb("system_module_config?select=*&order=sort_order.asc");
  return sbOk(rows) ? rows.map((r) => ({
    moduleKey: r.module_key, displayLabel: r.display_label, description: r.description || "", sortOrder: r.sort_order,
  })) : [];
}

export async function saveModuleConfig(list, updatedBy) {
  const payload = list.map((m, idx) => ({
    module_key: m.moduleKey, display_label: m.displayLabel, description: m.description || null,
    sort_order: idx + 1, updated_at: new Date().toISOString(), updated_by: updatedBy || "",
  }));
  const rows = await sb("system_module_config?on_conflict=module_key", { method: "POST", body: JSON.stringify(payload), prefer: "resolution=merge-duplicates,return=representation" }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی تنظیمات ماژول‌ها" };
  return { ok: true };
}

// ---------- مدیریت داشبورد ----------

export async function loadDashboardConfig() {
  const rows = await sb("system_dashboard_config?select=*&order=sort_order.asc");
  return sbOk(rows) ? rows.map((r) => ({ kpiKey: r.kpi_key, sortOrder: r.sort_order, isVisible: r.is_visible !== false })) : [];
}

export async function saveDashboardConfig(list, updatedBy) {
  const payload = list.map((k, idx) => ({
    kpi_key: k.kpiKey, sort_order: idx + 1, is_visible: k.isVisible !== false,
    updated_at: new Date().toISOString(), updated_by: updatedBy || "",
  }));
  const rows = await sb("system_dashboard_config?on_conflict=kpi_key", { method: "POST", body: JSON.stringify(payload), prefer: "resolution=merge-duplicates,return=representation" }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی تنظیمات داشبورد" };
  return { ok: true };
}

// ---------- مدیریت اعلان‌ها ----------
// این رجیستری روی محاسبه‌ی زنده‌ی موجود اعلان‌ها (نه یک سیستم اعلان
// موازی) فیلتر می‌زند — نگاه کنید به classifyNotificationKey/
// filterSmartItemsByConfig در App.jsx.

export async function loadNotificationTypes() {
  const rows = await sb("system_notification_types?select=*&order=type_key.asc");
  return sbOk(rows) ? rows.map((r) => ({
    typeKey: r.type_key, label: r.label, description: r.description || "",
    isEnabled: r.is_enabled !== false, targetRole: r.target_role || "all",
    priority: r.priority || "medium", warningDays: r.warning_days,
  })) : [];
}

export async function saveNotificationType(typeKey, patch, updatedBy) {
  const payload = { updated_at: new Date().toISOString(), updated_by: updatedBy || "" };
  if ("isEnabled" in patch) payload.is_enabled = patch.isEnabled;
  if ("targetRole" in patch) payload.target_role = patch.targetRole;
  if ("priority" in patch) payload.priority = patch.priority;
  if ("warningDays" in patch) payload.warning_days = patch.warningDays;
  const rows = await sb(`system_notification_types?type_key=eq.${typeKey}`, { method: "PATCH", body: JSON.stringify(payload) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی تنظیمات اعلان" };
  return { ok: true };
}

// ---------- تنظیمات ظاهری ----------
// طبق الزام «از ساختارهای موجود استفاده کن»: هیچ جدول جدیدی ساخته
// نمی‌شود — از همان system_settings موجود (key-value، ساخته‌شده برای
// ظرفیت Storage) با پیشوند کلیدهای appearance_* استفاده می‌شود.

const APPEARANCE_KEYS = [
  "appearance_system_name", "appearance_system_title", "appearance_logo_url", "appearance_favicon_url",
  "appearance_color_primary", "appearance_color_accent", "appearance_theme_mode", "appearance_font_family",
  "appearance_font_size_base", "appearance_sidebar_default_collapsed", "appearance_header_show_company_name",
];

export async function loadAppearanceConfig() {
  const rows = await sb(`system_settings?key=in.(${APPEARANCE_KEYS.map((k) => `"${k}"`).join(",")})&select=key,value_text,value_numeric`);
  const map = {};
  if (sbOk(rows)) rows.forEach((r) => { map[r.key] = r.value_numeric != null ? r.value_numeric : r.value_text; });
  return {
    systemName: map.appearance_system_name || "IHMS",
    systemTitle: map.appearance_system_title || "سامانه مدیریت HSE",
    logoUrl: map.appearance_logo_url || "",
    faviconUrl: map.appearance_favicon_url || "",
    colorPrimary: map.appearance_color_primary || "#0e2a3f",
    colorAccent: map.appearance_color_accent || "#0d8f8a",
    themeMode: map.appearance_theme_mode || "light",
    fontFamily: map.appearance_font_family || "'Vazirmatn', 'Inter', Tahoma, Arial, sans-serif",
    fontSizeBase: map.appearance_font_size_base != null ? Number(map.appearance_font_size_base) : null,
    sidebarDefaultCollapsed: map.appearance_sidebar_default_collapsed === "true" || map.appearance_sidebar_default_collapsed === true,
    headerShowCompanyName: map.appearance_header_show_company_name !== "false" && map.appearance_header_show_company_name !== false,
  };
}

export async function saveAppearanceConfig(config, updatedBy) {
  const entries = [
    ["appearance_system_name", config.systemName, "text"],
    ["appearance_system_title", config.systemTitle, "text"],
    ["appearance_logo_url", config.logoUrl, "text"],
    ["appearance_favicon_url", config.faviconUrl, "text"],
    ["appearance_color_primary", config.colorPrimary, "text"],
    ["appearance_color_accent", config.colorAccent, "text"],
    ["appearance_theme_mode", config.themeMode, "text"],
    ["appearance_font_family", config.fontFamily, "text"],
    ["appearance_font_size_base", config.fontSizeBase, "numeric"],
    ["appearance_sidebar_default_collapsed", String(!!config.sidebarDefaultCollapsed), "text"],
    ["appearance_header_show_company_name", String(config.headerShowCompanyName !== false), "text"],
  ];
  const payload = entries.map(([key, value, kind]) => ({
    key,
    value_text: kind === "text" ? (value || null) : null,
    value_numeric: kind === "numeric" ? (value || null) : null,
    updated_at: new Date().toISOString(), updated_by: updatedBy || "",
  }));
  const rows = await sb("system_settings?on_conflict=key", { method: "POST", body: JSON.stringify(payload), prefer: "resolution=merge-duplicates,return=representation" }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی تنظیمات ظاهری" };
  return { ok: true };
}

// پالت کامل حالت تیره — چون سایه‌روشن یک تم واقعی به تغییر هم‌زمان
// پس‌زمینه/متن/حاشیه نیاز دارد، نه فقط دو رنگ اصلی؛ رنگ‌های سازمانی
// (primary/accent) کاربر همچنان از تنظیمات خودش می‌آید، نه از این پالت.
const DARK_PALETTE = {
  bg: "#0f1720", surface: "#17212c", border: "#26313d", borderStrong: "#374151",
  text: "#e5eaf0", text2: "#a7b3c2", text3: "#7c8a9a",
};
const LIGHT_PALETTE = {
  bg: "#f2f5f8", surface: "#ffffff", border: "#e3e8ee", borderStrong: "#cbd5e1",
  text: "#152535", text2: "#5b6b7d", text3: "#93a1b0",
};

// اعمال زنده‌ی تنظیمات ظاهری روی DOM — از طریق CSS Custom Properties، نه
// دستکاری مستقیم ماژول shared.js. با این روش، هیچ‌کدام از ~۹۸۵ ارجاع
// موجود به THEME.xxx در کل پروژه نیازی به تغییر ندارند: خودِ THEME در
// shared.js به‌جای رشته‌ی هگز ثابت، رشته‌ی var(--ihms-xxx, مقدار-پیش‌فرض)
// برمی‌گرداند؛ این تابع فقط مقدار واقعی آن متغیرهای CSS را ست می‌کند.
// اگر تنظیمی هنوز بارگذاری نشده/در دسترس نباشد، مقدار fallback داخل خودِ
// var() همان ظاهر فعلی و آشنای سامانه را حفظ می‌کند — بدون رگرسیون بصری.
export function applyAppearanceToDom(config) {
  if (typeof document === "undefined" || !config) return;
  const root = document.documentElement.style;
  const palette = config.themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  root.setProperty("--ihms-navy", config.colorPrimary || "#0e2a3f");
  root.setProperty("--ihms-teal", config.colorAccent || "#0d8f8a");
  root.setProperty("--ihms-bg", palette.bg);
  root.setProperty("--ihms-surface", palette.surface);
  root.setProperty("--ihms-border", palette.border);
  root.setProperty("--ihms-border-strong", palette.borderStrong);
  root.setProperty("--ihms-text", palette.text);
  root.setProperty("--ihms-text2", palette.text2);
  root.setProperty("--ihms-text3", palette.text3);
  if (config.fontFamily) root.setProperty("--ihms-font", config.fontFamily);
  if (config.fontSizeBase) root.setProperty("--ihms-font-size-base", `${config.fontSizeBase}px`);

  if (config.systemTitle) document.title = config.systemTitle;
  if (config.faviconUrl) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = config.faviconUrl;
  }
}

// ---------- اطلاعیه‌های سامانه ----------
// گسترش همان جدول موجود system_announcements (که تا امروز فقط از طریق
// «ارسال پیام سیستمی» نوشته می‌شد، بدون هیچ نمایشی) — نه یک جدول جدید.

function announcementFromRow(r) {
  return {
    id: r.id, companyId: r.company_id, title: r.title || "", message: r.message || "",
    iconKey: r.icon_key || "megaphone", buttonLabel: r.button_label || "", buttonUrl: r.button_url || "",
    startsAt: r.starts_at, endsAt: r.ends_at, priority: r.priority || 0,
    isActive: r.is_active !== false, createdAt: r.created_at,
  };
}

// طرف مشتری — فقط اطلاعیه‌ی فعال، در بازه‌ی زمانی جاری، و برای همین
// شرکت یا سراسری (company_id=null)؛ بین چند مورد واجد شرایط، بالاترین
// اولویت (و جدیدترین در تساوی) انتخاب می‌شود.
export async function loadActiveAnnouncement() {
  const companyId = getCurrentCompanyId();
  const nowIso = new Date().toISOString();
  const filter = companyId ? `&or=(company_id.is.null,company_id.eq.${companyId})` : "&company_id=is.null";
  const rows = await sb(`system_announcements?is_active=eq.true&select=*${filter}&order=priority.desc,created_at.desc`);
  if (!sbOk(rows)) return null;
  const eligible = rows.filter((r) => {
    if (r.starts_at && new Date(r.starts_at) > new Date(nowIso)) return false;
    if (r.ends_at && new Date(r.ends_at) < new Date(nowIso)) return false;
    return true;
  });
  return eligible.length > 0 ? announcementFromRow(eligible[0]) : null;
}

// طرف سوپرادمین — مدیریت کامل
export async function loadAllAnnouncements() {
  const rows = await sb("system_announcements?select=*&order=priority.desc,created_at.desc", {}, "super_admin");
  return sbOk(rows) ? rows.map(announcementFromRow) : [];
}

export async function createAnnouncement(rec, createdBy) {
  const payload = {
    company_id: rec.companyId || null, title: rec.title || null, message: rec.message,
    icon_key: rec.iconKey || "megaphone", button_label: rec.buttonLabel || null, button_url: rec.buttonUrl || null,
    starts_at: rec.startsAt || null, ends_at: rec.endsAt || null, priority: rec.priority || 0,
    is_active: rec.isActive !== false, updated_by: createdBy || "",
  };
  const rows = await sb("system_announcements", { method: "POST", body: JSON.stringify([payload]) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ثبت اطلاعیه" };
  return { ok: true };
}

export async function updateAnnouncement(id, rec, updatedBy) {
  const payload = {
    company_id: rec.companyId || null, title: rec.title || null, message: rec.message,
    icon_key: rec.iconKey || "megaphone", button_label: rec.buttonLabel || null, button_url: rec.buttonUrl || null,
    starts_at: rec.startsAt || null, ends_at: rec.endsAt || null, priority: rec.priority || 0,
    is_active: rec.isActive !== false, updated_at: new Date().toISOString(), updated_by: updatedBy || "",
  };
  const rows = await sb(`system_announcements?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(payload) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در ذخیره‌ی اطلاعیه" };
  return { ok: true };
}

export async function setAnnouncementActive(id, isActive, updatedBy) {
  const rows = await sb(`system_announcements?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ is_active: isActive, updated_at: new Date().toISOString(), updated_by: updatedBy || "" }) }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در تغییر وضعیت" };
  return { ok: true };
}

export async function deleteAnnouncement(id) {
  const rows = await sb(`system_announcements?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }, "super_admin");
  if (!sbOk(rows)) return { __error: true, message: "خطا در حذف اطلاعیه" };
  return { ok: true };
}
