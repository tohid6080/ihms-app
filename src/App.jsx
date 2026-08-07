import React, { useState, useEffect } from "react";
import { AlertTriangle, Plus, X, ChevronRight, LogOut, CheckCircle2, Clock, Camera, ImagePlus, Trash2, FileSpreadsheet, FileText, User, Users, ShieldCheck, LayoutGrid, BarChart3, Briefcase, Settings, Archive, Truck, Tag, MessageCircle, GraduationCap, ShieldOff, ShieldAlert, Database } from "lucide-react";
import * as XLSX from "xlsx";
import BowTieDashboard from "./bowtie/BowTieDashboard.jsx";
import HcmsDashboard from "./hcms/HcmsDashboard.jsx";
import HcmsMatrixManager from "./hcms/HcmsMatrixManager.jsx";
import RiskKnowledgeManager from "./riskknowledge/RiskKnowledgeManager.jsx";
import AnomalyCategoryManager from "./anomalycategories/AnomalyCategoryManager.jsx";
import { loadActiveAnomalyCategories } from "./anomalycategories/anomalyCategoriesApi.js";
import { getOrCreateHcmsForAnomaly, createSuggestedHcmsFromAnomaly } from "./hcms/hcmsApi.js";
import PersonnelForm from "./personnel/PersonnelForm.jsx";
import PersonnelDashboard from "./personnel/PersonnelDashboard.jsx";
import HomeDashboard from "./dashboard/HomeDashboard.jsx";
import PermissionManager from "./permissions/PermissionManager.jsx";
import { loadPermissionsMap, isModuleVisible, getAccessLevel, initializeNoAccess } from "./permissions/permissionsApi.js";
import JobPositionManager from "./jobpositions/JobPositionManager.jsx";
import { loadActiveJobPositions, loadJobPositionTitle } from "./jobpositions/jobPositionsApi.js";
import NotificationPanel from "./personnel/NotificationPanel.jsx";
import { loadNotifications, loadPersonnelList, checkAndUpdateDeadlines, markNotificationRead } from "./personnel/personnelApi.js";
import OnlineIndicator from "./offline/OnlineIndicator.jsx";
import { offlineWrite, offlineWriteFile } from "./offline/offlineWrite.js";
import DbSizeWarningBanner from "./offline/DbSizeWarningBanner.jsx";
import { checkUploadAllowed } from "./offline/dbSizeMonitor.js";
import ArchiveManager from "./offline/ArchiveManager.jsx";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext.jsx";
import {
  isBiometricAvailable, isBiometricEnabledFor,
  enableBiometricLogin, disableBiometricLogin,
  verifyBiometricAndGetCredentials,
} from "./biometricAuth.js";
import { checkLoginLockout, recordLoginAttempt, validatePasswordLength, MIN_PASSWORD_LENGTH } from "./loginSecurity.js";
import AdminAnalytics from "./admin/AdminAnalytics.jsx";
import ChatDashboard from "./chat/ChatDashboard.jsx";
import TrainingManager from "./training/TrainingManager.jsx";
import ChatAccessManager from "./chat/ChatAccessManager.jsx";
import { loadUnreadTotal } from "./chat/chatApi.js";
import ChatThread from "./chat/ChatThread.jsx";
import { findOrCreateLinkedConversation, resolveContractorUsername } from "./chat/chatApi.js";
import { trackLogin, trackLogout, trackPageView } from "./admin/activityApi.js";
import SuperAdminLogin from "./superadmin/SuperAdminLogin.jsx";
import SuperAdminPanel from "./superadmin/SuperAdminPanel.jsx";
import DataView, { StatusPill } from "./shared/DataView.jsx";
import MachineryDashboard from "./machinery/MachineryDashboard.jsx";
import { loadMachineryListOfflineFirst } from "./machinery/machineryApi.js";
import ScaffoldDashboard from "./scaffold/ScaffoldDashboard.jsx";
import ScaffoldTagCodeManager from "./scaffold/ScaffoldTagCodeManager.jsx";
import { isOnline } from "./offline/networkStatus.js";
import { getRecordsByModule, putRecord, getQueue } from "./offline/offlineDb.js";
import SyncStatusBadge from "./offline/SyncStatusBadge.jsx";
import { retryItemNow } from "./offline/syncEngine.js";
import { exportWorkbookNativeAware, exportHtmlReportNativeAware } from "./offline/nativeFile.js";
import { APP_NAME, sb, sbOk, sbErrMsg, uid, todayISO, THEME, styles, usePersistedState, setCurrentCompanyId, getCurrentCompanyId } from "./shared.js";

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

const ANOMALY_FORMATS = [
  "بازرسی", "مدیریت تغییر", "عوامل زیان‌آور محیط کار", "ممیزی", "معاینات ادواری", "گزارش روزانه", "سایر",
];


// ترتیب ماژول‌های سامانه IHMS طبق نقشه‌ی راه پروژه.
// فقط "مدیریت عدم انطباق‌ها (Anomaly Report)" و "ایجاد حساب کاربری" فعلاً پیاده‌سازی شده‌اند؛
// بقیه به‌عنوان جای‌نگه‌دار (Placeholder) نمایش داده می‌شوند تا در فازهای بعدی توسعه یابند.
const HSE_MODULES = [
  { key: "chat", label: "چت", labelKey: "moduleChat" },
  { key: "archiveManagement", label: "آرشیو فایل‌ها", labelKey: "moduleArchive" },
  {
    key: "anomalyReport",
    label: "مدیریت عدم انطباق‌ها (Anomaly Report)",
    labelKey: "moduleAnomalyReport",
    icon: true,
    sub: [
      { key: "anomalyForm", label: "ثبت آنومالی", labelKey: "subAnomalyForm", employerOnly: true },
      { key: "anomalyList", label: "لیست آنومالی‌ها", labelKey: "subAnomalyList" },
    ],
  },
  {
    key: "riskAssessment",
    label: "مدیریت ارزیابی ریسک (Risk Assessment)",
    labelKey: "moduleRiskAssessment",
    icon: true,
    sub: [
      { key: "bowtieDashboard", label: "BowTie Risk Analysis", labelKey: "subBowtie" },
      { key: "hcmsDashboard", label: "HCMS - سیستم مدیریت و کنترل خطرات", labelKey: "subHcms" },
      { key: "riskKnowledgeManagement", label: "بانک اطلاعاتی ارزیابی ریسک", labelKey: "subRiskKnowledge", employerOnly: true },
    ],
  },
  {
    key: "personnelAccess",
    label: "مدیریت ورود و تردد پرسنل",
    labelKey: "modulePersonnelAccess",
    icon: true,
    sub: [
      { key: "personnelDashboard", label: "لیست پرسنل", labelKey: "subPersonnelList" },
      { key: "personnelForm", label: "ثبت پرسنل جدید", labelKey: "subPersonnelForm" },
    ],
  },
  {
    key: "machineryManagement",
    label: "مدیریت ماشین‌آلات و تجهیزات",
    labelKey: "moduleMachinery",
    icon: true,
    sub: [
      { key: "machineryDashboard", label: "لیست ماشین‌آلات", labelKey: "subMachineryList" },
    ],
  },
  {
    key: "scaffoldManagement",
    label: "مدیریت داربست",
    labelKey: "moduleScaffold",
    icon: true,
    sub: [
      { key: "scaffoldDashboard", label: "لیست تگ داربست", labelKey: "subScaffoldList" },
    ],
  },
  {
    key: "managementDashboard",
    label: "داشبورد مدیریتی و گزارش‌های تحلیلی",
    labelKey: "moduleManagementDashboard",
    icon: true,
  },
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
    contactPersonName: r.contact_person_name || "",
    startDate: r.start_date || "",
    contractDetails: r.contract_details || "",
    username: r.username || "",
    password: r.password || "",
    jobPositionId: r.job_position_id || "",
    jobPositionTitle: r.job_positions?.title || "",
    role: "CONTRACTOR",
    companyId: r.company_id || "",
    phone: r.phone || "",
    email: r.email || "",
    preferredLanguage: r.preferred_language || "fa",
    createdAt: r.created_at || "",
  };
}

// ---------- به‌روزرسانی خودسرویس پروفایل (فقط موبایل/ایمیل) ----------
// عمداً یک تابع کاملاً جدا از updateEmployerAccountDB/updateContractorDB —
// تا حتی در آینده هم هیچ مسیری از خودِ کاربر به فیلدهای دیگر (نام، سمت،
// نقش) که فقط ادمین باید تغییرشان بدهد، باز نماند.
async function updateMyProfile(role, id, patch) {
  const table = role === "CONTRACTOR" ? "contractors" : "employer_accounts";
  const dbPatch = {};
  if ("phone" in patch) dbPatch.phone = patch.phone;
  if ("email" in patch) dbPatch.email = patch.email;
  if ("preferredLanguage" in patch) dbPatch.preferred_language = patch.preferredLanguage;
  const rows = await sb(`${table}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return rows[0];
}

async function loadMyLastLogin(username) {
  if (!username) return null;
  const rows = await sb(`user_activity?username=eq.${encodeURIComponent(username)}&event_type=eq.login&select=created_at&order=created_at.desc&limit=2`);
  // ردیف اول همین ورودِ فعلیه؛ دومی رو می‌خوایم («آخرین ورود» یعنی نشست قبلی)
  if (!sbOk(rows) || rows.length < 2) return null;
  return rows[1].created_at;
}

async function loadMyCompanyName(companyId) {
  if (!companyId) return "";
  const rows = await sb(`companies?id=eq.${companyId}&select=name`);
  return sbOk(rows) && rows.length > 0 ? rows[0].name : "";
}

async function loadContractors() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`contractors?select=*,job_positions(title)&order=name.asc${filter}`);
  return (sbOk(rows) ? rows : []).map(contractorFromRow);
}
async function insertContractor(rec) {
  const rows = await sb("contractors", {
    method: "POST",
    body: JSON.stringify([{ name: rec.name, contact_person_name: rec.contactPersonName || "", start_date: rec.startDate || null, contract_details: rec.contractDetails, username: rec.username, password: rec.password, job_position_id: rec.jobPositionId || null, company_id: getCurrentCompanyId() }]),
  });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return contractorFromRow(rows[0]);
}
async function updateContractorDB(id, patch) {
  const dbPatch = {};
  if ("name" in patch) dbPatch.name = patch.name;
  if ("contactPersonName" in patch) dbPatch.contact_person_name = patch.contactPersonName;
  if ("startDate" in patch) dbPatch.start_date = patch.startDate || null;
  if ("contractDetails" in patch) dbPatch.contract_details = patch.contractDetails;
  if ("username" in patch) dbPatch.username = patch.username;
  if ("password" in patch) dbPatch.password = patch.password;
  if ("jobPositionId" in patch) dbPatch.job_position_id = patch.jobPositionId || null;
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
    companyName: r.company_name || "",
    username: r.username,
    password: r.password,
    canEdit: r.can_edit !== false,
    jobPositionId: r.job_position_id || "",
    jobPositionTitle: r.job_positions?.title || "",
    role: r.role === "admin" ? "ADMIN" : "EMPLOYER",
    companyId: r.company_id || "",
    phone: r.phone || "",
    email: r.email || "",
    preferredLanguage: r.preferred_language || "fa",
    createdAt: r.created_at || "",
  };
}

async function loadEmployerAccounts() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`employer_accounts?select=*,job_positions(title)&order=name.asc${filter}`);
  return (sbOk(rows) ? rows : []).map(employerAccountFromRow);
}
async function insertEmployerAccount(rec) {
  const rows = await sb("employer_accounts", {
    method: "POST",
    body: JSON.stringify([{ name: rec.name, company_name: rec.companyName || "", username: rec.username, password: rec.password, can_edit: rec.canEdit, job_position_id: rec.jobPositionId || null, company_id: getCurrentCompanyId(), role: "employer" }]),
  });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return employerAccountFromRow(rows[0]);
}
async function updateEmployerAccountDB(id, patch) {
  const dbPatch = {};
  if ("name" in patch) dbPatch.name = patch.name;
  if ("companyName" in patch) dbPatch.company_name = patch.companyName;
  if ("username" in patch) dbPatch.username = patch.username;
  if ("password" in patch) dbPatch.password = patch.password;
  if ("canEdit" in patch) dbPatch.can_edit = patch.canEdit;
  if ("jobPositionId" in patch) dbPatch.job_position_id = patch.jobPositionId || null;
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
    syncStatus: r.__syncStatus || "synced",
  };
}

// نگاشت رکورد اپ به شکل ردیف دیتابیس (برای insert)
function anomalyRecordToDb(record) {
  return {
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
    company_id: getCurrentCompanyId(),
  };
}

// نگاشت patch اپ به شکل patch دیتابیس (برای update)
function anomalyPatchToDb(patch) {
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
  return dbPatch;
}

async function loadAnomalies() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`anomalies?select=*&order=created_at.desc${filter}`);
  return (sbOk(rows) ? rows : []).map(anomalyFromRow);
}

/**
 * Offline-first loader: online → fetch from Supabase, refresh the local
 * cache for next time we're offline, and merge in anything created locally
 * that hasn't synced yet. Offline → read purely from the local cache.
 */
async function loadAnomaliesOfflineFirst() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  if (isOnline()) {
    const rows = await sb(`anomalies?select=*&order=created_at.desc${filter}`);
    if (sbOk(rows)) {
      for (const r of rows) await putRecord("anomalies", r.id, r, "synced");
      const cached = await getRecordsByModule("anomalies");
      const serverIds = new Set(rows.map((r) => r.id));
      const localOnly = cached.filter((c) => c.syncStatus !== "synced" && !serverIds.has(c.id) && !c.data?.deleted);
      return [
        ...localOnly.map((c) => anomalyFromRow({ ...c.data, __syncStatus: c.syncStatus })),
        ...rows.map((r) => anomalyFromRow({ ...r, __syncStatus: "synced" })),
      ];
    }
  }
  // آفلاین یا خطای شبکه → فقط از حافظه‌ی محلی بخوان
  const cached = await getRecordsByModule("anomalies");
  return cached.filter((c) => !c.data?.deleted).map((c) => anomalyFromRow({ ...c.data, __syncStatus: c.syncStatus }));
}



/**
 * Smart, live-computed notifications — NOT stored anywhere, recalculated
 * fresh every time from current personnel/anomaly data. Unlike the SLA
 * deadline notifications above (discrete events that need explicit
 * dismissal), these are just current counts: as soon as the underlying
 * condition changes (an anomaly gets closed, a document gets uploaded),
 * the number changes or the line disappears on its own — nothing to mark
 * read, nothing to clean up.
 *
 * `scopeContractorName`: pass the contractor's own name for a
 * contractor-scoped summary (3 items max). Omit it for the employer view,
 * which gets one line per (contractor, category) — matching how a real
 * manager wants to see it broken down.
 */
function computeSmartNotifications(personnelList, anomaliesList, scopeContractorName) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const displayName = (s) => (s || "").trim(); // برای نمایش، بدون lowercase (فارسی رو تغییر نمی‌ده، ولی برای وضوح جداست)
  const scopeNorm = scopeContractorName ? norm(scopeContractorName) : null;

  const contractorNames = scopeContractorName
    ? [{ norm: scopeNorm, display: displayName(scopeContractorName) }]
    : Object.values(
        [...anomaliesList.map((a) => a.contractor), ...personnelList.map((p) => p.contractorName)]
          .filter(Boolean)
          .reduce((acc, raw) => {
            const key = norm(raw);
            if (key && !acc[key]) acc[key] = { norm: key, display: displayName(raw) };
            return acc;
          }, {})
      ).sort((a, b) => a.display.localeCompare(b.display, "fa"));

  const items = [];
  for (const { norm: name, display } of contractorNames) {
    const openAnomalies = anomaliesList.filter((a) => norm(a.contractor) === name && a.status !== "Closed").length;
    const contractorPersonnel = personnelList.filter((p) => norm(p.contractorName) === name);
    const needVisit = contractorPersonnel.filter((p) => p.status === "pending_health_visit").length;
    const needResult = contractorPersonnel.filter((p) => p.status === "pending_health_result").length;
    // فیلتر پرسنل بر اساس contractorId واقعیه، نه اسم — شناسه رو از یکی از
    // رکوردهای همین پیمانکار برمی‌داریم (هر رکوردی که داشته باشد کافی است).
    const contractorId = contractorPersonnel.find((p) => p.contractorId)?.contractorId || null;

    if (openAnomalies > 0) {
      items.push({
        key: `smart-${name}-anomaly`,
        label: scopeContractorName ? `${openAnomalies} آنومالی باز دارید` : `شرکت ${display}: ${openAnomalies} آنومالی باز دارد`,
        target: { module: "anomaly", statusFilter: "not_closed", contractorFilter: display },
      });
    }
    if (needVisit > 0) {
      items.push({
        key: `smart-${name}-visit`,
        label: scopeContractorName ? `${needVisit} نفر نیاز به مراجعه به طب کار دارند` : `شرکت ${display}: ${needVisit} نفر نیاز به مراجعه به طب کار دارند`,
        target: { module: "personnel", statusFilter: "pending_health_visit", contractorFilter: contractorId || "all" },
      });
    }
    if (needResult > 0) {
      items.push({
        key: `smart-${name}-result`,
        label: scopeContractorName ? `${needResult} نفر نتیجه/مدارک طب کار را هنوز بارگذاری نکرده‌اند` : `شرکت ${display}: ${needResult} نفر نتیجه طب کار را هنوز بارگذاری نکرده‌اند`,
        target: { module: "personnel", statusFilter: "pending_health_result", contractorFilter: contractorId || "all" },
      });
    }
  }
  return items;
}

/**
 * Same live-computed philosophy for the Machinery module — no stored
 * events, just current counts recalculated fresh every time. For the
 * employer, "pending review" and "expiring documents" are the two things
 * that actually need attention; for the contractor, expiring documents and
 * anything sent back (rejected/needs_correction) matter.
 */
function computeMachinerySmartItems(machineryList, scopeContractorName) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const displayName = (s) => (s || "").trim();

  const contractorNames = scopeContractorName
    ? [{ norm: norm(scopeContractorName), display: displayName(scopeContractorName) }]
    : Object.values(
        machineryList.map((m) => m.contractorName).filter(Boolean).reduce((acc, raw) => {
          const key = norm(raw);
          if (key && !acc[key]) acc[key] = { norm: key, display: displayName(raw) };
          return acc;
        }, {})
      ).sort((a, b) => a.display.localeCompare(b.display, "fa"));

  const items = [];
  for (const { norm: name, display } of contractorNames) {
    const mine = machineryList.filter((m) => norm(m.contractorName) === name);
    const contractorId = mine.find((m) => m.contractorId)?.contractorId || null;

    const pendingReview = mine.filter((m) => m.approvalStatus === "pending").length;
    const needsAttention = mine.filter((m) => m.approvalStatus === "rejected" || m.approvalStatus === "needs_correction").length;
    const expiring = mine.filter((m) => {
      const insD = daysUntilIso(m.insuranceExpiry);
      const inspD = daysUntilIso(m.inspectionExpiry);
      return (insD !== null && insD <= MACHINERY_EXPIRY_WARNING_DAYS) || (inspD !== null && inspD <= MACHINERY_EXPIRY_WARNING_DAYS);
    }).length;

    if (scopeContractorName) {
      if (expiring > 0) {
        items.push({
          key: `machine-${name}-expiring`,
          label: `${expiring} ماشین با بیمه/معاینه فنی منقضی یا نزدیک به انقضا`,
          target: { module: "machinery", approvalFilter: "all" },
        });
      }
      if (needsAttention > 0) {
        items.push({
          key: `machine-${name}-attention`,
          label: `${needsAttention} ماشین رد شده یا نیاز به اصلاح دارد`,
          target: { module: "machinery", approvalFilter: "needs_correction" },
        });
      }
    } else {
      if (pendingReview > 0) {
        items.push({
          key: `machine-${name}-pending`,
          label: `شرکت ${display}: ${pendingReview} درخواست ثبت ماشین‌آلات در انتظار بررسی`,
          target: { module: "machinery", approvalFilter: "pending", contractorFilter: contractorId || "all" },
        });
      }
      if (expiring > 0) {
        items.push({
          key: `machine-${name}-expiring`,
          label: `شرکت ${display}: ${expiring} ماشین با بیمه/معاینه فنی منقضی یا نزدیک به انقضا`,
          target: { module: "machinery", approvalFilter: "all", contractorFilter: contractorId || "all" },
        });
      }
    }
  }
  return items;
}

function daysUntilIso(iso) {
  if (!iso) return null;
  const target = new Date(iso);
  if (isNaN(target.getTime())) return null;
  const today = new Date(todayISO());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}
const MACHINERY_EXPIRY_WARNING_DAYS = 30;

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
    company_id: getCurrentCompanyId(),
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

async function exportAnomaliesExcel(list, title) {
  const rows = anomalyExportRows(list);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 36 }, { wch: 30 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Anomalies");
  await exportWorkbookNativeAware(XLSX, wb, `${title}.xlsx`);
}

function escapeHtml(s) {
  return String(s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

async function exportAnomaliesPdf(list, title) {
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

  if (await exportHtmlReportNativeAware(html, title)) return;

  const win = window.open("", "_blank");
  if (!win) { alert("اجازه‌ی باز شدن پنجره‌ی جدید داده نشد؛ لطفاً popup blocker مرورگر را غیرفعال کنید."); return; }
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
// ---------- لوگوی سامانه (بارگذاری از public/logo.png) ----------
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

// منطق واقعی تطبیق اعتبارنامه — عیناً از داخل LoginScreen بیرون کشیده شده
// تا هم فرم ورود عادی، هم گیت ورود بیومتریک (که باید همان اعتبارسنجی
// واقعی را دوباره اجرا کند، نه صرفاً به یک نشست ذخیره‌شده اعتماد کند) از
// یک منبع واحد استفاده کنند. هیچ رفتاری نسبت به قبل تغییر نکرده است.
async function attemptCredentialLogin(username, password) {
  // اول حساب‌های واقعی (کارفرما/ادمین) که به یک شرکت واقعی متعلق‌اند بررسی
  // می‌شوند — including admin و karfarma که بعد از مهاجرت فاز ۲ دیگر
  // ردیف واقعی دارند، نه فقط مقدار هاردکد بدون company_id.
  const employerAccounts = await loadEmployerAccounts();
  const employerMatch = employerAccounts.find((u) => u.username === username.trim() && u.password === password);
  if (employerMatch) return { user: employerMatch };

  // سپس حساب‌های پیمانکار
  const contractors = await loadContractors();
  const found = contractors.find((u) => u.username && u.username === username.trim() && u.password === password);
  if (found) return { user: found };

  // fallback ایمنی — فقط اگر SQL مهاجرت هنوز اجرا نشده؛ بدون company_id
  // واقعی، بخش‌های شرکت‌محور داده‌ای نشان نمی‌دهند تا وقتی مهاجرت انجام شود.
  const seedMatch = SEED_USERS.find((u) => u.username === username.trim() && u.password === password);
  if (seedMatch) {
    console.warn("ورود از طریق حساب موقت SEED_USERS — لطفاً SQL مهاجرت فاز ۲ را اجرا کنید.");
    const seedUser = { ...seedMatch, canEdit: true, name: seedMatch.role === "EMPLOYER" ? "کارفرما (حساب اصلی)" : seedMatch.username };
    return { user: seedUser };
  }

  return { error: true };
}

function LoginScreen({ onLogin }) {
  const { lang, setLang, t, dir } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    // اول: آیا این نام‌کاربری به‌خاطر تلاش‌های ناموفق اخیر قفل است؟ این
    // بررسی واقعاً سمت سرور انجام می‌شود (نه یک شمارنده‌ی قابل‌پاک‌شدن در
    // مرورگر خودِ کاربر).
    const lockStatus = await checkLoginLockout(username);
    if (lockStatus?.locked) {
      setLoading(false);
      setError(t("accountTemporarilyLocked"));
      return;
    }

    const { user } = await attemptCredentialLogin(username, password);
    recordLoginAttempt(username, !!user); // نتیجه را برای شمارنده ثبت کن؛ منتظر پاسخش نمی‌مانیم تا ورود موفق کندتر نشود
    setLoading(false);
    if (user) {
      setError("");
      setCurrentCompanyId(user.companyId);
      trackLogin(user);
      if (user.preferredLanguage) setLang(user.preferredLanguage);
      onLogin(user);
    } else {
      setError(t("invalidCredentials"));
    }
  };

  return (
    <div style={styles.centerScreen}>
      <div style={{ ...styles.card, width: 360, direction: dir }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <IhmsLogo size={120} />
        </div>
        <h2 style={{ textAlign: "center", marginBottom: 2, fontSize: 18, direction: "ltr", color: THEME.navy, fontWeight: 700, letterSpacing: "-0.01em" }}>{APP_NAME}</h2>
        <p style={{ textAlign: "center", color: THEME.text3, fontSize: 12.5, marginTop: 4, marginBottom: 22, fontWeight: 500 }}>
          {t("loginTagline")}
        </p>

        <label style={{ ...styles.label, textAlign: dir === "rtl" ? "right" : "left" }}>{t("username")}</label>
        <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} dir={dir} />

        <label style={{ ...styles.label, textAlign: dir === "rtl" ? "right" : "left" }}>{t("password")}</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          dir={dir}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="button" style={{ ...styles.button, opacity: loading ? 0.75 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? t("loggingIn") : t("loginButton")}
        </button>

        <p style={styles.hint}>{t("designedBy")}</p>
      </div>
    </div>
  );
}

// گیت ورود بیومتریک — وقتی نشستی از قبل ذخیره شده (currentUser در
// localStorage) و کاربر قبلاً ورود با اثر انگشت را فعال کرده، این صفحه
// جای رفتن مستقیم به داشبورد می‌آید. بدون این گیت، هرکسی که گوشیِ
// بازشده را در دست بگیرد، بدون هیچ احراز هویتی مستقیم وارد سامانه
// می‌شد — این دقیقاً همان لایه‌ی امنیتی‌ست که این قابلیت اضافه می‌کند.
function BiometricGateScreen({ currentUser, onUnlocked, onFallbackToPassword }) {
  const { t, dir } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const attempt = async () => {
    setChecking(true);
    setErrorMsg("");
    const bioResult = await verifyBiometricAndGetCredentials();
    if (bioResult?.__error) {
      setChecking(false);
      setErrorMsg(bioResult.message || "");
      return;
    }
    const lockStatus = await checkLoginLockout(bioResult.username);
    if (lockStatus?.locked) {
      setChecking(false);
      setErrorMsg(t("accountTemporarilyLocked"));
      return;
    }
    // بیومتریک تأیید شد؛ حالا همان اعتبارسنجی واقعی ورود دوباره اجرا
    // می‌شود — اگر مثلاً ادمین رمز را عوض کرده یا حساب را غیرفعال کرده
    // باشد، ورود بیومتریک هم دیگر کار نمی‌کند، دقیقاً مثل ورود عادی.
    const { user } = await attemptCredentialLogin(bioResult.username, bioResult.password);
    recordLoginAttempt(bioResult.username, !!user);
    setChecking(false);
    if (user) {
      setCurrentCompanyId(user.companyId);
      trackLogin(user);
      onUnlocked(user);
    } else {
      setErrorMsg(t("biometricStaleCredentials"));
    }
  };

  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ ...styles.centerScreen, direction: dir }}>
      <div style={{ ...styles.card, width: 340, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <IhmsLogo size={80} />
        </div>
        <h3 style={{ marginBottom: 4, color: THEME.navy }}>{currentUser?.name || "—"}</h3>
        <p style={{ color: errorMsg ? THEME.danger : THEME.text3, fontSize: 12.5, marginBottom: 20, minHeight: 32 }}>
          {checking ? t("biometricGateChecking") : errorMsg || t("biometricGateWaiting")}
        </p>
        {!checking && errorMsg && (
          <>
            <button type="button" style={{ ...styles.button, marginBottom: 10 }} onClick={attempt}>{t("biometricRetry")}</button>
            <button type="button" style={{ ...styles.button, background: THEME.text3 }} onClick={onFallbackToPassword}>{t("biometricUsePassword")}</button>
          </>
        )}
      </div>
    </div>
  );
}

// تعویض فارسی/English — روی صفحه‌ی ورود و توی تنظیمات پروفایل استفاده می‌شود
function LanguageToggle({ lang, setLang, compact }) {
  const btn = (value, label) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      style={{
        padding: compact ? "6px 12px" : "5px 11px", borderRadius: 7, fontSize: compact ? 12.5 : 11.5, fontWeight: 600, cursor: "pointer",
        border: `1.5px solid ${lang === value ? THEME.teal : THEME.border}`,
        background: lang === value ? THEME.teal : "#fff", color: lang === value ? "#fff" : THEME.text2,
        fontFamily: THEME.font,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {btn("fa", "فارسی")}
      {btn("en", "English")}
    </div>
  );
}

// ---------- پروفایل کاربر ----------
// ---------- آواتار (حروف اول نام) ----------
function getInitials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function Avatar({ name, size = 40, bg }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", background: bg || THEME.teal,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        color: "#fff", fontWeight: 700, fontSize: size * 0.4, fontFamily: THEME.font,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function ProfileView({ onBack, currentUser, roleLabel }) {
  const { lang, setLang, t, dir } = useLanguage();
  const [companyName, setCompanyName] = useState("");
  const [lastLogin, setLastLogin] = useState(null);
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioError, setBioError] = useState("");
  const [bioSupported, setBioSupported] = useState(true);

  useEffect(() => {
    if (currentUser?.role === "CONTRACTOR") {
      setCompanyName(currentUser?.name || "");
    } else {
      loadMyCompanyName(currentUser?.companyId).then(setCompanyName);
    }
    loadMyLastLogin(currentUser?.username).then(setLastLogin);
    setBioEnabled(isBiometricEnabledFor(currentUser?.username));
    isBiometricAvailable().then((r) => setBioSupported(!!r.available));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const result = await updateMyProfile(currentUser?.role, currentUser?.id, { phone: phone.trim(), email: email.trim() });
    setSaving(false);
    if (result?.__error) { setError(result.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // انتخاب زبان بلافاصله روی هدر/این صفحه اعمال می‌شود (setLang)، و همزمان
  // به‌عنوان ترجیح دائمی همین کاربر در دیتابیس ذخیره می‌شود — دفعه‌ی بعد که
  // از هر دستگاهی وارد شود، همین زبان روی هدرش اعمال خواهد شد.
  const handleLanguageChange = async (value) => {
    setLang(value);
    if (currentUser?.role && currentUser?.id) {
      await updateMyProfile(currentUser.role, currentUser.id, { preferredLanguage: value });
    }
  };

  const handleToggleBiometric = async () => {
    setBioError("");
    setBioBusy(true);
    if (bioEnabled) {
      await disableBiometricLogin();
      setBioEnabled(false);
      setBioBusy(false);
      return;
    }
    const result = await enableBiometricLogin(currentUser?.username, currentUser?.password);
    setBioBusy(false);
    if (result?.__error) { setBioError(result.message); return; }
    setBioEnabled(true);
  };

  const Field = ({ label, value }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: THEME.text3, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: THEME.text }}>{value || "—"}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: 24, direction: dir }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>{t("backToMenu")}</div>}
      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <Avatar name={currentUser?.name} size={64} />
        </div>
        <h3 style={{ textAlign: "center", marginBottom: 2 }}>{currentUser?.name || "—"}</h3>
        <p style={{ textAlign: "center", color: THEME.text3, fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>{roleLabel}</p>

        <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 14, marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: THEME.text3, fontWeight: 700, marginBottom: 10 }}>{t("orgInfoTitle")}</p>
          <div style={styles.formGrid}>
            <Field label={t("fullName")} value={currentUser?.name} />
            <Field label={currentUser?.role === "CONTRACTOR" ? t("contractorLabel") : t("companyLabel")} value={companyName} />
          </div>
          <div style={styles.formGrid}>
            <Field label={t("jobTitle")} value={currentUser?.jobPositionTitle} />
            <Field label={t("userRole")} value={roleLabel} />
          </div>
          <div style={styles.formGrid}>
            <Field label={t("joinDate")} value={isoToJalaliDisplay(currentUser?.createdAt)} />
            <Field label={t("lastLogin")} value={lastLogin ? isoToJalaliDisplay(lastLogin) : t("firstLogin")} />
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 14, marginTop: 8 }}>
          <p style={{ fontSize: 11, color: THEME.text3, fontWeight: 700, marginBottom: 10 }}>{t("systemLanguage")}</p>
          <LanguageToggle lang={lang} setLang={handleLanguageChange} compact />
        </div>

        <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 14, marginTop: 14 }}>
          <p style={{ fontSize: 11, color: THEME.text3, fontWeight: 700, marginBottom: 10 }}>{t("securitySectionTitle")}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text }}>{t("biometricToggleLabel")}</div>
              <div style={{ fontSize: 11, color: bioError ? THEME.danger : THEME.text3, marginTop: 2 }}>
                {!bioSupported
                  ? t("biometricNativeOnly")
                  : bioBusy
                  ? (bioEnabled ? t("biometricDisabling") : t("biometricEnabling"))
                  : bioError || (bioEnabled ? t("biometricEnabledHint") : t("biometricDisabledHint"))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleBiometric}
              disabled={bioBusy || !bioSupported}
              style={{
                width: 46, height: 26, borderRadius: 13, border: "none", cursor: (bioBusy || !bioSupported) ? "default" : "pointer",
                background: bioEnabled ? THEME.teal : "#d5dbe1", position: "relative", flexShrink: 0, opacity: (bioBusy || !bioSupported) ? 0.5 : 1,
                transition: "background 0.15s",
              }}
            >
              <span style={{
                position: "absolute", top: 3, insetInlineStart: bioEnabled ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
                background: "#fff", transition: "inset-inline-start 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              }} />
            </button>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 14, marginTop: 14 }}>
          <p style={{ fontSize: 11, color: THEME.text3, fontWeight: 700, marginBottom: 10 }}>{t("contactInfoTitle")}</p>
          <label style={styles.label}>{t("mobileNumber")}</label>
          <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="09xxxxxxxxx" />
          <label style={styles.label}>{t("orgEmail")}</label>
          <input style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="name@company.com" type="email" />

          {error && <p style={styles.error}>{error}</p>}
          {saved && <p style={{ color: "#166534", fontSize: 12.5, marginTop: 6 }}>{t("savedConfirm")}</p>}
          <button type="button" style={{ ...styles.button, marginTop: 10 }} onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : t("saveChanges")}
          </button>
        </div>

        <p style={{ textAlign: "center", color: "#aaa", fontSize: 11, marginTop: 20, direction: "ltr" }}>{APP_NAME}</p>
      </div>
    </div>
  );
}

// ---------- مدیریت یکپارچه پیمانکاران (اطلاعات شرکت + حساب کاربری ورود) ----------
function ContractorManager({ onBack }) {
  const [contractors, setContractors] = useState([]);
  const [jobPositions, setJobPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [contractDetails, setContractDetails] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [jobPositionId, setJobPositionId] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    (async () => {
      const [c, jp] = await Promise.all([loadContractors(), loadActiveJobPositions()]);
      setContractors(c);
      setJobPositions(jp);
      setLoading(false);
    })();
  }, []);

  const usernameTaken = (uname, excludeId) =>
    SEED_USERS.some((u) => u.username === uname) || contractors.some((c) => c.username === uname && c.id !== excludeId);

  const handleAdd = async () => {
    const uname = username.trim();
    if (!name.trim() || !uname || !password || !jobPositionId) { setFormError("نام پیمانکار، عنوان شغلی، نام کاربری و رمز عبور الزامی است"); return; }
    if (!validatePasswordLength(password)) { setFormError(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`); return; }
    if (usernameTaken(uname, null)) { setFormError("این نام کاربری قبلاً استفاده شده است"); return; }
    const inserted = await insertContractor({ name: name.trim(), contactPersonName: contactPersonName.trim(), startDate, contractDetails: contractDetails.trim(), username: uname, password, jobPositionId });
    if (!inserted || inserted.__error) { setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`); return; }
    await initializeNoAccess("contractor", inserted.id);
    setContractors([...contractors, inserted]);
    setName(""); setContactPersonName(""); setStartDate(""); setContractDetails(""); setUsername(""); setPassword(""); setJobPositionId(""); setFormError(""); setShowForm(false);
    alert("حساب پیمانکار ساخته شد. اکنون از «مدیریت نقش‌ها و دسترسی‌ها» دسترسی ماژول‌های این حساب را تعیین کنید.");
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditData({ name: c.name, contactPersonName: c.contactPersonName, startDate: c.startDate, contractDetails: c.contractDetails, username: c.username, password: c.password, jobPositionId: c.jobPositionId });
  };
  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async (id) => {
    const uname = (editData.username || "").trim();
    if (!editData.name?.trim() || !uname || !editData.password || !editData.jobPositionId) { alert("نام پیمانکار، عنوان شغلی، نام کاربری و رمز عبور نمی‌توانند خالی باشند"); return; }
    if (!validatePasswordLength(editData.password)) { alert(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`); return; }
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
          <label style={styles.label}>نام و نام خانوادگی (نماینده/شخص رابط)</label>
          <input style={styles.input} value={contactPersonName} onChange={(e) => setContactPersonName(e.target.value)} dir="rtl" />
          <label style={styles.label}>عنوان شغلی</label>
          <select style={styles.input} value={jobPositionId} onChange={(e) => setJobPositionId(e.target.value)} dir="rtl">
            <option value="">— انتخاب کنید —</option>
            {jobPositions.map((jp) => <option key={jp.id} value={jp.id}>{jp.title}</option>)}
          </select>
          <label style={styles.label}>تاریخ شروع به کار</label>
          <JalaliDateInput value={startDate} onChange={setStartDate} />
          <label style={styles.label}>مشخصات قرارداد</label>
          <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={contractDetails} onChange={(e) => setContractDetails(e.target.value)} dir="rtl" />
          <label style={styles.label}>نام کاربری (برای ورود پیمانکار به سامانه)</label>
          <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} dir="rtl" />
          <label style={styles.label}>رمز عبور</label>
          <input style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} dir="rtl" />
          <p style={{ fontSize: 10.5, color: THEME.text3, margin: "-8px 0 8px" }}>حداقل {MIN_PASSWORD_LENGTH} کاراکتر</p>
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
            <label style={styles.label}>نام و نام خانوادگی (نماینده/شخص رابط)</label>
            <input style={styles.input} value={editData.contactPersonName || ""} onChange={(e) => setEditData({ ...editData, contactPersonName: e.target.value })} dir="rtl" />
            <label style={styles.label}>عنوان شغلی</label>
            <select style={styles.input} value={editData.jobPositionId || ""} onChange={(e) => setEditData({ ...editData, jobPositionId: e.target.value })} dir="rtl">
              <option value="">— انتخاب کنید —</option>
              {jobPositions.map((jp) => <option key={jp.id} value={jp.id}>{jp.title}</option>)}
            </select>
            <label style={styles.label}>تاریخ شروع به کار</label>
            <JalaliDateInput value={editData.startDate} onChange={(v) => setEditData({ ...editData, startDate: v })} />
            <label style={styles.label}>مشخصات قرارداد</label>
            <textarea style={{ ...styles.input, minHeight: 70, fontFamily: "inherit" }} value={editData.contractDetails} onChange={(e) => setEditData({ ...editData, contractDetails: e.target.value })} dir="rtl" />
            <label style={styles.label}>نام کاربری</label>
            <input style={styles.input} value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} dir="rtl" />
            <label style={styles.label}>رمز عبور</label>
            <input style={styles.input} value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} dir="rtl" />
            <p style={{ fontSize: 10.5, color: THEME.text3, margin: "-8px 0 8px" }}>حداقل {MIN_PASSWORD_LENGTH} کاراکتر</p>
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
                {c.contactPersonName && <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>نماینده: {c.contactPersonName}</div>}
                {c.jobPositionTitle && <div style={{ fontSize: 12.5, color: "#0d8f8a", marginTop: 3, fontWeight: 600 }}>{c.jobPositionTitle}</div>}
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
  const [jobPositions, setJobPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [canEdit, setCanEdit] = useState(true);
  const [jobPositionId, setJobPositionId] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    (async () => {
      const [a, jp] = await Promise.all([loadEmployerAccounts(), loadActiveJobPositions()]);
      setAccounts(a);
      setJobPositions(jp);
      setLoading(false);
    })();
  }, []);

  const usernameTaken = (uname, excludeId) =>
    SEED_USERS.some((u) => u.username === uname) || accounts.some((a) => a.username === uname && a.id !== excludeId);

  const handleAdd = async () => {
    const uname = username.trim();
    if (!name.trim() || !uname || !password || !jobPositionId) { setFormError("نام، عنوان شغلی، نام کاربری و رمز عبور الزامی است"); return; }
    if (!validatePasswordLength(password)) { setFormError(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`); return; }
    if (usernameTaken(uname, null)) { setFormError("این نام کاربری قبلاً استفاده شده است"); return; }
    const inserted = await insertEmployerAccount({ name: name.trim(), companyName: companyName.trim(), username: uname, password, canEdit, jobPositionId });
    if (!inserted || inserted.__error) { setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`); return; }
    await initializeNoAccess("employer", inserted.id);
    setAccounts([...accounts, inserted]);
    setName(""); setCompanyName(""); setUsername(""); setPassword(""); setCanEdit(true); setJobPositionId(""); setFormError(""); setShowForm(false);
    alert("حساب کارفرما ساخته شد. اکنون از «مدیریت نقش‌ها و دسترسی‌ها» دسترسی ماژول‌های این حساب را تعیین کنید.");
  };

  const startEdit = (a) => { setEditingId(a.id); setEditData({ name: a.name, companyName: a.companyName, username: a.username, password: a.password, canEdit: a.canEdit, jobPositionId: a.jobPositionId }); };
  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async (id) => {
    const uname = (editData.username || "").trim();
    if (!editData.name?.trim() || !uname || !editData.password || !editData.jobPositionId) { alert("نام، عنوان شغلی، نام کاربری و رمز عبور نمی‌توانند خالی باشند"); return; }
    if (!validatePasswordLength(editData.password)) { alert(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`); return; }
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
          <label style={styles.label}>نام و نام خانوادگی</label>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} dir="rtl" />
          <label style={styles.label}>نام شرکت</label>
          <input style={styles.input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} dir="rtl" />
          <label style={styles.label}>عنوان شغلی</label>
          <select style={styles.input} value={jobPositionId} onChange={(e) => setJobPositionId(e.target.value)} dir="rtl">
            <option value="">— انتخاب کنید —</option>
            {jobPositions.map((jp) => <option key={jp.id} value={jp.id}>{jp.title}</option>)}
          </select>
          <label style={styles.label}>نام کاربری</label>
          <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} dir="rtl" />
          <label style={styles.label}>رمز عبور</label>
          <input style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} dir="rtl" />
          <p style={{ fontSize: 10.5, color: THEME.text3, margin: "-8px 0 8px" }}>حداقل {MIN_PASSWORD_LENGTH} کاراکتر</p>
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
            <label style={styles.label}>نام و نام خانوادگی</label>
            <input style={styles.input} value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} dir="rtl" />
            <label style={styles.label}>نام شرکت</label>
            <input style={styles.input} value={editData.companyName || ""} onChange={(e) => setEditData({ ...editData, companyName: e.target.value })} dir="rtl" />
            <label style={styles.label}>عنوان شغلی</label>
            <select style={styles.input} value={editData.jobPositionId || ""} onChange={(e) => setEditData({ ...editData, jobPositionId: e.target.value })} dir="rtl">
              <option value="">— انتخاب کنید —</option>
              {jobPositions.map((jp) => <option key={jp.id} value={jp.id}>{jp.title}</option>)}
            </select>
            <label style={styles.label}>نام کاربری</label>
            <input style={styles.input} value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} dir="rtl" />
            <label style={styles.label}>رمز عبور</label>
            <input style={styles.input} value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} dir="rtl" />
            <p style={{ fontSize: 10.5, color: THEME.text3, margin: "-8px 0 8px" }}>حداقل {MIN_PASSWORD_LENGTH} کاراکتر</p>
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
                {a.companyName && <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>شرکت: {a.companyName}</div>}
                {a.jobPositionTitle && <div style={{ fontSize: 12.5, color: "#0d8f8a", marginTop: 3, fontWeight: 600 }}>{a.jobPositionTitle}</div>}
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
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [format, setFormat] = useState(ANOMALY_FORMATS[0]);
  const [description, setDescription] = useState("");
  const [follower, setFollower] = useState("");
  const [needsRiskAssessment, setNeedsRiskAssessment] = useState(false);
  const [identifiedHazard, setIdentifiedHazard] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const handlePickFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 2 - photos.length);
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

  useEffect(() => {
    (async () => {
      const cats = await loadActiveAnomalyCategories();
      setCategoryOptions(cats.map((c) => c.name));
      if (cats.length > 0) setCategory((prev) => prev || cats[0].name);
    })();
  }, []);

  const handleSubmit = async () => {
    if (!area.trim() || !description.trim()) {
      setError("موقعیت/ناحیه و شرح آنومالی الزامی است");
      return;
    }
    if (needsRiskAssessment && !identifiedHazard.trim()) {
      setError("چون «نیاز به ارزیابی ریسک دارد» را انتخاب کردید، وارد کردن «خطر شناسایی‌شده» الزامی است");
      return;
    }
    if (photos.length > 0 && isOnline()) {
      const { allowed, storageMb } = await checkUploadAllowed();
      if (!allowed) {
        setError(`فضای ذخیره‌سازی پر شده است (${storageMb} مگابایت). لطفاً ابتدا از بخش «آرشیو فایل‌ها» عکس‌های قدیمی را دانلود و حذف کنید، یا آنومالی را بدون عکس ثبت کنید.`);
        return;
      }
    }
    setSaving(true);
    const existing = await loadAnomaliesOfflineFirst();
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
      sender: currentUser?.name || "",
      status: "open",
      closeDate: "",
      effectiveness: "",
      photoCount: photos.length,
    };
    const result = await offlineWrite({
      module: "anomalies", table: "anomalies", action: "insert",
      id: record.id, payload: anomalyRecordToDb(record),
    });
    if (!result.ok) {
      setSaving(false);
      setError(`خطا در ذخیره‌سازی: ${result?.message || "نامشخص"}`);
      return;
    }
    if (photos.length > 0) {
      for (const p of photos) {
        await offlineWriteFile({
          module: "anomalyPhotos", table: "anomaly_photos", bucket: "anomaly-photos",
          id: uid("photo"), includeIdInPayload: false,
          base64Data: p, contentType: "image/jpeg", fileFieldName: "photo",
          extraFields: { anomaly_id: record.id, stage: "report" },
        });
      }
    }
    if (needsRiskAssessment) {
      const hcmsResult = await createSuggestedHcmsFromAnomaly(record, identifiedHazard.trim(), currentUser?.name);
      if (hcmsResult?.__error) {
        // آنومالی با موفقیت ثبت شده؛ فقط ارزیابی ریسک پیشنهادی ساخته نشد — این
        // نباید کل ثبت آنومالی را از دید کاربر ناموفق نشان بدهد، ولی باید مطلع شود
        alert(`آنومالی ثبت شد، اما ساخت خودکار ارزیابی ریسک HCMS با خطا مواجه شد: ${hcmsResult.message}\nمی‌توانید بعداً از داخل «مدیریت ریسک → HCMS» آن را دستی بسازید.`);
      }
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
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
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

        <label style={styles.label}>نیاز به ارزیابی ریسک دارد؟</label>
        <div style={{ display: "flex", gap: 8, marginBottom: needsRiskAssessment ? 10 : 0 }}>
          <button type="button" onClick={() => setNeedsRiskAssessment(true)} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: needsRiskAssessment ? "2px solid #0d8f8a" : "1px solid #e3e8ee", background: needsRiskAssessment ? "#e3f5f4" : "#fff", color: "#0d8f8a", fontSize: 13, cursor: "pointer" }}>بله</button>
          <button type="button" onClick={() => setNeedsRiskAssessment(false)} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: !needsRiskAssessment ? "2px solid #123a54" : "1px solid #e3e8ee", background: !needsRiskAssessment ? "#f1f5f9" : "#fff", color: "#334155", fontSize: 13, cursor: "pointer" }}>خیر</button>
        </div>
        {needsRiskAssessment && (
          <>
            <label style={styles.label}>خطر شناسایی‌شده</label>
            <textarea style={{ ...styles.input, minHeight: 70, fontFamily: "inherit" }} value={identifiedHazard} onChange={(e) => setIdentifiedHazard(e.target.value)} dir="rtl" placeholder="خطری که مشاهده کردید را شرح دهید — بعد از ثبت آنومالی، یک ارزیابی ریسک HCMS پیشنهادی خودکار ساخته می‌شود که کارفرما باید آن را بررسی و تأیید کند." />
          </>
        )}

        <label style={styles.label}>عکس‌های پیوست ({photos.length}/2)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <label
            style={{
              ...styles.smallButton, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden",
              opacity: photoBusy || photos.length >= 2 ? 0.5 : 1, pointerEvents: photoBusy || photos.length >= 2 ? "none" : "auto",
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
              opacity: photoBusy || photos.length >= 2 ? 0.5 : 1, pointerEvents: photoBusy || photos.length >= 2 ? "none" : "auto",
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
function AnomalyList({ onBack, role, currentUser, readOnly, initialStatusFilter, initialRiskFilter, initialContractorFilter }) {
  const isAdmin = role === "ADMIN";
  const isReviewer = (role === "EMPLOYER" || isAdmin) && !readOnly;
  const isReadOnlyReviewer = (role === "EMPLOYER" || isAdmin) && !!readOnly;
  const isContractor = role === "CONTRACTOR";
  // ادمین علاوه بر تأیید/رد، می‌تواند مثل پیمانکار هم اقدام اصلاحی ثبت و ارسال کند
  const canActAsContractor = (isContractor || isAdmin) && !readOnly;
  const myContractorName = (currentUser?.name || "").trim().toLowerCase();

  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "all");
  const [riskFilter, setRiskFilter] = useState(initialRiskFilter || "all");
  const [contractorFilter, setContractorFilter] = useState(initialContractorFilter || "all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [linkedChatId, setLinkedChatId] = useState(null);
  const [linkedChatBusy, setLinkedChatBusy] = useState(false);
  const [linkedHcmsId, setLinkedHcmsId] = useState(null);
  const [linkedHcmsBusy, setLinkedHcmsBusy] = useState(false);
  const openLinkedHcms = async (a) => {
    setLinkedHcmsBusy(true);
    const rec = await getOrCreateHcmsForAnomaly(a, currentUser?.name);
    setLinkedHcmsBusy(false);
    if (rec?.__error) { alert(rec.message); return; }
    setLinkedHcmsId(a.id);
  };
  const openLinkedChat = async (a) => {
    setLinkedChatBusy(true);
    let initialParticipants = [];
    if (a.contractor) {
      const uname = await resolveContractorUsername(a.contractor);
      if (uname) initialParticipants = [{ username: uname, fullName: a.contractor, role: "CONTRACTOR" }];
    }
    const convId = await findOrCreateLinkedConversation(currentUser, "anomaly", a.id, `آنومالی ${a.trackingNumber}`, initialParticipants);
    setLinkedChatBusy(false);
    if (convId?.__error) { alert(convId.message); return; }
    setLinkedChatId(convId);
  };
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
    setAnomalies(await loadAnomaliesOfflineFirst());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const scoped = isContractor && myContractorName
    ? anomalies.filter((a) => (a.contractor || "").trim().toLowerCase() === myContractorName)
    : anomalies;

  const filtered = scoped.filter((a) => {
    if (statusFilter === "not_closed" && a.status === "Closed") return false;
    else if (statusFilter !== "all" && statusFilter !== "not_closed" && a.status !== statusFilter) return false;
    if (riskFilter !== "all" && a.riskLevel !== riskFilter) return false;
    if (!isContractor && contractorFilter !== "all" && (a.contractor || "").trim().toLowerCase() !== contractorFilter.trim().toLowerCase()) return false;
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

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "risk") {
      const order = { High: 0, Med: 1, Low: 2 };
      return (order[a.riskLevel] ?? 1) - (order[b.riskLevel] ?? 1);
    }
    const at = a.date || a.createdAt || "", bt = b.date || b.createdAt || "";
    return sort === "oldest" ? at.localeCompare(bt) : bt.localeCompare(at);
  });

  const handleBulkDelete = async (ids) => {
    if (readOnly) { alert("شما مجوز حذف را ندارید"); return; }
    if (!confirm(`${ids.length} مورد حذف شود؟`)) return;
    for (const id of ids) await offlineWrite({ module: "anomalies", table: "anomalies", action: "delete", id, payload: {} });
    setAnomalies(anomalies.filter((a) => !ids.includes(a.id)));
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
    await offlineWrite({ module: "anomalyPhotos", table: "anomaly_photos", action: "delete", id: photoId, payload: {} });
    await offlineWrite({ module: "anomalies", table: "anomalies", action: "update", id: anomalyId, payload: { photo_count: updated.length } });
    setAnomalies(anomalies.map((a) => (a.id === anomalyId ? { ...a, photoCount: updated.length, syncStatus: "pending" } : a)));
  };

  const saveDraft = async (id) => {
    const patch = {
      ...draft,
      closeDate: draft.status === "Closed" ? (draft.closeDate || todayISO()) : "",
    };
    await offlineWrite({ module: "anomalies", table: "anomalies", action: "update", id, payload: anomalyPatchToDb(patch) });
    setAnomalies(anomalies.map((a) => (a.id === id ? { ...a, ...patch, syncStatus: isOnline() ? "synced" : "pending" } : a)));
    setExpandedId(null);
  };

  const handleDelete = async (id, trackingNumber) => {
    if (readOnly) { alert("شما مجوز حذف را ندارید"); return; }
    if (confirm(`آیا از حذف آنومالی «${trackingNumber}» مطمئن هستید؟`)) {
      await offlineWrite({ module: "anomalies", table: "anomalies", action: "delete", id, payload: {} });
      setAnomalies(anomalies.filter((a) => a.id !== id));
    }
  };

  const handleActionPickFiles = async (fileList) => {
    if (!canActAsContractor) { alert("شما مجوز ثبت اقدام اصلاحی را ندارید"); return; }
    const files = Array.from(fileList || []).slice(0, 2 - actionPhotos.length);
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
    if (!canActAsContractor) { alert("شما مجوز ثبت اقدام اصلاحی را ندارید"); return; }
    if (!actionText.trim()) return;
    if (actionPhotos.length > 0 && isOnline()) {
      const { allowed, storageMb } = await checkUploadAllowed();
      if (!allowed) {
        alert(`فضای ذخیره‌سازی پر شده است (${storageMb} مگابایت). لطفاً ابتدا از بخش «آرشیو فایل‌ها» عکس‌های قدیمی را حذف کنید، یا اقدام اصلاحی را بدون عکس ثبت کنید.`);
        return;
      }
    }
    setActionSaving(true);
    if (actionPhotos.length > 0) {
      for (const p of actionPhotos) {
        await offlineWriteFile({
          module: "anomalyPhotos", table: "anomaly_photos", bucket: "anomaly-photos",
          id: uid("photo"), includeIdInPayload: false,
          base64Data: p, contentType: "image/jpeg", fileFieldName: "photo",
          extraFields: { anomaly_id: a.id, stage: "fix" },
        });
      }
    }
    const newPhotoCount = a.photoCount + actionPhotos.length;
    const patch = { status: "pending_review", contractorAction: actionText.trim(), photoCount: newPhotoCount };
    await offlineWrite({ module: "anomalies", table: "anomalies", action: "update", id: a.id, payload: anomalyPatchToDb(patch) });
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch, syncStatus: isOnline() ? "synced" : "pending" } : x)));
    setPhotosMap((prev) => ({ ...prev, [a.id]: undefined }));
    setActionSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const approveAnomaly = async (a) => {
    if (!isReviewer) { alert("شما مجوز تأیید را ندارید"); return; }
    setReviewSaving(true);
    const patch = { status: "Closed", closeDate: todayISO() };
    await offlineWrite({ module: "anomalies", table: "anomalies", action: "update", id: a.id, payload: anomalyPatchToDb(patch) });
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch, syncStatus: isOnline() ? "synced" : "pending" } : x)));
    setReviewSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const rejectAnomaly = async (a) => {
    if (!isReviewer) { alert("شما مجوز رد کردن را ندارید"); return; }
    setReviewSaving(true);
    const patch = { status: "open", reviewNote: rejectNote.trim() };
    await offlineWrite({ module: "anomalies", table: "anomalies", action: "update", id: a.id, payload: anomalyPatchToDb(patch) });
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch, syncStatus: isOnline() ? "synced" : "pending" } : x)));
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

  if (linkedChatId) {
    return <ChatThread conversationId={linkedChatId} currentUser={currentUser} onBack={() => setLinkedChatId(null)} />;
  }
  if (linkedHcmsId) {
    return <HcmsDashboard focusAnomalyId={linkedHcmsId} currentUser={currentUser} onBack={() => setLinkedHcmsId(null)} />;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
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

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          style={{ ...styles.smallButton, flex: 1, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={() => exportAnomaliesExcel(sorted, isContractor ? `آنومالی‌های ${currentUser?.name || "پیمانکار"}` : "لیست آنومالی‌ها")}
          disabled={sorted.length === 0}
        >
          <FileSpreadsheet size={15} /> خروجی Excel
        </button>
        <button
          type="button"
          style={{ ...styles.smallButton, flex: 1, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={() => exportAnomaliesPdf(sorted, isContractor ? `آنومالی‌های ${currentUser?.name || "پیمانکار"}` : "لیست آنومالی‌ها")}
          disabled={sorted.length === 0}
        >
          <FileText size={15} /> خروجی PDF
        </button>
      </div>

      <h3 style={{ marginTop: 22, fontSize: 15.5, color: THEME.navy, fontWeight: 700 }}>موارد ثبت‌شده ({sorted.length})</h3>

      <DataView
        items={sorted}
        getId={(a) => a.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="جستجو (شماره، پیمانکار، ناحیه، شرح)..."
        sortOptions={[{ value: "newest", label: "جدیدترین" }, { value: "oldest", label: "قدیمی‌ترین" }, { value: "risk", label: "سطح ریسک" }]}
        sortValue={sort}
        onSortChange={setSort}
        filterSlot={
          <>
            <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} dir="rtl">
              <option value="all">همه وضعیت‌ها</option>
              <option value="not_closed">هنوز بسته نشده (باز + در انتظار تأیید)</option>
              <option value="open">باز</option>
              <option value="pending_review">در انتظار تأیید</option>
              <option value="Closed">بسته</option>
            </select>
            <select style={styles.filterSelect} value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} dir="rtl">
              <option value="all">همه سطوح ریسک</option>
              {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.value}</option>)}
            </select>
          </>
        }
        bulkActions={isReviewer && !readOnly ? [{ label: "حذف گروهی", danger: true, onClick: handleBulkDelete }] : null}
        emptyMessage="موردی یافت نشد"
        columns={[
          {
            key: "tracking", label: "شماره / ریسک",
            render: (a) => (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: THEME.navy }}>{a.trackingNumber}</span>
                <StatusPill label={a.riskLevel} color={riskMeta(a.riskLevel).color} bg={riskMeta(a.riskLevel).bg} />
                {a.syncStatus && a.syncStatus !== "synced" && (
                  <SyncStatusBadge
                    status={a.syncStatus}
                    onRetry={async (e) => {
                      e.stopPropagation();
                      const queue = await getQueue();
                      const item = queue.find((q) => q.module === "anomalies" && q.recordId === a.id);
                      if (item) { await retryItemNow(item.queueId); load(); }
                      else load();
                    }}
                  />
                )}
              </div>
            ),
          },
          { key: "desc", label: "شرح", render: (a) => <span style={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</span> },
          {
            key: "meta", label: "ناحیه / پیمانکار",
            render: (a) => <span style={{ fontSize: 11.5, color: THEME.text3 }}>{a.area} {a.contractor && `· ${a.contractor}`} {a.date && `· ${isoToJalaliDisplay(a.date)}`}</span>,
          },
          {
            key: "status", label: "وضعیت",
            render: (a) => {
              const sm = statusMeta(a.status);
              return <StatusPill label={sm.label} color={sm.color} bg={sm.bg} />;
            },
          },
        ]}
        renderRowActions={(a) => (
          <button type="button" style={styles.smallButton} onClick={() => startExpand(a)}>
            {expandedId === a.id ? "بستن" : "مشاهده"}
          </button>
        )}
        renderCard={(a) => {
          const rm = riskMeta(a.riskLevel);
          const sm = statusMeta(a.status);
          const isOpenCard = expandedId === a.id;
          return (
            <div style={{ ...styles.card, width: "auto", margin: 0, borderInlineStart: `4px solid ${rm.color}`, padding: "18px 20px", height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => startExpand(a)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: THEME.navy, fontSize: 14.5 }}>{a.trackingNumber}</span>
                    <StatusPill label={a.riskLevel} color={rm.color} bg={rm.bg} />
                    <span style={{ ...styles.badge, color: sm.color, background: sm.bg }}>
                      <sm.Icon size={12} style={{ display: "inline", marginLeft: 3 }} />{sm.label}
                    </span>
                    {a.category && <span style={styles.badge}>{a.category}</span>}
                    {a.syncStatus && a.syncStatus !== "synced" && (
                      <SyncStatusBadge
                        status={a.syncStatus}
                        onRetry={async (e) => {
                          e.stopPropagation();
                          const queue = await getQueue();
                          const item = queue.find((q) => q.module === "anomalies" && q.recordId === a.id);
                          if (item) { await retryItemNow(item.queueId); load(); }
                          else load();
                        }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 9, color: THEME.text }}>{a.description}</div>
                  <div style={{ fontSize: 11.5, color: THEME.text3, marginTop: 7, fontWeight: 500 }}>
                    {a.area} {a.contractor && `· ${a.contractor}`} {a.date && `· ${isoToJalaliDisplay(a.date)}`} {a.sender && `· ثبت توسط ${a.sender}`}
                  </div>
                </div>
                <ChevronRight size={18} color={THEME.text3} style={{ transform: isOpenCard ? "rotate(-90deg)" : "none", transition: "transform .15s", flexShrink: 0, marginRight: 6 }} />
              </div>
            </div>
          );
        }}
      />

      {expandedId && (() => {
        const a = sorted.find((x) => x.id === expandedId);
        if (!a) return null;
        const photos = photosMap[a.id] || [];
        const reportPhotos = photos.filter((p) => p.stage !== "fix");
        const fixPhotos = photos.filter((p) => p.stage === "fix");
        return (
          <div style={{ ...styles.card, width: "auto", marginTop: 14, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14.5, color: THEME.navy, fontWeight: 700 }}>{a.trackingNumber}</h3>
              <button type="button" style={{ ...styles.smallButton, background: THEME.teal, display: "flex", alignItems: "center", gap: 6 }} onClick={() => openLinkedChat(a)} disabled={linkedChatBusy}>
                <MessageCircle size={13} /> {linkedChatBusy ? "..." : "چت درباره این مورد"}
              </button>
              <button type="button" style={{ ...styles.smallButton, background: THEME.navyMid, display: "flex", alignItems: "center", gap: 6 }} onClick={() => openLinkedHcms(a)} disabled={linkedHcmsBusy}>
                <ShieldAlert size={13} /> {linkedHcmsBusy ? "..." : "ارزیابی ریسک HCMS"}
              </button>
            </div>

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

                <label style={styles.label}>عکس اقدام اصلاحی ({actionPhotos.length}/2)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ ...styles.smallButton, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden", opacity: actionPhotoBusy || actionPhotos.length >= 2 ? 0.5 : 1, pointerEvents: actionPhotoBusy || actionPhotos.length >= 2 ? "none" : "auto" }}>
                    <Camera size={16} /> گرفتن عکس
                    <input type="file" accept="image/*" capture="environment" style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} onChange={(e) => { handleActionPickFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                  <label style={{ ...styles.smallButton, flex: 1, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden", opacity: actionPhotoBusy || actionPhotos.length >= 2 ? 0.5 : 1, pointerEvents: actionPhotoBusy || actionPhotos.length >= 2 ? "none" : "auto" }}>
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
        );
      })()}

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
const MODULE_ICON = { profile: User, chat: MessageCircle, anomalyReport: AlertTriangle, personnelAccess: Users, managementDashboard: BarChart3 };

// ---------- ردیف منوی استاندارد (آیکون + عنوان + شورون) ----------
// ---------- هدر مشترک داشبورد (آواتار + نام + عنوان شغلی + اعلان/تنظیمات/خروج) ----------
const headerIconBtnStyle = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 9, cursor: "pointer",
};

function DashboardHeader({ panelLabelKey, currentUser, onLogout, onOpenSettings, smartItems, onNavigate }) {
  const { t, dir } = useLanguage();
  return (
    <div style={{ ...styles.topBar, direction: dir }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto" }}>
        <Avatar name={currentUser?.name} size={38} bg="rgba(255,255,255,0.18)" />
        <div style={{ minWidth: 0, lineHeight: 1.35 }}>
          <div style={styles.appNameTag}>{t(panelLabelKey)}</div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60vw" }}>{currentUser?.name || "—"}</div>
          {currentUser?.jobPositionTitle && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60vw" }}>{currentUser.jobPositionTitle}</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <OnlineIndicator />
        {smartItems && <NotificationPanel smartItems={smartItems} onNavigate={onNavigate} />}
        <button type="button" onClick={onOpenSettings} style={headerIconBtnStyle} title={t("settingsTooltip")}>
          <Settings size={16} color="#fff" />
        </button>
        <button style={{ ...styles.logoutButton, padding: "8px clamp(10px, 3vw, 16px)" }} onClick={onLogout}><LogOut size={14} style={{ marginLeft: 6 }} />{t("logout")}</button>
      </div>
    </div>
  );
}

function MenuRow({ icon: IconEl, label, onClick, accent, muted, sub, badge }) {
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
        {badge > 0 && (
          <span style={{ background: THEME.danger, color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, minWidth: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
            {badge}
          </span>
        )}
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
  const { t, dir } = useLanguage();
  const mt = (m) => (m?.labelKey ? t(m.labelKey) : m?.label);
  const [view, setView] = usePersistedState("ihms_view_admin", "menu");
  useEffect(() => { trackPageView(currentUser, view); }, [view]);
  const [navFilter, setNavFilter] = useState(null);
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const load = () => loadUnreadTotal(currentUser?.username).then(setChatUnread);
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [currentUser?.username]);
  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const riskMod = HSE_MODULES.find((m) => m.key === "riskAssessment");
  const personnelMod = HSE_MODULES.find((m) => m.key === "personnelAccess");
  const machineryMod = HSE_MODULES.find((m) => m.key === "machineryManagement");
  const scaffoldMod = HSE_MODULES.find((m) => m.key === "scaffoldManagement");
  const managementMod = HSE_MODULES.find((m) => m.key === "managementDashboard");

  useEffect(() => {
    loadPersonnelList().then(checkAndUpdateDeadlines); // فقط برای انتقال خودکار به «منقضی»
  }, []);

  const handleHomeNavigate = (target) => {
    setNavFilter(target);
    if (target.module === "personnel") setView("personnelDashboard");
    else if (target.module === "anomaly") setView("anomalyList");
    else if (target.module === "machinery") setView("machineryDashboard");
    else if (target.module === "scaffold") setView("scaffoldDashboard");
  };

  return (
    <div style={{ ...styles.dashboardWrapper, direction: dir }}>
      <DashboardHeader panelLabelKey="panelAdmin" currentUser={currentUser} onLogout={onLogout} onOpenSettings={() => setView("profile")} />

      {view === "menu" && (
        <div style={styles.menuList}>
          <DbSizeWarningBanner />
          <MenuRow icon={MessageCircle} label={t("moduleChat")} onClick={() => setView("chat")} badge={chatUnread} />
          <MenuRow icon={AlertTriangle} label={mt(anomalyMod)} onClick={() => setView("anomalyReport")} accent sub />
          <MenuRow icon={ShieldCheck} label={mt(riskMod)} onClick={() => setView("riskAssessment")} accent sub />
          <MenuRow icon={Users} label={mt(personnelMod)} onClick={() => setView("personnelAccess")} accent sub />
          <MenuRow icon={Truck} label={mt(machineryMod)} onClick={() => setView("machineryManagement")} accent sub />
          <MenuRow icon={Tag} label={mt(scaffoldMod)} onClick={() => setView("scaffoldManagement")} accent sub />
          <MenuRow icon={BarChart3} label={mt(managementMod)} onClick={() => setView("managementDashboard")} accent />
          <MenuRow icon={BarChart3} label={t("moduleAdminAnalytics")} onClick={() => setView("adminAnalytics")} />
          <MenuRow icon={Settings} label={t("moduleSystemManagement")} onClick={() => setView("systemManagement")} accent sub />
        </div>
      )}

      {view === "systemManagement" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{t("moduleSystemManagement")}</h3>
          <div style={styles.menuList2}>
            <MenuRow icon={Users} label={t("subEmployerAccounts")} onClick={() => setView("employers")} />
            <MenuRow icon={ShieldCheck} label={t("subContractors")} onClick={() => setView("contractors")} />
            <MenuRow icon={ShieldCheck} label={t("subPermissions")} onClick={() => setView("permissionManagement")} />
            <MenuRow icon={Briefcase} label={t("subJobPositions")} onClick={() => setView("jobPositionManagement")} />
            <MenuRow icon={Archive} label={t("moduleArchive")} onClick={() => setView("archiveManagement")} />
            <MenuRow icon={Tag} label={t("subScaffoldCodes")} onClick={() => setView("scaffoldCodeManagement")} />
            <MenuRow icon={GraduationCap} label={t("subTraining")} onClick={() => setView("trainingManagement")} />
            <MenuRow icon={ShieldOff} label={t("subChatAccess")} onClick={() => setView("chatAccessManagement")} />
            <MenuRow icon={ShieldAlert} label={t("subHcmsMatrix")} onClick={() => setView("hcmsMatrixManagement")} />
            <MenuRow icon={Database} label={t("subRiskKnowledge")} onClick={() => setView("riskKnowledgeManagement")} />
            <MenuRow icon={Tag} label={t("subAnomalyCategories")} onClick={() => setView("anomalyCategoryManagement")} />
          </div>
        </div>
      )}

      {view === "trainingManagement" && <TrainingManager onBack={() => setView("systemManagement")} />}
      {view === "chatAccessManagement" && <ChatAccessManager onBack={() => setView("systemManagement")} />}
      {view === "hcmsMatrixManagement" && <HcmsMatrixManager onBack={() => setView("systemManagement")} />}
      {view === "riskKnowledgeManagement" && <RiskKnowledgeManager onBack={() => setView("systemManagement")} currentUser={currentUser} />}
      {view === "anomalyCategoryManagement" && <AnomalyCategoryManager onBack={() => setView("systemManagement")} />}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(anomalyMod)}</h3>
          <div style={styles.menuList2}>
            {anomalyMod.sub.map((s) => (
              <MenuRow key={s.key} icon={AlertTriangle} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "riskAssessment" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(riskMod)}</h3>
          <div style={styles.menuList2}>
            {riskMod.sub.map((s) => (
              <MenuRow key={s.key} icon={ShieldCheck} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "personnelAccess" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(personnelMod)}</h3>
          <div style={styles.menuList2}>
            {personnelMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Users} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "machineryManagement" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(machineryMod)}</h3>
          <div style={styles.menuList2}>
            {machineryMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Truck} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "scaffoldManagement" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(scaffoldMod)}</h3>
          <div style={styles.menuList2}>
            {scaffoldMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Tag} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel={t("roleLabelAdmin")} />}
      {view === "chat" && <ChatDashboard onBack={() => setView("menu")} currentUser={currentUser} />}
      {view === "employers" && <EmployerAccountManager onBack={() => setView("systemManagement")} />}
      {view === "contractors" && <ContractorManager onBack={() => setView("systemManagement")} />}
      {view === "anomalyForm" && <AnomalyForm onBack={() => setView("anomalyReport")} currentUser={currentUser} onSaved={() => setView("anomalyList")} />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="ADMIN" currentUser={currentUser} initialStatusFilter={navFilter?.module === "anomaly" ? navFilter.statusFilter : undefined} initialRiskFilter={navFilter?.module === "anomaly" ? navFilter.riskFilter : undefined} initialContractorFilter={navFilter?.module === "anomaly" ? navFilter.contractorFilter : undefined} />}
      {view === "bowtieDashboard" && <BowTieDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} readOnly={false} />}
      {view === "hcmsDashboard" && <HcmsDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} />}
      {view === "personnelForm" && <PersonnelForm onBack={() => setView("personnelAccess")} currentUser={currentUser} onSaved={() => setView("personnelAccess")} />}
      {view === "personnelDashboard" && <PersonnelDashboard onBack={() => setView("personnelAccess")} currentUser={currentUser} role="ADMIN" initialStatusFilter={navFilter?.module === "personnel" ? navFilter.statusFilter : undefined} initialContractorFilter={navFilter?.module === "personnel" ? navFilter.contractorFilter : undefined} />}
      {view === "machineryDashboard" && <MachineryDashboard onBack={() => setView("machineryManagement")} currentUser={currentUser} role="ADMIN" initialApprovalFilter={navFilter?.module === "machinery" ? navFilter.approvalFilter : undefined} initialContractorFilter={navFilter?.module === "machinery" ? navFilter.contractorFilter : undefined} />}
      {view === "scaffoldDashboard" && <ScaffoldDashboard onBack={() => setView("scaffoldManagement")} currentUser={currentUser} role="ADMIN" initialStatusFilter={navFilter?.module === "scaffold" ? navFilter.statusFilter : undefined} initialContractorFilter={navFilter?.module === "scaffold" ? navFilter.contractorFilter : undefined} />}
      {view === "scaffoldCodeManagement" && <ScaffoldTagCodeManager onBack={() => setView("systemManagement")} />}
      {view === "managementDashboard" && <HomeDashboard role="ADMIN" currentUser={currentUser} onNavigate={handleHomeNavigate} onBack={() => setView("menu")} />}
      {view === "permissionManagement" && <PermissionManager onBack={() => setView("systemManagement")} />}
      {view === "jobPositionManagement" && <JobPositionManager onBack={() => setView("systemManagement")} />}
      {view === "adminAnalytics" && <AdminAnalytics onBack={() => setView("menu")} currentUser={currentUser} />}
      {view === "archiveManagement" && <ArchiveManager onBack={() => setView("systemManagement")} currentUser={currentUser} />}
    </div>
  );
}

// ---------- پنل کارفرما ----------
function EmployerDashboard({ onLogout, currentUser }) {
  const { t, dir } = useLanguage();
  const mt = (m) => (m?.labelKey ? t(m.labelKey) : m?.label);
  const [view, setView] = usePersistedState("ihms_view_employer", "menu");
  useEffect(() => { trackPageView(currentUser, view); }, [view]);
  const [navFilter, setNavFilter] = useState(null);
  const [permMap, setPermMap] = useState({});
  const [smartItems, setSmartItems] = useState([]);
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const load = () => loadUnreadTotal(currentUser?.username).then(setChatUnread);
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [currentUser?.username]);
  const canEdit = currentUser?.canEdit !== false;

  useEffect(() => {
    loadPermissionsMap("employer", currentUser?.id).then(setPermMap);
  }, [currentUser?.id]);

  const loadNotifs = async () => {
    const [allPersonnel, allAnomalies, allMachinery] = await Promise.all([loadPersonnelList(), loadAnomaliesOfflineFirst(), loadMachineryListOfflineFirst()]);
    await checkAndUpdateDeadlines(allPersonnel); // فقط برای انتقال خودکار به «منقضی» — دیگر اعلان ثبت نمی‌کند
    setSmartItems([
      ...computeSmartNotifications(allPersonnel, allAnomalies), // بدون scopeContractorName → تجمیعی به‌ازای هر پیمانکار
      ...computeMachinerySmartItems(allMachinery),
      // داربست عمداً اینجا نیست — طبق خواسته‌ی کاربر، این ماژول توی زنگوله اعلان نمی‌شود
    ]);
  };
  useEffect(() => { loadNotifs(); }, []);

  const openModule = (mod) => {
    if (mod.key === "profile") { setView("profile"); return; }
    if (mod.key === "chat") { setView("chat"); return; }
    if (mod.key === "archiveManagement") { setView("archiveManagement"); return; }
    if (!isModuleVisible(permMap, mod.key)) { alert("شما مجوز دسترسی به این بخش را ندارید"); return; }
    if (mod.employerOnly && !canEdit) { alert("این بخش فقط با دسترسی کامل در دسترس است"); return; }
    if (mod.key === "managementDashboard") { setView("managementDashboard"); return; }
    if (mod.sub) { setView(mod.key); return; }
    alert(`ماژول «${mt(mod)}» به‌زودی اضافه می‌شود`);
  };

  const handleHomeNavigate = (target) => {
    setNavFilter(target);
    if (target.module === "personnel") setView("personnelDashboard");
    else if (target.module === "anomaly") setView("anomalyList");
    else if (target.module === "machinery") setView("machineryDashboard");
    else if (target.module === "scaffold") setView("scaffoldDashboard");
  };

  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const anomalyCanEdit = canEdit && getAccessLevel(permMap, "anomalyReport") !== "view";
  const anomalySub = anomalyMod.sub.filter((s) => anomalyCanEdit || !s.employerOnly);
  const riskMod = HSE_MODULES.find((m) => m.key === "riskAssessment");
  const personnelMod = HSE_MODULES.find((m) => m.key === "personnelAccess");
  const machineryMod = HSE_MODULES.find((m) => m.key === "machineryManagement");
  const scaffoldMod = HSE_MODULES.find((m) => m.key === "scaffoldManagement");

  return (
    <div style={{ ...styles.dashboardWrapper, direction: dir }}>
      <DashboardHeader
        panelLabelKey={canEdit ? "panelEmployer" : "panelEmployerViewOnly"}
        currentUser={currentUser}
        onLogout={onLogout}
        onOpenSettings={() => setView("profile")}
        smartItems={smartItems}
        onNavigate={handleHomeNavigate}
      />

      {view === "menu" && (
        <div style={styles.menuList}>
          {HSE_MODULES.filter((mod) => isModuleVisible(permMap, mod.key)).map((mod) => (
            <MenuRow
              key={mod.key}
              icon={MODULE_ICON[mod.key] || LayoutGrid}
              label={mt(mod)}
              onClick={() => openModule(mod)}
              accent={!!mod.icon}
              muted={mod.employerOnly && !canEdit}
              sub={!!mod.sub}
              badge={mod.key === "chat" ? chatUnread : undefined}
            />
          ))}
        </div>
      )}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(anomalyMod)}</h3>
          <div style={styles.menuList2}>
            {anomalySub.map((s) => (
              <MenuRow key={s.key} icon={AlertTriangle} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "riskAssessment" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(riskMod)}</h3>
          <div style={styles.menuList2}>
            {riskMod.sub.map((s) => (
              <MenuRow key={s.key} icon={ShieldCheck} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "personnelAccess" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(personnelMod)}</h3>
          <div style={styles.menuList2}>
            {personnelMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Users} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "machineryManagement" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(machineryMod)}</h3>
          <div style={styles.menuList2}>
            {machineryMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Truck} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "scaffoldManagement" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(scaffoldMod)}</h3>
          <div style={styles.menuList2}>
            {scaffoldMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Tag} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel={canEdit ? t("roleLabelEmployer") : t("roleLabelEmployerViewOnly")} />}
      {view === "chat" && <ChatDashboard onBack={() => setView("menu")} currentUser={currentUser} />}
      {view === "riskKnowledgeManagement" && <RiskKnowledgeManager onBack={() => setView("riskAssessment")} currentUser={currentUser} />}
      {view === "anomalyForm" && anomalyCanEdit && <AnomalyForm onBack={() => setView("anomalyReport")} currentUser={currentUser} onSaved={() => setView("anomalyList")} />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="EMPLOYER" currentUser={currentUser} readOnly={!canEdit || getAccessLevel(permMap, "anomalyReport") === "view"} initialStatusFilter={navFilter?.module === "anomaly" ? navFilter.statusFilter : undefined} initialRiskFilter={navFilter?.module === "anomaly" ? navFilter.riskFilter : undefined} initialContractorFilter={navFilter?.module === "anomaly" ? navFilter.contractorFilter : undefined} />}
      {view === "bowtieDashboard" && <BowTieDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} readOnly={!canEdit || getAccessLevel(permMap, "riskAssessment") === "view"} />}
      {view === "hcmsDashboard" && <HcmsDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} />}
      {view === "archiveManagement" && <ArchiveManager onBack={() => setView("menu")} currentUser={currentUser} />}
      {view === "personnelForm" && <PersonnelForm onBack={() => setView("personnelAccess")} currentUser={currentUser} onSaved={() => setView("personnelAccess")} />}
      {view === "personnelDashboard" && <PersonnelDashboard onBack={() => setView("personnelAccess")} currentUser={currentUser} role="EMPLOYER" readOnly={!canEdit || getAccessLevel(permMap, "personnelAccess") === "view"} initialStatusFilter={navFilter?.module === "personnel" ? navFilter.statusFilter : undefined} initialContractorFilter={navFilter?.module === "personnel" ? navFilter.contractorFilter : undefined} />}
      {view === "machineryDashboard" && <MachineryDashboard onBack={() => setView("machineryManagement")} currentUser={currentUser} role="EMPLOYER" readOnly={!canEdit || getAccessLevel(permMap, "machineryManagement") === "view"} initialApprovalFilter={navFilter?.module === "machinery" ? navFilter.approvalFilter : undefined} initialContractorFilter={navFilter?.module === "machinery" ? navFilter.contractorFilter : undefined} />}
      {view === "scaffoldDashboard" && <ScaffoldDashboard onBack={() => setView("scaffoldManagement")} currentUser={currentUser} role="EMPLOYER" readOnly={!canEdit || getAccessLevel(permMap, "scaffoldManagement") === "view"} initialStatusFilter={navFilter?.module === "scaffold" ? navFilter.statusFilter : undefined} initialContractorFilter={navFilter?.module === "scaffold" ? navFilter.contractorFilter : undefined} />}
      {view === "managementDashboard" && <HomeDashboard role="EMPLOYER" currentUser={currentUser} onNavigate={handleHomeNavigate} onBack={() => setView("menu")} />}
    </div>
  );
}

// ---------- پنل پیمانکار ----------
function ContractorDashboard({ onLogout, currentUser }) {
  const { t, dir } = useLanguage();
  const mt = (m) => (m?.labelKey ? t(m.labelKey) : m?.label);
  const [view, setView] = usePersistedState("ihms_view_contractor", "menu");
  useEffect(() => { trackPageView(currentUser, view); }, [view]);
  const [navFilter, setNavFilter] = useState(null);
  const [permMap, setPermMap] = useState({});
  const [smartItems, setSmartItems] = useState([]);
  const riskMod = HSE_MODULES.find((m) => m.key === "riskAssessment");
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const load = () => loadUnreadTotal(currentUser?.username).then(setChatUnread);
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [currentUser?.username]);

  useEffect(() => {
    loadPermissionsMap("contractor", currentUser?.id).then(setPermMap);
  }, [currentUser?.id]);

  const loadNotifs = async () => {
    const [personnelList, allAnomalies, allMachinery] = await Promise.all([loadPersonnelList(), loadAnomaliesOfflineFirst(), loadMachineryListOfflineFirst()]);
    await checkAndUpdateDeadlines(personnelList); // فقط برای انتقال خودکار به «منقضی» — دیگر اعلان ثبت نمی‌کند
    setSmartItems([
      ...computeSmartNotifications(personnelList, allAnomalies, currentUser?.name),
      ...computeMachinerySmartItems(allMachinery, currentUser?.name),
      // داربست عمداً اینجا نیست — طبق خواسته‌ی کاربر، این ماژول توی زنگوله اعلان نمی‌شود
    ]);
  };
  useEffect(() => { loadNotifs(); }, []);

  const openModule = (mod) => {
    if (mod.key === "profile") { setView("profile"); return; }
    if (mod.key === "chat") { setView("chat"); return; }
    if (mod.key === "archiveManagement") { setView("archiveManagement"); return; }
    if (!isModuleVisible(permMap, mod.key)) { alert("شما مجوز دسترسی به این بخش را ندارید"); return; }
    if (mod.employerOnly) { alert("این بخش فقط برای کارفرما/ادمین در دسترس است"); return; }
    if (mod.key === "managementDashboard") { setView("managementDashboard"); return; }
    if (mod.sub) { setView(mod.key); return; }
    alert(`ماژول «${mt(mod)}» به‌زودی اضافه می‌شود`);
  };

  const handleHomeNavigate = (target) => {
    setNavFilter(target);
    if (target.module === "personnel") setView("personnelDashboard");
    else if (target.module === "anomaly") setView("anomalyList");
    else if (target.module === "machinery") setView("machineryDashboard");
    else if (target.module === "scaffold") setView("scaffoldDashboard");
  };

  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const anomalySub = anomalyMod.sub.filter((s) => !s.employerOnly);
  const personnelMod = HSE_MODULES.find((m) => m.key === "personnelAccess");
  const machineryMod = HSE_MODULES.find((m) => m.key === "machineryManagement");
  const scaffoldMod = HSE_MODULES.find((m) => m.key === "scaffoldManagement");

  return (
    <div style={{ ...styles.dashboardWrapper, direction: dir }}>
      <DashboardHeader
        panelLabelKey="panelContractor"
        currentUser={currentUser}
        onLogout={onLogout}
        onOpenSettings={() => setView("profile")}
        smartItems={smartItems}
        onNavigate={handleHomeNavigate}
      />

      {view === "menu" && (
        <div style={styles.menuList}>
          {HSE_MODULES.filter((mod) => isModuleVisible(permMap, mod.key)).map((mod) => (
            <MenuRow
              key={mod.key}
              icon={MODULE_ICON[mod.key] || LayoutGrid}
              label={mt(mod)}
              onClick={() => openModule(mod)}
              accent={!!mod.icon}
              muted={!!mod.employerOnly}
              sub={!!mod.sub}
              badge={mod.key === "chat" ? chatUnread : undefined}
            />
          ))}
        </div>
      )}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(anomalyMod)}</h3>
          <div style={styles.menuList2}>
            {anomalySub.map((s) => (
              <MenuRow key={s.key} icon={AlertTriangle} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "personnelAccess" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(personnelMod)}</h3>
          <div style={styles.menuList2}>
            {personnelMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Users} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "machineryManagement" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(machineryMod)}</h3>
          <div style={styles.menuList2}>
            {machineryMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Truck} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "scaffoldManagement" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(scaffoldMod)}</h3>
          <div style={styles.menuList2}>
            {scaffoldMod.sub.map((s) => (
              <MenuRow key={s.key} icon={Tag} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "riskAssessment" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>{t("backToMenu")}</div>
          <h3 style={{ marginBottom: 12, color: THEME.navy }}>{mt(riskMod)}</h3>
          <div style={styles.menuList2}>
            {riskMod.sub.filter((s) => !s.employerOnly).map((s) => (
              <MenuRow key={s.key} icon={ShieldCheck} label={mt(s)} onClick={() => setView(s.key)} accent />
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel={t("roleLabelContractor")} />}
      {view === "chat" && <ChatDashboard onBack={() => setView("menu")} currentUser={currentUser} />}
      {view === "hcmsDashboard" && <HcmsDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} />}
      {view === "bowtieDashboard" && <BowTieDashboard onBack={() => setView("riskAssessment")} currentUser={currentUser} readOnly={getAccessLevel(permMap, "riskAssessment") === "view"} />}
      {view === "archiveManagement" && <ArchiveManager onBack={() => setView("menu")} currentUser={currentUser} />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="CONTRACTOR" currentUser={currentUser} readOnly={getAccessLevel(permMap, "anomalyReport") === "view"} initialStatusFilter={navFilter?.module === "anomaly" ? navFilter.statusFilter : undefined} initialRiskFilter={navFilter?.module === "anomaly" ? navFilter.riskFilter : undefined} />}
      {view === "personnelForm" && getAccessLevel(permMap, "personnelAccess") !== "view" && <PersonnelForm onBack={() => setView("personnelAccess")} currentUser={currentUser} onSaved={() => setView("personnelAccess")} />}
      {view === "personnelDashboard" && <PersonnelDashboard onBack={() => setView("personnelAccess")} currentUser={currentUser} role="CONTRACTOR" readOnly={getAccessLevel(permMap, "personnelAccess") === "view"} initialStatusFilter={navFilter?.module === "personnel" ? navFilter.statusFilter : undefined} />}
      {view === "machineryDashboard" && <MachineryDashboard onBack={() => setView("machineryManagement")} currentUser={currentUser} role="CONTRACTOR" readOnly={getAccessLevel(permMap, "machineryManagement") === "view"} initialApprovalFilter={navFilter?.module === "machinery" ? navFilter.approvalFilter : undefined} />}
      {view === "scaffoldDashboard" && <ScaffoldDashboard onBack={() => setView("scaffoldManagement")} currentUser={currentUser} role="CONTRACTOR" readOnly={getAccessLevel(permMap, "scaffoldManagement") === "view"} initialStatusFilter={navFilter?.module === "scaffold" ? navFilter.statusFilter : undefined} />}
      {view === "managementDashboard" && <HomeDashboard role="CONTRACTOR" currentUser={currentUser} onNavigate={handleHomeNavigate} onBack={() => setView("menu")} />}
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
  const [currentUser, setCurrentUser] = usePersistedState("ihms_current_user", null);
  // آیا در همین اجرای برنامه (از باز شدن اپ تا الان)، اگر بیومتریک برای
  // این کاربر فعال بود، قبلاً با موفقیت تأیید شده؟ با هر بار setCurrentUser
  // (ورود جدید یا خروج) دوباره false می‌شود، پس هر نشست تازه دوباره از
  // گیت بیومتریک رد می‌شود.
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);

  // متغیر ماژولی «شرکت فعلی» با رفرش صفحه پاک می‌شود؛ ولی currentUser از
  // localStorage بازیابی می‌شود، پس همین‌جا دوباره تنظیمش می‌کنیم. همچنین
  // موقع خروج باید صفر شود، وگرنه ورود بعدی (حتی برای شرکت دیگر) با زمینه‌ی
  // شرکت قبلی فیلتر می‌شود و شکست می‌خورد.
  useEffect(() => {
    setCurrentCompanyId(currentUser ? currentUser.companyId || null : null);
  }, [currentUser]);

  // ورود تازه و صریح با رمز عبور، خودش یک احراز هویت کامل است — نیازی
  // نیست بلافاصله بعدش دوباره گیت بیومتریک هم نشان داده شود. گیت
  // بیومتریک فقط برای زمانی است که نشست، بدون تایپ دوباره‌ی رمز، از
  // localStorage با باز شدن اپ بازیابی می‌شود (همان‌جا که biometricUnlocked
  // با مقدار اولیه‌ی false شروع می‌شود).
  const handleLogin = (user) => {
    setBiometricUnlocked(true);
    setCurrentUser(user);
  };

  // خروج کامل: طبق الزام صریح، باید اعتبار ورود بیومتریک را هم باطل کند
  // (نه فقط نشست جاری را پاک کند) — یعنی بعد از خروج، حتی با اثر انگشت
  // هم دیگر بدون وارد کردن دوباره‌ی رمز عبور نمی‌شود وارد شد.
  // خروج معمولی («خروج» در هدر) فقط همین نشست را می‌بندد — بیومتریک را
  // باطل نمی‌کند، وگرنه کاربر باید بعد از هر بار خروج دوباره فعالش کند و
  // کل قابلیت عملاً بی‌فایده می‌شد (دقیقاً مثل اپ‌های بانکی: خروج معمولی
  // چیزی به Face ID/اثر انگشت کاری ندارد). ابطال بیومتریک، یک اقدام
  // صریح و جداست: فقط با خاموش‌کردن کلید در «پروفایل → امنیت» اتفاق می‌افتد.
  const handleLogout = () => {
    trackLogout(currentUser);
    setBiometricUnlocked(false);
    setCurrentUser(null);
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  // نشستِ ذخیره‌شده وجود دارد؛ اگر برای همین کاربر بیومتریک فعال است و
  // هنوز در این اجرای برنامه تأیید نشده، به‌جای رفتن مستقیم به داشبورد،
  // اول باید اثر انگشت/چهره تأیید شود.
  if (isBiometricEnabledFor(currentUser.username) && !biometricUnlocked) {
    return (
      <BiometricGateScreen
        currentUser={currentUser}
        onUnlocked={(user) => { setCurrentUser(user); setBiometricUnlocked(true); }}
        onFallbackToPassword={() => setCurrentUser(null)}
      />
    );
  }

  if (currentUser.role === "ADMIN") return <AdminDashboard onLogout={handleLogout} currentUser={currentUser} />;
  if (currentUser.role === "EMPLOYER") return <EmployerDashboard onLogout={handleLogout} currentUser={currentUser} />;
  return <ContractorDashboard onLogout={handleLogout} currentUser={currentUser} />;
}

// مسیر Super Admin کاملاً جدا از درخت بالاست — هیچ حساب کارفرما/پیمانکار/ادمین
// معمولی هرگز این کامپوننت‌ها را نمی‌بیند، چون فقط با آدرس مخفی #super-admin
// (نه از طریق هیچ دکمه یا لینکی در رابط کاربری عادی) قابل‌دسترسیه، و کلید
// نشست‌ش هم جدا از ihms_current_user است.
function SuperAdminRoot() {
  const [admin, setAdmin] = usePersistedState("ihms_super_admin", null);
  if (!admin) return <SuperAdminLogin onLogin={setAdmin} />;
  return <SuperAdminPanel currentAdmin={admin} onLogout={() => setAdmin(null)} />;
}

export default function App() {
  const isSuperAdminRoute = typeof window !== "undefined" && window.location.hash === "#super-admin";
  return (
    <ErrorBoundary>
      <LanguageProvider>
        {isSuperAdminRoute ? <SuperAdminRoot /> : <AppInner />}
      </LanguageProvider>
    </ErrorBoundary>
  );
}


