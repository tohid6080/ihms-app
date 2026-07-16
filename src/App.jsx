import React, { useState, useEffect } from "react";
import { AlertTriangle, Plus, X, ChevronRight, LogOut, Search, Filter, CheckCircle2, Clock, Camera, ImagePlus, Trash2, FileSpreadsheet, FileText, User, Users, ShieldCheck, LayoutGrid } from "lucide-react";
import * as XLSX from "xlsx";
import BowTieDashboard from "./bowtie/BowTieDashboard.jsx";
import { APP_NAME, sb, sbOk, sbErrMsg, uid, todayISO, THEME, styles } from "./shared.js";

/**
 * اپلیکیشن کارفرما / پیمانکار / ادمین + ماژول ثبت و پیگیری آنومالی HSE
 * داده‌ها روی دیتابیس واقعی Supabase (Postgres) ذخیره می‌شوند تا مستقل از artifact و پایدار بمانند.
 */

// ---------- نوع نقش‌ها ----------
// Role: "ADMIN" | "EMPLOYER" | "CONTRACTOR"

const SEED_USERS = [
  { id: "admin-1", username: "admin", password: "Admin@123", role: "ADMIN" },
  { id: "emp-1", username: "karfarma", password: "1234", role: "EMPLOYER" },
];

const RISK_LEVELS = [
  { value: "High", label: "بالا (High)", color: "#c92a2a", bg: "#fee2e2" },
  { value: "Med", label: "متوسط (Med)", color: "#d97706", bg: "#fef3c7" },
  { value: "Low", label: "پایین (Low)", color: "#16a34a", bg: "#dcfce7" },
];

const ANOMALY_CATEGORIES = [
  "ماشین آلات", "Hygiene", "Environment", "Lifting", "PPE", "Work at Height",
  "جوشکاری و برشکاری", "Scaffolding", "Excavation", "House Keeping", "Fire",
  "Lighting", "Electricity", "Meeting", "Access Way", "Permit",
];

const ANOMALY_FORMATS = [
  "بازرسی", "مدیریت تغییر", "عوامل زیان‌آور محیط کار", "ممیزی", "معاینات ادواری", "گزارش روزانه", "سایر",
];


// ترتیب ماژول‌های سامانه IHMS طبق نقشه‌ی راه پروژه.
// فقط "مدیریت عدم انطباق‌ها (Anomaly Report)" و "ایجاد حساب کاربری" فعلاً پیاده‌سازی شده‌اند؛
// بقیه به‌عنوان جای‌نگه‌دار (Placeholder) نمایش داده می‌شوند تا در فازهای بعدی توسعه یابند.
const HSE_MODULES = [
  { key: "profile", label: "پروفایل من" },
  { key: "manageUsers", label: "ایجاد حساب کاربری برای پیمانکاران", employerOnly: true },
  {
    key: "anomalyReport",
    label: "مدیریت عدم انطباق‌ها (Anomaly Report)",
    icon: true,
    sub: [
      { key: "anomalyForm", label: "ثبت آنومالی", employerOnly: true },
      { key: "anomalyList", label: "لیست آنومالی‌ها" },
    ],
  },
  { key: "incident", label: "مدیریت حوادث (Incident Management)" },
  { key: "nearMiss", label: "مدیریت شبه‌حوادث (Near Miss)" },
  { key: "capa", label: "مدیریت اقدامات اصلاحی و پیشگیرانه (CAPA)" },
  {
    key: "riskAssessment",
    label: "مدیریت ارزیابی ریسک (Risk Assessment)",
    icon: true,
    employerOnly: true,
    sub: [
      { key: "bowtieDashboard", label: "BowTie Risk Analysis" },
    ],
  },
  { key: "hazards", label: "مدیریت عوامل زیان‌آور محیط کار" },
  { key: "occupationalHealth", label: "مدیریت معاینات طب کار" },
  { key: "training", label: "مدیریت آموزش‌های HSE" },
  { key: "permit", label: "مدیریت مجوزهای کار (Permit to Work)" },
  { key: "ppe", label: "مدیریت تجهیزات حفاظت فردی (PPE)" },
  { key: "audit", label: "مدیریت ممیزی‌ها (Audit Management)" },
  { key: "kpi", label: "مدیریت شاخص‌های عملکرد HSE (KPI Dashboard)" },
  { key: "documents", label: "مدیریت مستندات HSE" },
  { key: "managerDashboard", label: "داشبورد مدیریتی و گزارش‌های تحلیلی" },
];

// ---------- لایه ذخیره‌سازی (Supabase REST API) ----------
// sb / sbOk / sbErrMsg اکنون در shared.js تعریف شده‌اند تا هم App.jsx و هم
// ماژول‌های فرعی (مثل bowtie/) بدون وابستگی حلقوی به آن‌ها دسترسی داشته باشند.

// حساب‌های ادمین و کارفرما ثابت هستند و مستقل از دیتابیس بررسی می‌شوند
// تا در صورت هر مشکلی در اتصال، ورود این دو نقش همیشه کار کند.
// دیتابیس فقط حساب‌های پیمانکار (که توسط ادمین/کارفرما ساخته می‌شوند) را نگه می‌دارد.
function contractorFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date || "",
    contractDetails: r.contract_details || "",
    username: r.username || "",
    password: r.password || "",
    role: "CONTRACTOR",
  };
}

async function loadContractors() {
  const rows = await sb("contractors?select=*&order=name.asc");
  return (sbOk(rows) ? rows : []).map(contractorFromRow);
}
async function insertContractor(rec) {
  const rows = await sb("contractors", {
    method: "POST",
    body: JSON.stringify([{ name: rec.name, start_date: rec.startDate || null, contract_details: rec.contractDetails, username: rec.username, password: rec.password }]),
  });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return contractorFromRow(rows[0]);
}
async function updateContractorDB(id, patch) {
  const dbPatch = {};
  if ("name" in patch) dbPatch.name = patch.name;
  if ("startDate" in patch) dbPatch.start_date = patch.startDate || null;
  if ("contractDetails" in patch) dbPatch.contract_details = patch.contractDetails;
  if ("username" in patch) dbPatch.username = patch.username;
  if ("password" in patch) dbPatch.password = patch.password;
  const rows = await sb(`contractors?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return contractorFromRow(rows[0]);
}
async function deleteContractorDB(id) {
  await sb(`contractors?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

// ---------- حساب‌های کارفرما/همکاران (ایجادشده توسط ادمین، با سطح دسترسی قابل‌تنظیم) ----------
function employerAccountFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    password: r.password,
    canEdit: r.can_edit !== false,
    role: "EMPLOYER",
  };
}

async function loadEmployerAccounts() {
  const rows = await sb("employer_accounts?select=*&order=name.asc");
  return (sbOk(rows) ? rows : []).map(employerAccountFromRow);
}
async function insertEmployerAccount(rec) {
  const rows = await sb("employer_accounts", {
    method: "POST",
    body: JSON.stringify([{ name: rec.name, username: rec.username, password: rec.password, can_edit: rec.canEdit }]),
  });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return employerAccountFromRow(rows[0]);
}
async function updateEmployerAccountDB(id, patch) {
  const dbPatch = {};
  if ("name" in patch) dbPatch.name = patch.name;
  if ("username" in patch) dbPatch.username = patch.username;
  if ("password" in patch) dbPatch.password = patch.password;
  if ("canEdit" in patch) dbPatch.can_edit = patch.canEdit;
  const rows = await sb(`employer_accounts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return employerAccountFromRow(rows[0]);
}
async function deleteEmployerAccountDB(id) {
  await sb(`employer_accounts?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

function anomalyFromRow(r) {
  return {
    id: r.id,
    trackingNumber: r.tracking_number || "",
    project: r.project || "",
    contractor: r.contractor || "",
    subContractor: r.sub_contractor || "",
    area: r.area || "",
    date: r.date || "",
    time: r.time || "",
    riskLevel: r.risk_level || "Med",
    category: r.category || "",
    format: r.format || "",
    description: r.description || "",
    correctiveAction: r.corrective_action || "",
    obstacles: r.obstacles || "",
    follower: r.follower || "",
    sender: r.sender || "",
    status: r.status || "open",
    closeDate: r.close_date || "",
    effectiveness: r.effectiveness || "",
    photoCount: r.photo_count || 0,
    contractorAction: r.contractor_action || "",
    reviewNote: r.review_note || "",
    createdAt: r.created_at,
  };
}

async function loadAnomalies() {
  const rows = await sb("anomalies?select=*&order=created_at.desc");
  return (sbOk(rows) ? rows : []).map(anomalyFromRow);
}

async function insertAnomaly(record) {
  const body = [{
    id: record.id,
    tracking_number: record.trackingNumber,
    project: record.project,
    contractor: record.contractor,
    sub_contractor: record.subContractor,
    area: record.area,
    date: record.date || null,
    time: record.time,
    risk_level: record.riskLevel,
    category: record.category,
    format: record.format,
    description: record.description,
    corrective_action: record.correctiveAction,
    obstacles: record.obstacles,
    follower: record.follower,
    sender: record.sender,
    status: record.status,
    close_date: record.closeDate || null,
    effectiveness: record.effectiveness,
    photo_count: record.photoCount,
  }];
  const rows = await sb("anomalies", { method: "POST", body: JSON.stringify(body) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return rows[0];
}

async function updateAnomalyDB(id, patch) {
  const dbPatch = {};
  if ("correctiveAction" in patch) dbPatch.corrective_action = patch.correctiveAction;
  if ("obstacles" in patch) dbPatch.obstacles = patch.obstacles;
  if ("follower" in patch) dbPatch.follower = patch.follower;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("closeDate" in patch) dbPatch.close_date = patch.closeDate || null;
  if ("effectiveness" in patch) dbPatch.effectiveness = patch.effectiveness;
  if ("photoCount" in patch) dbPatch.photo_count = patch.photoCount;
  if ("contractorAction" in patch) dbPatch.contractor_action = patch.contractorAction;
  if ("reviewNote" in patch) dbPatch.review_note = patch.reviewNote;
  await sb(`anomalies?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch), prefer: "return=minimal" });
}

async function deleteAnomalyDB(id) {
  await sb(`anomalies?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

async function loadAnomalyPhotos(anomalyId) {
  const rows = await sb(`anomaly_photos?anomaly_id=eq.${anomalyId}&select=id,photo,stage&order=created_at.asc`);
  return sbOk(rows) ? rows : [];
}
async function insertAnomalyPhotos(anomalyId, photosArray, stage = "report") {
  if (!photosArray.length) return;
  const body = photosArray.map((p) => ({ anomaly_id: anomalyId, photo: p, stage }));
  await sb("anomaly_photos", { method: "POST", body: JSON.stringify(body), prefer: "return=minimal" });
}
async function deleteAnomalyPhotoDB(photoId) {
  await sb(`anomaly_photos?id=eq.${photoId}`, { method: "DELETE", prefer: "return=minimal" });
}

// uid / todayISO اکنون در shared.js تعریف شده‌اند.

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- تبدیل تاریخ میلادی <-> شمسی (بدون نیاز به کتابخانه خارجی) ----------
function isLeapJalaliYear(jy) {
  return (((jy - (jy > 0 ? 474 : 473)) % 2820 + 474 + 38) * 682) % 2816 < 682;
}

function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

function gregorianToJalali(gy, gm, gd) {
  const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy3 = gm > 2 ? gy2 + 1 : gy2;
  let days = 365 * gy2 + Math.floor((gy3 + 3) / 4) - Math.floor((gy3 + 99) / 100) + Math.floor((gy3 + 399) / 400) - 80 + gd + gDaysInMonth[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

function jalaliToGregorian(jy, jm, jd) {
  let gy = jy <= 979 ? 621 : 1600;
  const jy2 = jy <= 979 ? jy : jy - 979;
  let days = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor((days - 1) / 36524);
    days = (days - 1) % 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const gd = days + 1;
  const isGLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const gMonthLen = [0, 31, isGLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  let rem = gd;
  while (gm <= 12 && rem > gMonthLen[gm]) {
    rem -= gMonthLen[gm];
    gm++;
  }
  return [gy, gm, rem];
}

function todayJalaliParts() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function isoToJalali(iso) {
  if (!iso) return null;
  const [gy, gm, gd] = iso.split("-").map(Number);
  if (!gy) return null;
  return gregorianToJalali(gy, gm, gd);
}

function isoToJalaliDisplay(iso) {
  const p = isoToJalali(iso);
  if (!p) return "";
  return `${p[0]}/${String(p[1]).padStart(2, "0")}/${String(p[2]).padStart(2, "0")}`;
}

const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

// انتخاب‌گر تاریخ شمسی (سه select: سال/ماه/روز) — مقدار ورودی/خروجی ISO میلادی (yyyy-mm-dd) برای سازگاری با دیتابیس
function JalaliDateInput({ value, onChange }) {
  const todayParts = todayJalaliParts();
  const parsed = isoToJalali(value);
  const jy = parsed ? parsed[0] : todayParts[0];
  const jm = parsed ? parsed[1] : todayParts[1];
  const jd = parsed ? parsed[2] : todayParts[2];

  useEffect(() => {
    if (!value) {
      const [gy, gm, gd] = jalaliToGregorian(todayParts[0], todayParts[1], todayParts[2]);
      onChange(`${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years = [];
  for (let y = todayParts[0] - 6; y <= todayParts[0] + 2; y++) years.push(y);
  const dayCount = jalaliMonthLength(jy, jm);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const emit = (ny, nm, nd) => {
    const maxD = jalaliMonthLength(ny, nm);
    const safeD = Math.min(nd, maxD);
    const [gy, gm, gd] = jalaliToGregorian(ny, nm, safeD);
    onChange(`${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`);
  };

  return (
    <div style={{ display: "flex", gap: 6 }} dir="rtl">
      <select style={{ ...styles.input, flex: 1.2 }} value={jy} onChange={(e) => emit(Number(e.target.value), jm, jd)}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select style={{ ...styles.input, flex: 1.4 }} value={jm} onChange={(e) => emit(jy, Number(e.target.value), jd)}>
        {JALALI_MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
      </select>
      <select style={{ ...styles.input, flex: 1 }} value={jd} onChange={(e) => emit(jy, jm, Number(e.target.value))}>
        {days.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  );
}

// ---------- خروجی گزارش (Excel / PDF) ----------
function statusLabelFa(status) {
  if (status === "Closed") return "بسته";
  if (status === "pending_review") return "در انتظار تأیید";
  return "باز";
}

function anomalyExportRows(list) {
  return list.map((a, idx) => ({
    "ردیف": idx + 1,
    "شماره پیگیری": a.trackingNumber,
    "تاریخ": isoToJalaliDisplay(a.date),
    "ناحیه": a.area,
    "پیمانکار": a.contractor,
    "دسته‌بندی": a.category,
    "سطح ریسک": a.riskLevel,
    "وضعیت": statusLabelFa(a.status),
    "شرح آنومالی": a.description,
    "اقدام پیمانکار": a.contractorAction || "",
    "تاریخ بسته شدن": a.closeDate ? isoToJalaliDisplay(a.closeDate) : "",
  }));
}

function exportAnomaliesExcel(list, title) {
  const rows = anomalyExportRows(list);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 36 }, { wch: 30 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Anomalies");
  XLSX.writeFile(wb, `${title}.xlsx`);
}

function escapeHtml(s) {
  return String(s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

function exportAnomaliesPdf(list, title) {
  const win = window.open("", "_blank");
  if (!win) { alert("اجازه‌ی باز شدن پنجره‌ی جدید داده نشد؛ لطفاً popup blocker مرورگر را غیرفعال کنید."); return; }
  const headers = ["ردیف", "شماره پیگیری", "تاریخ", "ناحیه", "پیمانکار", "دسته‌بندی", "سطح ریسک", "وضعیت", "شرح آنومالی", "اقدام پیمانکار", "تاریخ بسته شدن"];
  const bodyRows = anomalyExportRows(list)
    .map((r) => `<tr>${Object.values(r).map((v) => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; direction: rtl; padding: 20px; color: #111; }
    h2 { text-align: center; margin-bottom: 4px; }
    p.meta { text-align: center; color: #666; font-size: 12px; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 16px; }
    th, td { border: 1px solid #e3e8ee; padding: 5px; text-align: right; vertical-align: top; }
    th { background: #f1f5f9; }
    @media print { @page { size: landscape; margin: 12mm; } }
  </style></head>
  <body>
    <h2>${escapeHtml(title)}</h2>
    <p class="meta">${APP_NAME} — تعداد موارد: ${list.length}</p>
    <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table>
  </body></html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}


function resizeImageFile(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("فایل تصویر معتبر نیست"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- صفحه ورود ----------
// ---------- لوگوی سامانه (نشان IHMS با سیلوئت نیروگاه در پس‌زمینه) ----------
function IhmsLogo({ size = 96 }) {
  return (
    <img
    src={`${import.meta.env.BASE_URL}logo.png`}
      alt="IHMS Logo"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    // ابتدا حساب‌های ثابت ادمین/کارفرما بررسی می‌شوند (بدون نیاز به storage)
    const seedMatch = SEED_USERS.find((u) => u.username === username.trim() && u.password === password);
    if (seedMatch) {
      setLoading(false);
      setError("");
      onLogin({ ...seedMatch, canEdit: true, name: seedMatch.role === "EMPLOYER" ? "کارفرما (حساب اصلی)" : seedMatch.username });
      return;
    }

    // سپس حساب‌های کارفرما/همکاران که ادمین ایجاد کرده بررسی می‌شوند
    const employerAccounts = await loadEmployerAccounts();
    const employerMatch = employerAccounts.find((u) => u.username === username.trim() && u.password === password);
    if (employerMatch) {
      setLoading(false);
      setError("");
      onLogin(employerMatch);
      return;
    }

    // سپس حساب‌های پیمانکار که در دیتابیس ذخیره شده‌اند بررسی می‌شوند
    const contractors = await loadContractors();
    const found = contractors.find((u) => u.username && u.username === username.trim() && u.password === password);
    setLoading(false);
    if (found) {
      setError("");
      onLogin(found);
    } else {
      setError("نام کاربری یا رمز عبور اشتباه است");
    }
  };

  return (
    <div style={styles.centerScreen}>
      <div style={{ ...styles.card, width: 360 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <IhmsLogo size={120} />
        </div>
        <h2 style={{ textAlign: "center", marginBottom: 2, fontSize: 18, direction: "ltr", color: THEME.navy, fontWeight: 700, letterSpacing: "-0.01em" }}>{APP_NAME}</h2>
        <p style={{ textAlign: "center", color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 22, fontWeight: 500 }}>
          ورود به سامانه
        </p>

        <label style={styles.label}>نام کاربری</label>
        <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} dir="rtl" />

        <label style={styles.label}>رمز عبور</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          dir="rtl"
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="button" style={{ ...styles.button, opacity: loading ? 0.75 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? "در حال بررسی..." : "ورود"}
        </button>

        <p style={styles.hint}>Designed by: Tohid Mirasadi</p>
      </div>
    </div>
  );
}

// ---------- پروفایل کاربر ----------
function ProfileView({ onBack, currentUser, roleLabel }) {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <IhmsLogo size={80} />
        </div>
        <h3 style={{ textAlign: "center", marginBottom: 4 }}>{currentUser?.username}</h3>
        <p style={{ textAlign: "center", color: "#93a1b0", fontSize: 13, marginTop: 0 }}>{roleLabel}</p>
        <p style={{ textAlign: "center", color: "#aaa", fontSize: 11, marginTop: 20, direction: "ltr" }}>{APP_NAME}</p>
      </div>
    </div>
  );
}

// ---------- مدیریت یکپارچه پیمانکاران (اطلاعات شرکت + حساب کاربری ورود) ----------
function ContractorManager({ onBack }) {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [contractDetails, setContractDetails] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    (async () => {
      setContractors(await loadContractors());
      setLoading(false);
    })();
  }, []);

  const usernameTaken = (uname, excludeId) =>
    SEED_USERS.some((u) => u.username === uname) || contractors.some((c) => c.username === uname && c.id !== excludeId);

  const handleAdd = async () => {
    const uname = username.trim();
    if (!name.trim() || !uname || !password) { setFormError("نام پیمانکار، نام کاربری و رمز عبور الزامی است"); return; }
    if (usernameTaken(uname, null)) { setFormError("این نام کاربری قبلاً استفاده شده است"); return; }
    const inserted = await insertContractor({ name: name.trim(), startDate, contractDetails: contractDetails.trim(), username: uname, password });
    if (!inserted || inserted.__error) { setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`); return; }
    setContractors([...contractors, inserted]);
    setName(""); setStartDate(""); setContractDetails(""); setUsername(""); setPassword(""); setFormError(""); setShowForm(false);
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditData({ name: c.name, startDate: c.startDate, contractDetails: c.contractDetails, username: c.username, password: c.password });
  };
  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async (id) => {
    const uname = (editData.username || "").trim();
    if (!editData.name?.trim() || !uname || !editData.password) { alert("نام پیمانکار، نام کاربری و رمز عبور نمی‌توانند خالی باشند"); return; }
    if (usernameTaken(uname, id)) { alert("این نام کاربری قبلاً برای پیمانکار دیگری استفاده شده است"); return; }
    const updated = await updateContractorDB(id, { ...editData, name: editData.name.trim(), username: uname });
    if (!updated || updated.__error) { alert(`خطا در ذخیره‌سازی: ${updated?.message || "نامشخص"}`); return; }
    setContractors(contractors.map((c) => (c.id === id ? updated : c)));
    cancelEdit();
  };

  const handleDelete = async (id, name) => {
    if (confirm(`آیا از حذف پیمانکار «${name}» مطمئن هستید؟`)) {
      await deleteContractorDB(id);
      setContractors(contractors.filter((c) => c.id !== id));
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#93a1b0" }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={{ ...styles.menuCard, background: "#0d8f8a", color: "#fff", textAlign: "center" }} onClick={() => setShowForm((v) => !v)}>
        {showForm ? "بستن فرم" : "+ افزودن پیمانکار جدید"}
      </div>

      {showForm && (
        <div style={styles.card}>
          <label style={styles.label}>نام پیمانکار</label>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} dir="rtl" placeholder="همین نام در لیست کشویی «پیمانکار» فرم آنومالی نشان داده می‌شود" />
          <label style={styles.label}>تاریخ شروع به کار</label>
          <JalaliDateInput value={startDate} onChange={setStartDate} />
          <label style={styles.label}>مشخصات قرارداد</label>
          <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={contractDetails} onChange={(e) => setContractDetails(e.target.value)} dir="rtl" />
          <label style={styles.label}>نام کاربری (برای ورود پیمانکار به سامانه)</label>
          <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} dir="rtl" />
          <label style={styles.label}>رمز عبور</label>
          <input style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} dir="rtl" />
          {formError && <p style={styles.error}>{formError}</p>}
          <button type="button" style={styles.button} onClick={handleAdd}>افزودن پیمانکار</button>
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>پیمانکاران ثبت‌شده ({contractors.length})</h3>
      {contractors.length === 0 && <p style={{ color: "#93a1b0" }}>هنوز هیچ پیمانکاری ثبت نشده است.</p>}

      {contractors.map((c) =>
        editingId === c.id ? (
          <div key={c.id} style={styles.card}>
            <label style={styles.label}>نام پیمانکار</label>
            <input style={styles.input} value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} dir="rtl" />
            <label style={styles.label}>تاریخ شروع به کار</label>
            <JalaliDateInput value={editData.startDate} onChange={(v) => setEditData({ ...editData, startDate: v })} />
            <label style={styles.label}>مشخصات قرارداد</label>
            <textarea style={{ ...styles.input, minHeight: 70, fontFamily: "inherit" }} value={editData.contractDetails} onChange={(e) => setEditData({ ...editData, contractDetails: e.target.value })} dir="rtl" />
            <label style={styles.label}>نام کاربری</label>
            <input style={styles.input} value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} dir="rtl" />
            <label style={styles.label}>رمز عبور</label>
            <input style={styles.input} value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} dir="rtl" />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" style={styles.button} onClick={() => saveEdit(c.id)}>ذخیره</button>
              <button type="button" style={{ ...styles.button, background: "#5b6b7d" }} onClick={cancelEdit}>انصراف</button>
            </div>
          </div>
        ) : (
          <div key={c.id} style={{ ...styles.card, width: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: "bold", fontSize: 16 }}>{c.name}</div>
                {c.startDate && <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>تاریخ شروع: {isoToJalaliDisplay(c.startDate)}</div>}
                {c.contractDetails && <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>قرارداد: {c.contractDetails}</div>}
                <div style={{ fontSize: 13, color: "#0d8f8a", marginTop: 4, direction: "ltr", textAlign: "right" }}>یوزر: {c.username}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={styles.smallButton} onClick={() => startEdit(c)}>تغییر</button>
                <button type="button" style={{ ...styles.smallButton, background: "#c92a2a" }} onClick={() => handleDelete(c.id, c.name)}>حذف</button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---------- مدیریت حساب‌های کارفرما/همکاران (فقط ادمین) ----------
function EmployerAccountManager({ onBack }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [canEdit, setCanEdit] = useState(true);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    (async () => {
      setAccounts(await loadEmployerAccounts());
      setLoading(false);
    })();
  }, []);

  const usernameTaken = (uname, excludeId) =>
    SEED_USERS.some((u) => u.username === uname) || accounts.some((a) => a.username === uname && a.id !== excludeId);

  const handleAdd = async () => {
    const uname = username.trim();
    if (!name.trim() || !uname || !password) { setFormError("نام، نام کاربری و رمز عبور الزامی است"); return; }
    if (usernameTaken(uname, null)) { setFormError("این نام کاربری قبلاً استفاده شده است"); return; }
    const inserted = await insertEmployerAccount({ name: name.trim(), username: uname, password, canEdit });
    if (!inserted || inserted.__error) { setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`); return; }
    setAccounts([...accounts, inserted]);
    setName(""); setUsername(""); setPassword(""); setCanEdit(true); setFormError(""); setShowForm(false);
  };

  const startEdit = (a) => { setEditingId(a.id); setEditData({ name: a.name, username: a.username, password: a.password, canEdit: a.canEdit }); };
  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async (id) => {
    const uname = (editData.username || "").trim();
    if (!editData.name?.trim() || !uname || !editData.password) { alert("نام، نام کاربری و رمز عبور نمی‌توانند خالی باشند"); return; }
    if (usernameTaken(uname, id)) { alert("این نام کاربری قبلاً برای حساب دیگری استفاده شده است"); return; }
    const updated = await updateEmployerAccountDB(id, { ...editData, name: editData.name.trim(), username: uname });
    if (!updated || updated.__error) { alert(`خطا در ذخیره‌سازی: ${updated?.message || "نامشخص"}`); return; }
    setAccounts(accounts.map((a) => (a.id === id ? updated : a)));
    cancelEdit();
  };

  const handleDelete = async (id, name) => {
    if (confirm(`آیا از حذف حساب «${name}» مطمئن هستید؟`)) {
      await deleteEmployerAccountDB(id);
      setAccounts(accounts.filter((a) => a.id !== id));
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#93a1b0" }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <p style={{ color: "#93a1b0", fontSize: 13 }}>حساب‌هایی که اینجا می‌سازی، نقش «کارفرما» دارند و می‌توانند وارد سامانه شوند. سطح دسترسی هرکدام را خودت مشخص می‌کنی.</p>

      <div style={{ ...styles.menuCard, background: "#0d8f8a", color: "#fff", textAlign: "center" }} onClick={() => setShowForm((v) => !v)}>
        {showForm ? "بستن فرم" : "+ افزودن حساب کارفرما/همکار جدید"}
      </div>

      {showForm && (
        <div style={styles.card}>
          <label style={styles.label}>نام / عنوان</label>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} dir="rtl" />
          <label style={styles.label}>نام کاربری</label>
          <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} dir="rtl" />
          <label style={styles.label}>رمز عبور</label>
          <input style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} dir="rtl" />
          <label style={styles.label}>سطح دسترسی</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" onClick={() => setCanEdit(true)} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: canEdit ? "2px solid #0d8f8a" : "1px solid #e3e8ee", background: canEdit ? "#e3f5f4" : "#fff", color: "#0d8f8a", fontSize: 13, cursor: "pointer", fontWeight: canEdit ? "bold" : "normal" }}>دسترسی کامل (ثبت و تأیید)</button>
            <button type="button" onClick={() => setCanEdit(false)} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: !canEdit ? "2px solid #123a54" : "1px solid #e3e8ee", background: !canEdit ? "#f1f5f9" : "#fff", color: "#334155", fontSize: 13, cursor: "pointer", fontWeight: !canEdit ? "bold" : "normal" }}>فقط مشاهده</button>
          </div>
          {formError && <p style={styles.error}>{formError}</p>}
          <button type="button" style={styles.button} onClick={handleAdd}>افزودن حساب</button>
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>حساب‌های ثبت‌شده ({accounts.length})</h3>
      {accounts.length === 0 && <p style={{ color: "#93a1b0" }}>هنوز هیچ حسابی اضافه نشده است.</p>}

      {accounts.map((a) =>
        editingId === a.id ? (
          <div key={a.id} style={styles.card}>
            <label style={styles.label}>نام / عنوان</label>
            <input style={styles.input} value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} dir="rtl" />
            <label style={styles.label}>نام کاربری</label>
            <input style={styles.input} value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} dir="rtl" />
            <label style={styles.label}>رمز عبور</label>
            <input style={styles.input} value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} dir="rtl" />
            <label style={styles.label}>سطح دسترسی</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => setEditData({ ...editData, canEdit: true })} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: editData.canEdit ? "2px solid #0d8f8a" : "1px solid #e3e8ee", background: editData.canEdit ? "#e3f5f4" : "#fff", color: "#0d8f8a", fontSize: 13, cursor: "pointer" }}>دسترسی کامل</button>
              <button type="button" onClick={() => setEditData({ ...editData, canEdit: false })} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: !editData.canEdit ? "2px solid #123a54" : "1px solid #e3e8ee", background: !editData.canEdit ? "#f1f5f9" : "#fff", color: "#334155", fontSize: 13, cursor: "pointer" }}>فقط مشاهده</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" style={styles.button} onClick={() => saveEdit(a.id)}>ذخیره</button>
              <button type="button" style={{ ...styles.button, background: "#5b6b7d" }} onClick={cancelEdit}>انصراف</button>
            </div>
          </div>
        ) : (
          <div key={a.id} style={{ ...styles.card, width: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: "bold", fontSize: 16 }}>{a.name}</div>
                <div style={{ fontSize: 13, color: "#0d8f8a", marginTop: 4, direction: "ltr", textAlign: "right" }}>یوزر: {a.username}</div>
                <span style={{ ...styles.badge, marginTop: 6, display: "inline-block", color: a.canEdit ? "#166534" : "#92400e", background: a.canEdit ? "#dcfce7" : "#fef3c7" }}>
                  {a.canEdit ? "دسترسی کامل" : "فقط مشاهده"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={styles.smallButton} onClick={() => startEdit(a)}>تغییر</button>
                <button type="button" style={{ ...styles.smallButton, background: "#c92a2a" }} onClick={() => handleDelete(a.id, a.name)}>حذف</button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---------- ثبت آنومالی جدید (بر اساس «فرم آنومالی») ----------
function AnomalyForm({ onBack, currentUser, onSaved }) {
  const [contractorNames, setContractorNames] = useState([]);
  const [project, setProject] = useState("");
  const [contractor, setContractor] = useState("");
  const [subContractor, setSubContractor] = useState("");
  const [area, setArea] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHM());
  const [riskLevel, setRiskLevel] = useState("Med");
  const [category, setCategory] = useState(ANOMALY_CATEGORIES[0]);
  const [format, setFormat] = useState(ANOMALY_FORMATS[0]);
  const [description, setDescription] = useState("");
  const [follower, setFollower] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const handlePickFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 8 - photos.length);
    if (files.length === 0) return;
    setPhotoBusy(true);
    try {
      const results = await Promise.all(files.map((f) => resizeImageFile(f)));
      setPhotos((prev) => [...prev, ...results]);
    } catch {
      setError("خطا در بارگذاری یکی از عکس‌ها");
    }
    setPhotoBusy(false);
  };

  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  useEffect(() => {
    (async () => {
      const records = await loadContractors();
      setContractorNames(records.map((r) => r.name));
    })();
  }, []);

  const handleSubmit = async () => {
    if (!area.trim() || !description.trim()) {
      setError("موقعیت/ناحیه و شرح آنومالی الزامی است");
      return;
    }
    setSaving(true);
    const existing = await loadAnomalies();
    const record = {
      id: uid("anomaly"),
      trackingNumber: trackingNumber.trim() || `A-${String(existing.length + 1).padStart(4, "0")}`,
      project: project.trim(),
      contractor: contractor.trim(),
      subContractor: subContractor.trim(),
      area: area.trim(),
      date,
      time,
      riskLevel,
      category,
      format,
      description: description.trim(),
      correctiveAction: "",
      obstacles: "",
      follower: follower.trim(),
      sender: currentUser?.username || "",
      status: "open",
      closeDate: "",
      effectiveness: "",
      photoCount: photos.length,
    };
    const result = await insertAnomaly(record);
    if (!result || result.__error) {
      setSaving(false);
      setError(`خطا در ذخیره‌سازی: ${result?.message || "نامشخص"}`);
      return;
    }
    if (photos.length > 0) {
      await insertAnomalyPhotos(record.id, photos, "report");
    }
    setSaving(false);
    onSaved ? onSaved() : onBack && onBack();
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <AlertTriangle size={20} color="#c92a2a" />
          <h3 style={{ margin: 0 }}>گزارش شرایط ناایمن / اعمال ناایمن (آنومالی)</h3>
        </div>
        <p style={{ color: "#93a1b0", fontSize: 13, marginTop: 4 }}>این قسمت توسط کارفرما تکمیل می‌شود</p>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>پروژه</label>
            <input style={styles.input} value={project} onChange={(e) => setProject(e.target.value)} dir="rtl" />
          </div>
          <div>
            <label style={styles.label}>شماره پیگیری</label>
            <input style={styles.input} placeholder="خودکار در صورت خالی بودن" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>پیمانکار</label>
            <select style={styles.input} value={contractor} onChange={(e) => setContractor(e.target.value)} dir="rtl">
              <option value="">— انتخاب کنید —</option>
              {contractorNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>پیمانکار فرعی</label>
            <input style={styles.input} value={subContractor} onChange={(e) => setSubContractor(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>موقعیت / ناحیه</label>
            <input style={styles.input} value={area} onChange={(e) => setArea(e.target.value)} dir="rtl" placeholder="مثال: UNIT 74 (RHU)" />
          </div>
          <div>
            <label style={styles.label}>تاریخ</label>
            <JalaliDateInput value={date} onChange={setDate} />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>ساعت</label>
            <input style={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>سطح ریسک</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {RISK_LEVELS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRiskLevel(r.value)}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: 8, border: riskLevel === r.value ? `2px solid ${r.color}` : "1px solid #e3e8ee",
                    background: riskLevel === r.value ? r.bg : "#fff", color: r.color, fontSize: 13, cursor: "pointer", fontWeight: riskLevel === r.value ? "bold" : "normal",
                  }}
                >
                  {r.value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>دسته‌بندی</label>
            <select style={styles.input} value={category} onChange={(e) => setCategory(e.target.value)} dir="rtl">
              {ANOMALY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>فرمت</label>
            <select style={styles.input} value={format} onChange={(e) => setFormat(e.target.value)} dir="rtl">
              {ANOMALY_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <label style={styles.label}>شرح آنومالی</label>
        <textarea style={{ ...styles.input, minHeight: 100, resize: "vertical", fontFamily: "inherit" }} value={description} onChange={(e) => setDescription(e.target.value)} dir="rtl" />

        <label style={styles.label}>شخص پیگیری‌کننده (اختیاری)</label>
        <input style={styles.input} value={follower} onChange={(e) => setFollower(e.target.value)} dir="rtl" />

        <label style={styles.label}>عکس‌های پیوست ({photos.length}/8)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <label
            style={{
              ...styles.smallButton, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden",
              opacity: photoBusy || photos.length >= 8 ? 0.5 : 1, pointerEvents: photoBusy || photos.length >= 8 ? "none" : "auto",
            }}
          >
            <Camera size={16} /> گرفتن عکس
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
              onChange={(e) => { handlePickFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
          <label
            style={{
              ...styles.smallButton, flex: 1, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden",
              opacity: photoBusy || photos.length >= 8 ? 0.5 : 1, pointerEvents: photoBusy || photos.length >= 8 ? "none" : "auto",
            }}
          >
            <ImagePlus size={16} /> افزودن از گالری
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
              onChange={(e) => { handlePickFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>
        {photoBusy && <p style={{ fontSize: 12, color: "#93a1b0", marginTop: 8 }}>در حال پردازش عکس...</p>}


        {photos.length > 0 && (
          <div style={styles.photoGrid}>
            {photos.map((src, idx) => (
              <div key={idx} style={styles.photoThumbWrap}>
                <img src={src} alt={`پیوست ${idx + 1}`} style={styles.photoThumb} />
                <button type="button" style={styles.photoRemoveBtn} onClick={() => removePhoto(idx)}>
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <button type="button" style={styles.button} onClick={handleSubmit} disabled={saving}>
          {saving ? "در حال ثبت..." : "ثبت آنومالی"}
        </button>
      </div>
    </div>
  );
}

// ---------- لیست و پیگیری آنومالی‌ها ----------
function AnomalyList({ onBack, role, currentUser, readOnly }) {
  const isAdmin = role === "ADMIN";
  const isReviewer = (role === "EMPLOYER" || isAdmin) && !readOnly;
  const isReadOnlyReviewer = (role === "EMPLOYER" || isAdmin) && !!readOnly;
  const isContractor = role === "CONTRACTOR";
  // ادمین علاوه بر تأیید/رد، می‌تواند مثل پیمانکار هم اقدام اصلاحی ثبت و ارسال کند
  const canActAsContractor = isContractor || isAdmin;
  const myContractorName = (currentUser?.name || "").trim().toLowerCase();

  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState({});
  const [photosMap, setPhotosMap] = useState({});
  const [photosLoading, setPhotosLoading] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [actionText, setActionText] = useState("");
  const [actionPhotos, setActionPhotos] = useState([]);
  const [actionPhotoBusy, setActionPhotoBusy] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const load = async () => {
    setAnomalies(await loadAnomalies());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const scoped = isContractor && myContractorName
    ? anomalies.filter((a) => (a.contractor || "").trim().toLowerCase() === myContractorName)
    : anomalies;

  const filtered = scoped.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (riskFilter !== "all" && a.riskLevel !== riskFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${a.trackingNumber} ${a.contractor} ${a.area} ${a.description} ${a.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    total: scoped.length,
    open: scoped.filter((a) => a.status === "open").length,
    review: scoped.filter((a) => a.status === "pending_review").length,
    closed: scoped.filter((a) => a.status === "Closed").length,
    high: scoped.filter((a) => a.riskLevel === "High" && a.status !== "Closed").length,
  };

  const resetActionState = () => {
    setShowManualEdit(false);
    setActionText("");
    setActionPhotos([]);
    setShowRejectBox(false);
    setRejectNote("");
  };

  const startExpand = async (a) => {
    if (expandedId === a.id) { setExpandedId(null); resetActionState(); return; }
    setExpandedId(a.id);
    resetActionState();
    setDraft({
      correctiveAction: a.correctiveAction || "",
      obstacles: a.obstacles || "",
      follower: a.follower || "",
      status: a.status || "open",
      closeDate: a.closeDate || "",
      effectiveness: a.effectiveness || "",
    });
    if (a.photoCount > 0 && !photosMap[a.id]) {
      setPhotosLoading(true);
      const photos = await loadAnomalyPhotos(a.id);
      setPhotosMap((prev) => ({ ...prev, [a.id]: photos }));
      setPhotosLoading(false);
    }
  };

  const removeExistingPhoto = async (anomalyId, photoId) => {
    const current = photosMap[anomalyId] || [];
    const updated = current.filter((p) => p.id !== photoId);
    setPhotosMap((prev) => ({ ...prev, [anomalyId]: updated }));
    await deleteAnomalyPhotoDB(photoId);
    await updateAnomalyDB(anomalyId, { photoCount: updated.length });
    setAnomalies(anomalies.map((a) => (a.id === anomalyId ? { ...a, photoCount: updated.length } : a)));
  };

  const saveDraft = async (id) => {
    const patch = {
      ...draft,
      closeDate: draft.status === "Closed" ? (draft.closeDate || todayISO()) : "",
    };
    await updateAnomalyDB(id, patch);
    setAnomalies(anomalies.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setExpandedId(null);
  };

  const handleDelete = async (id, trackingNumber) => {
    if (confirm(`آیا از حذف آنومالی «${trackingNumber}» مطمئن هستید؟`)) {
      await deleteAnomalyDB(id);
      setAnomalies(anomalies.filter((a) => a.id !== id));
    }
  };

  const handleActionPickFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 8 - actionPhotos.length);
    if (files.length === 0) return;
    setActionPhotoBusy(true);
    try {
      const results = await Promise.all(files.map((f) => resizeImageFile(f)));
      setActionPhotos((prev) => [...prev, ...results]);
    } catch {
      // نادیده گرفته می‌شود؛ کاربر می‌تواند دوباره تلاش کند
    }
    setActionPhotoBusy(false);
  };
  const removeActionPhoto = (idx) => setActionPhotos((prev) => prev.filter((_, i) => i !== idx));

  const submitForReview = async (a) => {
    if (!actionText.trim()) return;
    setActionSaving(true);
    if (actionPhotos.length > 0) {
      await insertAnomalyPhotos(a.id, actionPhotos, "fix");
    }
    const newPhotoCount = a.photoCount + actionPhotos.length;
    const patch = { status: "pending_review", contractorAction: actionText.trim(), photoCount: newPhotoCount };
    await updateAnomalyDB(a.id, patch);
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    setPhotosMap((prev) => ({ ...prev, [a.id]: undefined }));
    setActionSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const approveAnomaly = async (a) => {
    setReviewSaving(true);
    const patch = { status: "Closed", closeDate: todayISO() };
    await updateAnomalyDB(a.id, patch);
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    setReviewSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const rejectAnomaly = async (a) => {
    setReviewSaving(true);
    const patch = { status: "open", reviewNote: rejectNote.trim() };
    await updateAnomalyDB(a.id, patch);
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    setReviewSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const riskMeta = (level) => RISK_LEVELS.find((r) => r.value === level) || RISK_LEVELS[1];
  const statusMeta = (status) => {
    if (status === "Closed") return { label: "بسته", color: "#166534", bg: "#dcfce7", Icon: CheckCircle2 };
    if (status === "pending_review") return { label: "در انتظار تأیید", color: "#1d4ed8", bg: "#dbeafe", Icon: Clock };
    return { label: "باز", color: "#92400e", bg: "#fef3c7", Icon: Clock };
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#93a1b0" }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <div style={styles.statNum}>{counts.total}</div>
          <div style={styles.statLabel}>کل موارد</div>
        </div>
        <div style={{ ...styles.statBox, background: "#fef3c7" }}>
          <div style={{ ...styles.statNum, color: "#92400e" }}>{counts.open}</div>
          <div style={styles.statLabel}>باز</div>
        </div>
        <div style={{ ...styles.statBox, background: "#dbeafe" }}>
          <div style={{ ...styles.statNum, color: "#1d4ed8" }}>{counts.review}</div>
          <div style={styles.statLabel}>در انتظار تأیید</div>
        </div>
        <div style={{ ...styles.statBox, background: "#dcfce7" }}>
          <div style={{ ...styles.statNum, color: "#166534" }}>{counts.closed}</div>
          <div style={styles.statLabel}>بسته</div>
        </div>
        <div style={{ ...styles.statBox, background: "#fee2e2" }}>
          <div style={{ ...styles.statNum, color: "#991b1b" }}>{counts.high}</div>
          <div style={styles.statLabel}>ریسک بالای باز</div>
        </div>
      </div>

      <div style={styles.filterBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, background: "#fff", borderRadius: 8, padding: "6px 10px", border: "1px solid #ddd" }}>
          <Search size={16} color="#93a1b0" />
          <input
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14 }}
            placeholder="جستجو (شماره، پیمانکار، ناحیه، شرح)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir="rtl"
          />
        </div>
        <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} dir="rtl">
          <option value="all">همه وضعیت‌ها</option>
          <option value="open">باز</option>
          <option value="pending_review">در انتظار تأیید</option>
          <option value="Closed">بسته</option>
        </select>
        <select style={styles.filterSelect} value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} dir="rtl">
          <option value="all">همه سطوح ریسک</option>
          {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.value}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          style={{ ...styles.smallButton, flex: 1, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={() => exportAnomaliesExcel(filtered, isContractor ? `آنومالی‌های ${currentUser?.name || "پیمانکار"}` : "لیست آنومالی‌ها")}
          disabled={filtered.length === 0}
        >
          <FileSpreadsheet size={15} /> خروجی Excel
        </button>
        <button
          type="button"
          style={{ ...styles.smallButton, flex: 1, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={() => exportAnomaliesPdf(filtered, isContractor ? `آنومالی‌های ${currentUser?.name || "پیمانکار"}` : "لیست آنومالی‌ها")}
          disabled={filtered.length === 0}
        >
          <FileText size={15} /> خروجی PDF
        </button>
      </div>

      <h3 style={{ marginTop: 22, fontSize: 15.5, color: THEME.navy, fontWeight: 700 }}>موارد ثبت‌شده ({filtered.length})</h3>

      {filtered.length === 0 && <p style={{ color: THEME.text3 }}>موردی یافت نشد.</p>}

      {filtered.map((a) => {
        const rm = riskMeta(a.riskLevel);
        const sm = statusMeta(a.status);
        const isOpenCard = expandedId === a.id;
        const photos = photosMap[a.id] || [];
        const reportPhotos = photos.filter((p) => p.stage !== "fix");
        const fixPhotos = photos.filter((p) => p.stage === "fix");
        return (
          <div key={a.id} style={{ ...styles.card, width: "auto", marginBottom: 12, borderInlineStart: `4px solid ${rm.color}`, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => startExpand(a)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: THEME.navy, fontSize: 14.5 }}>{a.trackingNumber}</span>
                  <span style={{ ...styles.badge, color: rm.color, background: rm.bg }}>{a.riskLevel}</span>
                  <span style={{ ...styles.badge, color: sm.color, background: sm.bg }}>
                    <sm.Icon size={12} style={{ display: "inline", marginLeft: 3 }} />{sm.label}
                  </span>
                  {a.category && <span style={styles.badge}>{a.category}</span>}
                </div>
                <div style={{ fontSize: 14, marginTop: 9, color: THEME.text }}>{a.description}</div>
                <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 7, fontWeight: 500 }}>
                  {a.area} {a.contractor && `· ${a.contractor}`} {a.date && `· ${isoToJalaliDisplay(a.date)}`} {a.sender && `· ثبت توسط ${a.sender}`}
                </div>
              </div>
              <ChevronRight size={18} color={THEME.text3} style={{ transform: isOpenCard ? "rotate(-90deg)" : "none", transition: "transform .15s", flexShrink: 0, marginRight: 6 }} />
            </div>

            {isOpenCard && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${THEME.border}`, paddingTop: 16 }}>
                {a.reviewNote && a.status === "open" && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    <b>بازگشت توسط کارفرما:</b> {a.reviewNote}
                  </div>
                )}

                {a.photoCount > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {photosLoading && !photosMap[a.id] ? (
                      <p style={{ fontSize: 12, color: "#93a1b0" }}>در حال بارگذاری عکس‌ها...</p>
                    ) : (
                      <>
                        {reportPhotos.length > 0 && (
                          <>
                            <label style={styles.label}>عکس‌های گزارش اولیه (کارفرما)</label>
                            <div style={styles.photoGrid}>
                              {reportPhotos.map((p, idx) => (
                                <div key={p.id} style={styles.photoThumbWrap}>
                                  <img src={p.photo} alt={`گزارش ${idx + 1}`} style={styles.photoThumb} onClick={() => setViewerSrc(p.photo)} />
                                  {isReviewer && (
                                    <button type="button" style={styles.photoRemoveBtn} onClick={() => removeExistingPhoto(a.id, p.id)}>
                                      <Trash2 size={12} color="#fff" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {fixPhotos.length > 0 && (
                          <>
                            <label style={styles.label}>عکس‌های اقدام اصلاحی (پیمانکار)</label>
                            <div style={styles.photoGrid}>
                              {fixPhotos.map((p, idx) => (
                                <div key={p.id} style={styles.photoThumbWrap}>
                                  <img src={p.photo} alt={`اقدام ${idx + 1}`} style={styles.photoThumb} onClick={() => setViewerSrc(p.photo)} />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ---- پیمانکار / ادمین: ثبت اقدام اصلاحی ---- */}
                {canActAsContractor && a.status === "open" && (
                  <div>
                    <label style={styles.label}>شرح اقدام اصلاحی انجام‌شده</label>
                    <textarea style={{ ...styles.input, minHeight: 70, fontFamily: "inherit" }} value={actionText} onChange={(e) => setActionText(e.target.value)} dir="rtl" placeholder="توضیح دهید چه اقدامی برای رفع این آنومالی انجام دادید" />

                    <label style={styles.label}>عکس اقدام اصلاحی ({actionPhotos.length}/8)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <label style={{ ...styles.smallButton, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden", opacity: actionPhotoBusy || actionPhotos.length >= 8 ? 0.5 : 1, pointerEvents: actionPhotoBusy || actionPhotos.length >= 8 ? "none" : "auto" }}>
                        <Camera size={16} /> گرفتن عکس
                        <input type="file" accept="image/*" capture="environment" style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} onChange={(e) => { handleActionPickFiles(e.target.files); e.target.value = ""; }} />
                      </label>
                      <label style={{ ...styles.smallButton, flex: 1, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden", opacity: actionPhotoBusy || actionPhotos.length >= 8 ? 0.5 : 1, pointerEvents: actionPhotoBusy || actionPhotos.length >= 8 ? "none" : "auto" }}>
                        <ImagePlus size={16} /> افزودن از گالری
                        <input type="file" accept="image/*" multiple style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} onChange={(e) => { handleActionPickFiles(e.target.files); e.target.value = ""; }} />
                      </label>
                    </div>
                    {actionPhotoBusy && <p style={{ fontSize: 12, color: "#93a1b0", marginTop: 8 }}>در حال پردازش عکس...</p>}
                    {actionPhotos.length > 0 && (
                      <div style={styles.photoGrid}>
                        {actionPhotos.map((src, idx) => (
                          <div key={idx} style={styles.photoThumbWrap}>
                            <img src={src} alt={`اقدام ${idx + 1}`} style={styles.photoThumb} />
                            <button type="button" style={styles.photoRemoveBtn} onClick={() => removeActionPhoto(idx)}>
                              <X size={12} color="#fff" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button type="button" style={styles.button} onClick={() => submitForReview(a)} disabled={actionSaving || !actionText.trim()}>
                      {actionSaving ? "در حال ارسال..." : isAdmin ? "ثبت اقدام و ارسال برای تأیید" : "ارسال برای تأیید کارفرما"}
                    </button>
                  </div>
                )}
                {isContractor && a.status === "pending_review" && (
                  <div style={{ fontSize: 13, color: "#1d4ed8", background: "#dbeafe", padding: 10, borderRadius: 8 }}>
                    اقدام شما ثبت شد و در انتظار بررسی و تأیید کارفرماست.
                    {a.contractorAction && <div style={{ marginTop: 6, color: "#333" }}><b>شرح اقدام شما:</b> {a.contractorAction}</div>}
                  </div>
                )}
                {isContractor && a.status === "Closed" && (
                  <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
                    {a.contractorAction && <div><b>اقدام اصلاحی شما:</b> {a.contractorAction}</div>}
                    <div><b>وضعیت:</b> تأیید و بسته شد توسط کارفرما</div>
                    {a.closeDate && <div><b>تاریخ بسته شدن:</b> {isoToJalaliDisplay(a.closeDate)}</div>}
                  </div>
                )}

                {/* ---- کارفرما/ادمین: بررسی و تأیید ---- */}
                {isReviewer && a.status === "pending_review" && (
                  <div>
                    {a.contractorAction && (
                      <div style={{ fontSize: 13, background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12 }}>
                        <b>شرح اقدام پیمانکار:</b> {a.contractorAction}
                      </div>
                    )}
                    {!showRejectBox ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={styles.button} onClick={() => approveAnomaly(a)} disabled={reviewSaving}>
                          {reviewSaving ? "در حال ثبت..." : "تأیید و بستن"}
                        </button>
                        <button type="button" style={{ ...styles.smallButton, background: "#c92a2a" }} onClick={() => setShowRejectBox(true)}>
                          رد و بازگشت
                        </button>
                      </div>
                    ) : (
                      <>
                        <label style={styles.label}>دلیل بازگشت (برای پیمانکار نمایش داده می‌شود)</label>
                        <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} dir="rtl" />
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button type="button" style={{ ...styles.button, background: "#c92a2a" }} onClick={() => rejectAnomaly(a)} disabled={reviewSaving}>
                            {reviewSaving ? "در حال ثبت..." : "تأیید بازگشت"}
                          </button>
                          <button type="button" style={{ ...styles.smallButton, background: "#5b6b7d" }} onClick={() => setShowRejectBox(false)}>انصراف</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isReviewer && a.status === "Closed" && (
                  <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
                    {a.contractorAction && <div><b>اقدام پیمانکار:</b> {a.contractorAction}</div>}
                    {a.closeDate && <div><b>تاریخ بسته شدن:</b> {isoToJalaliDisplay(a.closeDate)}</div>}
                    {a.effectiveness && <div><b>اثربخشی:</b> {a.effectiveness}</div>}
                  </div>
                )}
                {isReviewer && a.status === "open" && (
                  <div>
                    <div style={styles.backLink} onClick={() => setShowManualEdit((v) => !v)}>
                      {showManualEdit ? "بستن ویرایش دستی" : "ویرایش دستی (اختیاری)"}
                    </div>
                    {showManualEdit && (
                      <>
                        <label style={styles.label}>اقدام اصلاحی</label>
                        <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={draft.correctiveAction} onChange={(e) => setDraft({ ...draft, correctiveAction: e.target.value })} dir="rtl" />

                        <label style={styles.label}>موانع و مشکلات</label>
                        <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={draft.obstacles} onChange={(e) => setDraft({ ...draft, obstacles: e.target.value })} dir="rtl" />

                        <div style={styles.formGrid}>
                          <div>
                            <label style={styles.label}>شخص پیگیر</label>
                            <input style={styles.input} value={draft.follower} onChange={(e) => setDraft({ ...draft, follower: e.target.value })} dir="rtl" />
                          </div>
                          <div>
                            <label style={styles.label}>وضعیت</label>
                            <select style={styles.input} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} dir="rtl">
                              <option value="open">باز</option>
                              <option value="pending_review">در انتظار تأیید</option>
                              <option value="Closed">بسته (Closed)</option>
                            </select>
                          </div>
                        </div>

                        {draft.status === "Closed" && (
                          <div style={styles.formGrid}>
                            <div>
                              <label style={styles.label}>تاریخ بسته شدن</label>
                              <JalaliDateInput value={draft.closeDate} onChange={(v) => setDraft({ ...draft, closeDate: v })} />
                            </div>
                            <div>
                              <label style={styles.label}>اثربخشی</label>
                              <input style={styles.input} value={draft.effectiveness} onChange={(e) => setDraft({ ...draft, effectiveness: e.target.value })} dir="rtl" />
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button type="button" style={styles.button} onClick={() => saveDraft(a.id)}>ذخیره تغییرات</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isReviewer && a.status !== "pending_review" && (
                  <div style={{ marginTop: 16 }}>
                    <button type="button" style={{ ...styles.smallButton, background: "#c92a2a" }} onClick={() => handleDelete(a.id, a.trackingNumber)}>حذف آنومالی</button>
                  </div>
                )}
                {isReadOnlyReviewer && (
                  <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
                    <div style={{ background: "#f1f5f9", color: "#334155", padding: "4px 10px", borderRadius: 999, display: "inline-block", fontSize: 11, marginBottom: 8 }}>دسترسی فقط مشاهده</div>
                    {a.correctiveAction && <div><b>اقدام اصلاحی:</b> {a.correctiveAction}</div>}
                    {a.contractorAction && <div><b>اقدام پیمانکار:</b> {a.contractorAction}</div>}
                    {a.obstacles && <div><b>موانع و مشکلات:</b> {a.obstacles}</div>}
                    {a.follower && <div><b>شخص پیگیر:</b> {a.follower}</div>}
                    {a.reviewNote && <div><b>یادداشت بازگشت:</b> {a.reviewNote}</div>}
                    {a.status === "Closed" && a.closeDate && <div><b>تاریخ بسته شدن:</b> {isoToJalaliDisplay(a.closeDate)}</div>}
                    {a.effectiveness && <div><b>اثربخشی:</b> {a.effectiveness}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {viewerSrc && (
        <div style={styles.photoViewerOverlay} onClick={() => setViewerSrc(null)}>
          <button type="button" style={styles.photoViewerClose} onClick={() => setViewerSrc(null)}>
            <X size={20} color="#fff" />
          </button>
          <img src={viewerSrc} alt="نمای بزرگ" style={styles.photoViewerImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ---------- پنل ادمین ----------
const MODULE_ICON = { profile: User, manageUsers: Users, anomalyReport: AlertTriangle };

// ---------- ردیف منوی استاندارد (آیکون + عنوان + شورون) ----------
function MenuRow({ icon: IconEl, label, onClick, accent, muted, sub }) {
  return (
    <div
      style={{
        ...styles.menuCard,
        ...(accent ? styles.anomalyMenuCard : {}),
        ...(muted ? { opacity: 0.55 } : {}),
        justifyContent: "space-between",
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: accent ? "rgba(13,143,138,0.14)" : "#eef1f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconEl size={17} color={accent ? THEME.tealDeep : THEME.navyMid} />
        </div>
        <span>{label}</span>
      </div>
      {sub ? (
        <ChevronRight size={16} color={THEME.text3} style={{ transform: "rotate(180deg)" }} />
      ) : (
        <ChevronRight size={16} color={THEME.text3} style={{ transform: "rotate(180deg)", opacity: 0.4 }} />
      )}
    </div>
  );
}

function AdminDashboard({ onLogout, currentUser }) {
  const [view, setView] = useState("menu");
  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const riskMod = HSE_MODULES.find((m) => m.key === "riskAssessment");
  return (
    <div style={styles.dashboardWrapper}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.appNameTag}>{APP_NAME}</div>
          <h2 style={{ margin: 0 }}>پنل ادمین</h2>
        </div>
        <button style={styles.logoutButton} onClick={onLogout}><LogOut size={14} style={{ marginLeft: 6 }} />خروج</button>
      </div>

      {view === "menu" && (
        <div style={styles.menuList}>
          <MenuRow icon={User} label="پروفایل من" onClick={() => setView("profile")} />
          <MenuRow icon={Users} label="مدیریت حساب‌های کارفرما/همکاران" onClick={() => setView("employers")} />
          <MenuRow icon={ShieldCheck} label="مدیریت پیمانکاران" onClick={() => setView("contractors")} />
          <MenuRow icon={AlertTriangle} label={anomalyMod.label} onClick={() => setView("anomalyReport")} accent sub />
          <MenuRow icon={ShieldCheck} label={riskMod.label} onClick={() => setView("riskAssessment")} accent sub />
        </div>
      )}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{anomalyMod.label}</h3>
          <div style={styles.menuList2}>
            {anomalyMod.sub.map((s) => (
              <MenuRow key={s.key} icon={AlertTriangle} label={s.label} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "riskAssessment" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{riskMod.label}</h3>
          <div style={styles.menuList2}>
            {riskMod.sub.map((s) => (
              <MenuRow key={s.key} icon={ShieldCheck} label={s.label} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel="ادمین" />}
      {view === "employers" && <EmployerAccountManager onBack={() => setView("menu")} />}
      {view === "contractors" && <ContractorManager onBack={() => setView("menu")} />}
      {view === "anomalyForm" && <AnomalyForm onBack={() => setView("anomalyReport")} currentUser={currentUser} onSaved={() => setView("anomalyList")} />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="ADMIN" currentUser={currentUser} />}
      {view === "bowtieDashboard" && <BowTieDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} readOnly={false} />}
    </div>
  );
}

// ---------- پنل کارفرما ----------
function EmployerDashboard({ onLogout, currentUser }) {
  const [view, setView] = useState("menu");
  const canEdit = currentUser?.canEdit !== false;

  const openModule = (mod) => {
    if (mod.key === "profile") { setView("profile"); return; }
    if (mod.employerOnly && !canEdit) { alert("این بخش فقط با دسترسی کامل در دسترس است"); return; }
    if (mod.sub) { setView(mod.key); return; }
    alert(`ماژول «${mod.label}» به‌زودی اضافه می‌شود`);
  };

  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const anomalySub = anomalyMod.sub.filter((s) => canEdit || !s.employerOnly);
  const riskMod = HSE_MODULES.find((m) => m.key === "riskAssessment");

  return (
    <div style={styles.dashboardWrapper}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.appNameTag}>{APP_NAME}</div>
          <h2 style={{ margin: 0 }}>پنل کارفرما {!canEdit && <span style={{ fontSize: 12, opacity: 0.85 }}>(فقط مشاهده)</span>}</h2>
        </div>
        <button style={styles.logoutButton} onClick={onLogout}><LogOut size={14} style={{ marginLeft: 6 }} />خروج</button>
      </div>

      {view === "menu" && (
        <div style={styles.menuList}>
          {HSE_MODULES.map((mod) => (
            <MenuRow
              key={mod.key}
              icon={MODULE_ICON[mod.key] || LayoutGrid}
              label={mod.label}
              onClick={() => openModule(mod)}
              accent={!!mod.icon}
              muted={mod.employerOnly && !canEdit}
              sub={!!mod.sub}
            />
          ))}
        </div>
      )}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{anomalyMod.label}</h3>
          <div style={styles.menuList2}>
            {anomalySub.map((s) => (
              <MenuRow key={s.key} icon={AlertTriangle} label={s.label} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "riskAssessment" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{riskMod.label}</h3>
          <div style={styles.menuList2}>
            {riskMod.sub.map((s) => (
              <MenuRow key={s.key} icon={ShieldCheck} label={s.label} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel={canEdit ? "کارفرما" : "کارفرما (فقط مشاهده)"} />}
      {view === "manageUsers" && <ContractorManager onBack={() => setView("menu")} />}
      {view === "anomalyForm" && <AnomalyForm onBack={() => setView("anomalyReport")} currentUser={currentUser} onSaved={() => setView("anomalyList")} />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="EMPLOYER" currentUser={currentUser} readOnly={!canEdit} />}
      {view === "bowtieDashboard" && <BowTieDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} readOnly={!canEdit} />}
    </div>
  );
}

// ---------- پنل پیمانکار ----------
function ContractorDashboard({ onLogout, currentUser }) {
  const [view, setView] = useState("menu");

  const openModule = (mod) => {
    if (mod.key === "profile") { setView("profile"); return; }
    if (mod.employerOnly) { alert("این بخش فقط برای کارفرما/ادمین در دسترس است"); return; }
    if (mod.sub) { setView(mod.key); return; }
    alert(`ماژول «${mod.label}» به‌زودی اضافه می‌شود`);
  };

  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const anomalySub = anomalyMod.sub.filter((s) => !s.employerOnly);

  return (
    <div style={styles.dashboardWrapper}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.appNameTag}>{APP_NAME}</div>
          <h2 style={{ margin: 0 }}>پنل پیمانکار</h2>
        </div>
        <button style={styles.logoutButton} onClick={onLogout}><LogOut size={14} style={{ marginLeft: 6 }} />خروج</button>
      </div>

      {view === "menu" && (
        <div style={styles.menuList}>
          {HSE_MODULES.map((mod) => (
            <MenuRow
              key={mod.key}
              icon={MODULE_ICON[mod.key] || LayoutGrid}
              label={mod.label}
              onClick={() => openModule(mod)}
              accent={!!mod.icon}
              muted={!!mod.employerOnly}
              sub={!!mod.sub}
            />
          ))}
        </div>
      )}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{anomalyMod.label}</h3>
          <div style={styles.menuList2}>
            {anomalySub.map((s) => (
              <MenuRow key={s.key} icon={AlertTriangle} label={s.label} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel="پیمانکار" />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="CONTRACTOR" currentUser={currentUser} />}
    </div>
  );
}

// ---------- گرفتن خطاهای زمان اجرا و نمایش پیام به‌جای صفحه سفید ----------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("App error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl", maxWidth: 560, margin: "40px auto" }}>
          <h3 style={{ color: "#c92a2a" }}>مشکلی در اجرای اپلیکیشن پیش آمد</h3>
          <p style={{ fontSize: 13, color: "#555" }}>لطفاً متن زیر را برای بررسی ارسال کنید:</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#991b1b", background: "#fee2e2", padding: 12, borderRadius: 8 }}>
            {String((this.state.error && this.state.error.message) || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- کامپوننت اصلی ----------
function AppInner() {
  const [currentUser, setCurrentUser] = useState(null);

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;
  if (currentUser.role === "ADMIN") return <AdminDashboard onLogout={() => setCurrentUser(null)} currentUser={currentUser} />;
  if (currentUser.role === "EMPLOYER") return <EmployerDashboard onLogout={() => setCurrentUser(null)} currentUser={currentUser} />;
  return <ContractorDashboard onLogout={() => setCurrentUser(null)} currentUser={currentUser} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

