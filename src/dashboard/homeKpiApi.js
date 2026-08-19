import { loadDashboardAnomalies } from "./homeDashboardApi.js";
import { loadPersonnelListOfflineFirst } from "../personnel/personnelApi.js";
import { loadCorrectiveActions } from "../correctiveActions/correctiveActionsApi.js";
import { loadIncidents } from "../incidents/incidentsApi.js";

/**
 * خلاصه‌ی KPI صفحه‌ی اصلی دسکتاپ — کاملاً تجمیعی و فقط‌خواندنی، بدون
 * هیچ جدول یا منطق جدید: هرکدام مستقیم از همان لایه‌های داده‌ی موجود
 * (anomalies، personnel، corrective_actions، incidents) که از قبل در
 * سایر بخش‌های سیستم استفاده می‌شوند، شمارش می‌کند.
 */
export async function loadHomeKpiSummary() {
  const [anomalies, personnel, correctiveActions, incidents] = await Promise.all([
    loadDashboardAnomalies().catch(() => []),
    loadPersonnelListOfflineFirst().catch(() => []),
    loadCorrectiveActions().catch(() => []),
    loadIncidents().catch(() => []),
  ]);

  return {
    openAnomalies: anomalies.filter((a) => a.status !== "Closed").length,
    activePersonnel: personnel.filter((p) => p.status === "active").length,
    openCorrectiveActions: correctiveActions.filter((c) => c.status !== "closed").length,
    incidentsCount: incidents.length,
  };
}
