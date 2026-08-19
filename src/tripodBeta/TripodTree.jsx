import React from "react";
import { THEME } from "../shared.js";

/**
 * پورت React از tree-render.js اصلی — همان هندسه، همان رنگ‌ها، همان
 * منطق چیدمان ستون‌ها (اشکال پنهان -> پیش‌شرط -> اشکال سطحی -> رویداد).
 */
const NODE_W = 165, NODE_H = 46, GAP_Y = 12, COL_GAP = 55;
const COLS = { hidden: 0, precond: 1, surface: 2, event: 3 };
const colX = (name) => 60 + COLS[name] * (NODE_W + COL_GAP);

export default function TripodTree({ eventDescription, branches }) {
  const paths = (branches || []).filter((b) => b.surfaceFailureText);

  const laneRows = paths.map((p) => {
    let rows = 0;
    (p.preconditions || []).forEach((pc) => { rows += Math.max((pc.hiddenFailures || []).length, 1); });
    return Math.max(rows, 1);
  });
  const totalRows = laneRows.reduce((a, b) => a + b, 0) || 1;
  const totalHeight = Math.max(220, totalRows * (NODE_H + GAP_Y) + 90);
  const width = (NODE_W + COL_GAP) * 4 + 100;
  const eventY = totalHeight / 2 - NODE_H / 2;

  const boxes = [];
  const lines = [];

  boxes.push({ x: colX("event"), y: eventY, fill: "#f8d7d5", stroke: "#b3261e", text: "رویداد: " + (eventDescription || "(ثبت نشده)"), small: false, key: "event" });

  let cursorY = 30;
  paths.forEach((p, idx) => {
    const rows = laneRows[idx];
    const laneH = rows * (NODE_H + GAP_Y);
    const surfaceY = cursorY + laneH / 2 - NODE_H / 2;
    const typeLabel = p.surfaceFailureType === "unsafe_condition" ? "شرایط ناایمن" : "اعمال ناایمن";

    boxes.push({ x: colX("surface"), y: surfaceY, fill: "#fdf1de", stroke: "#c07a12", text: `مسیر ${p.pathNo} (${typeLabel}): ${p.surfaceFailureText}`, small: true, key: `surf-${p.id}` });
    lines.push({ x1: colX("surface") + NODE_W, y1: surfaceY + NODE_H / 2, x2: colX("event"), y2: eventY + NODE_H / 2, color: "#c07a12", key: `line-surf-${p.id}` });

    let rowCursor = cursorY;
    (p.preconditions || []).forEach((pc) => {
      const hidItems = pc.hiddenFailures && pc.hiddenFailures.length ? pc.hiddenFailures : [null];
      const pcRows = hidItems.length;
      const pcH = pcRows * (NODE_H + GAP_Y);
      const pcY = rowCursor + pcH / 2 - NODE_H / 2;

      boxes.push({ x: colX("precond"), y: pcY, fill: "#eaf0fa", stroke: "#5b7fbd", text: `${pc.code}: ${pc.text}`, small: true, key: `pc-${pc.id}` });
      lines.push({ x1: colX("precond") + NODE_W, y1: pcY + NODE_H / 2, x2: colX("surface"), y2: surfaceY + NODE_H / 2, color: "#5b7fbd", key: `line-pc-${pc.id}` });

      hidItems.forEach((h, hi) => {
        const hy = rowCursor + hi * (NODE_H + GAP_Y);
        if (h) {
          boxes.push({ x: colX("hidden"), y: hy, fill: "#fbe9e7", stroke: "#d98c86", text: `${h.code} [${h.brfCode || "-"}]: ${h.text}`, small: true, key: `hf-${h.id}` });
          lines.push({ x1: colX("hidden") + NODE_W, y1: hy + NODE_H / 2, x2: colX("precond"), y2: pcY + NODE_H / 2, color: "#d98c86", key: `line-hf-${h.id}` });
        }
      });
      rowCursor += pcH;
    });
    cursorY += laneH;
  });

  const headers = [["hidden", "اشکال پنهان"], ["precond", "پیش‌شرط"], ["surface", "اشکال سطحی (مسیر)"], ["event", "رویداد"]];

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: THEME.text2, marginBottom: 10 }}>
        <LegendDot color="#1f3864" label="رویداد" />
        <LegendDot color="#c07a12" label="اشکال سطحی (مسیر)" />
        <LegendDot color="#5b7fbd" label="پیش‌شرط" />
        <LegendDot color="#d98c86" label="اشکال پنهان" />
      </div>
      <div style={{ overflowX: "auto", direction: "ltr", border: `1px solid ${THEME.border}`, borderRadius: 10, background: THEME.surface }}>
        <svg viewBox={`0 0 ${width} ${totalHeight}`} width={Math.max(width, 900)} height={totalHeight}>
          {headers.map(([key, label]) => (
            <text key={key} x={colX(key) + NODE_W / 2} y={18} textAnchor="middle" fontFamily="Vazirmatn, Tahoma, sans-serif" fontSize="11" fontWeight="700" fill="#64748b">{label}</text>
          ))}
          {lines.map((l) => {
            const mx = (l.x1 + l.x2) / 2;
            return <path key={l.key} d={`M ${l.x1} ${l.y1} C ${mx} ${l.y1}, ${mx} ${l.y2}, ${l.x2} ${l.y2}`} fill="none" stroke={l.color} strokeWidth={1.6} />;
          })}
          {boxes.map((b) => (
            <g key={b.key}>
              <rect x={b.x} y={b.y} width={NODE_W} height={NODE_H} rx={8} fill={b.fill} stroke={b.stroke} strokeWidth={1.4} />
              <foreignObject x={b.x + 4} y={b.y + 2} width={NODE_W - 8} height={NODE_H - 4}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ direction: "rtl", fontFamily: "'Vazirmatn','Tahoma',sans-serif", fontSize: b.small ? 10 : 11, lineHeight: 1.25, color: "#16233d", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", height: "100%", overflow: "hidden", padding: "0 3px" }}>
                  {b.text}
                </div>
              </foreignObject>
            </g>
          ))}
          {paths.length === 0 && (
            <text x={width / 2} y={totalHeight / 2} textAnchor="middle" fill="#64748b" fontFamily="Vazirmatn, Tahoma, sans-serif">هنوز هیچ مسیر تحلیلی تکمیل نشده است.</text>
          )}
        </svg>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
