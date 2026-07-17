import * as XLSX from "xlsx";
import { bowtieStatusMeta } from "./bowtieApi.js";

/**
 * Export helpers for the BowTie canvas.
 *
 * PNG  — serializes the live SVG element and rasterizes it via an offscreen
 *        <canvas> at 2x scale for crisp output. (Note: foreignObject-based
 *        text can occasionally render inconsistently across browsers when
 *        rasterized this way — Chrome/Edge handle it reliably, Safari can be
 *        finicky. If that becomes a real issue we should switch node labels
 *        from foreignObject to native SVG <text>.)
 * PDF  — reuses the same browser-print technique already used for Anomaly
 *        Report exports: embed the SVG in a new tab and trigger window.print(),
 *        so the user saves it as PDF. This renders through the browser's
 *        normal engine (not canvas), so it doesn't have the foreignObject risk.
 * Excel — tabular listing of every Barrier + its Escalation Factors/Controls,
 *        via the `xlsx` package already used elsewhere in the app.
 */

export function exportCanvasPng(svgEl, filename, scale = 2) {
  return new Promise((resolve, reject) => {
    try {
      const clone = svgEl.cloneNode(true);
      const bbox = svgEl.getBoundingClientRect();
      const w = Math.max(1, Math.round(bbox.width));
      const h = Math.max(1, Math.round(bbox.height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", w);
      clone.setAttribute("height", h);

      const svgString = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f7f9fb";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${filename}.png`;
          link.click();
          resolve();
        }, "image/png");
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

export function exportCanvasPdf(svgEl, title) {
  const win = window.open("", "_blank");
  if (!win) { alert("اجازه‌ی باز شدن پنجره‌ی جدید داده نشد؛ لطفاً popup blocker مرورگر را غیرفعال کنید."); return; }
  const bbox = svgEl.getBoundingClientRect();
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "100%");
  clone.setAttribute("viewBox", `0 0 ${Math.round(bbox.width)} ${Math.round(bbox.height)}`);
  const svgString = new XMLSerializer().serializeToString(clone);

  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; direction: rtl; padding: 16px; }
    h2 { text-align: center; margin-bottom: 4px; }
    p.meta { text-align: center; color: #666; font-size: 12px; margin-top: 0; }
    svg { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; }
    @media print { @page { size: landscape; margin: 10mm; } }
  </style></head>
  <body>
    <h2>${escapeHtml(title)}</h2>
    <p class="meta">BowTie Risk Analysis — Integrated HSE Management System</p>
    ${svgString}
  </body></html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function escapeHtml(s) {
  return String(s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

export function exportBowtieExcel(bowtie, threats, consequences, barriers, escalationFactors, escalationControls, filename) {
  const nameOfThreat = (id) => threats.find((t) => t.id === id)?.label || "";
  const nameOfCons = (id) => consequences.find((c) => c.id === id)?.label || "";

  const barrierRows = barriers.map((b, idx) => ({
    "ردیف": idx + 1,
    "نوع": b.side === "preventive" ? "پیشگیرانه" : "بازیابی",
    "متصل به": b.side === "preventive" ? nameOfThreat(b.threatId) : nameOfCons(b.consequenceId),
    "عنوان مانع": b.label,
    "مسئول": b.owner,
    "بحرانی بودن": b.criticality,
    "وضعیت": bowtieStatusMeta(b.status)?.label || b.status,
    "کنترل بحرانی": b.isCriticalControl ? "بله" : "خیر",
    "تاریخ راستی‌آزمایی": b.verificationDate || "",
  }));

  const escalationRows = [];
  escalationFactors.forEach((f) => {
    const parentBarrier = barriers.find((b) => b.id === f.barrierId);
    const controls = escalationControls.filter((c) => c.escalationFactorId === f.id);
    if (controls.length === 0) {
      escalationRows.push({
        "مانع مرتبط": parentBarrier?.label || "", "عامل تشدیدکننده": f.label, "کنترل تشدید": "", "مسئول": "", "وضعیت": "",
      });
    } else {
      controls.forEach((c) => {
        escalationRows.push({
          "مانع مرتبط": parentBarrier?.label || "", "عامل تشدیدکننده": f.label, "کنترل تشدید": c.label,
          "مسئول": c.owner, "وضعیت": c.status,
        });
      });
    }
  });

  const wb = XLSX.utils.book_new();

  const infoWs = XLSX.utils.json_to_sheet([{
    "عنوان": bowtie.title, "خطر (Hazard)": bowtie.hazard, "رویداد اصلی (Top Event)": bowtie.topEvent,
    "سایت": bowtie.site, "دپارتمان": bowtie.department, "وضعیت": bowtieStatusMeta(bowtie.status)?.label,
  }]);
  XLSX.utils.book_append_sheet(wb, infoWs, "BowTie");

  const barriersWs = XLSX.utils.json_to_sheet(barrierRows);
  XLSX.utils.book_append_sheet(wb, barriersWs, "Barriers");

  if (escalationRows.length > 0) {
    const escWs = XLSX.utils.json_to_sheet(escalationRows);
    XLSX.utils.book_append_sheet(wb, escWs, "Escalation");
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
