import React, { useState, useRef } from "react";
import { Plus, ZoomIn, ZoomOut, Maximize2, ShieldAlert } from "lucide-react";
import { THEME } from "../shared.js";
import {
  insertThreat, updateThreatDB, deleteThreatDB,
  insertConsequence, updateConsequenceDB, deleteConsequenceDB,
  insertBarrier, updateBarrierDB, deleteBarrierDB,
  insertEscalationFactor, updateEscalationFactorDB, deleteEscalationFactorDB,
  insertEscalationControl, updateEscalationControlDB, deleteEscalationControlDB,
  BARRIER_STATUS,
} from "./bowtieApi.js";
import NodeInspectorPanel from "./NodeInspectorPanel.jsx";

/**
 * Hand-built SVG canvas (Path A: no React Flow).
 * Coordinate space is a fixed internal 1400x760 "world"; pan/zoom is done
 * by transforming a single <g> wrapper, and dragging converts screen deltas
 * to world-space deltas via the SVG's inverse CTM so it stays accurate at
 * any zoom level.
 *
 * Phase 4 additions: Escalation Factors hang below their Barrier, Escalation
 * Controls hang below their Escalation Factor — same drag/select/inspector
 * mechanics as every other node, just one more level deep. All connectors
 * (threat/consequence chains AND escalation drop-lines) now render as smooth
 * cubic-bezier curves instead of straight polylines.
 */

const WORLD_W = 1400;
const WORLD_H = 900;
const TOP_EVENT = { x: WORLD_W / 2, y: 300 };
const LEFT_X = 110;
const RIGHT_X = WORLD_W - 110;
const ROW_GAP = 130;
const NODE_W = 128;
const NODE_H = 56;
const ESC_DROP = 95; // vertical distance from a barrier down to its escalation factor, and factor down to control

function statusMeta(v) {
  return BARRIER_STATUS.find((s) => s.value === v) || BARRIER_STATUS[0];
}

function laneY(index) {
  return 90 + index * ROW_GAP;
}

function barrierPositions(anchorX, targetX, count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    positions.push(anchorX + (targetX - anchorX) * t);
  }
  return positions;
}

// spreads `count` children horizontally, centered under `parentX`
function childXs(parentX, count, gap = 90) {
  const start = parentX - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, i) => start + i * gap);
}

// smooth horizontal S-curve through an ordered list of [x,y] points
function curvedPathH(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const mx = x1 + (x2 - x1) / 2;
    d += ` C ${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  return d;
}

// smooth vertical S-curve for drop-lines (barrier → escalation factor → control)
function curvedPathV(x1, y1, x2, y2) {
  const my = y1 + (y2 - y1) / 2;
  return `M ${x1},${y1} C ${x1},${my} ${x2},${my} ${x2},${y2}`;
}

export default function BowTieCanvas({ bowtie, threats, consequences, barriers, escalationFactors, escalationControls, onDataChange, readOnly }) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ scale: 0.62, tx: 40, ty: 20 });
  const [selected, setSelected] = useState(null);
  const dragRef = useRef(null);
  const [, forceTick] = useState(0);
  const liveOverridesRef = useRef({});

  const threatsForBowtie = threats;
  const consForBowtie = consequences;

  const toWorld = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: (p.x - view.tx) / view.scale, y: (p.y - view.ty) / view.scale };
  };

  const nodePos = (node, defaultX, defaultY) => ({
    x: node.posX ? node.posX : defaultX,
    y: node.posY ? node.posY : defaultY,
  });

  const displayPos = (id, fallbackX, fallbackY) => liveOverridesRef.current[id] || { x: fallbackX, y: fallbackY };

  const threatPositions = threatsForBowtie.map((t, i) => nodePos(t, LEFT_X, laneY(i)));
  const consPositions = consForBowtie.map((c, i) => nodePos(c, RIGHT_X, laneY(i)));

  const barriersFor = (side, parentId) =>
    barriers.filter((b) => (side === "preventive" ? b.threatId === parentId : b.consequenceId === parentId));
  const factorsFor = (barrierId) => escalationFactors.filter((f) => f.barrierId === barrierId);
  const controlsFor = (factorId) => escalationControls.filter((c) => c.escalationFactorId === factorId);

  const beginNodeDrag = (e, kind, node, currentX, currentY) => {
    if (readOnly) return;
    e.stopPropagation();
    const start = toWorld(e.clientX, e.clientY);
    dragRef.current = { kind: "node", nodeKind: kind, id: node.id, offX: currentX - start.x, offY: currentY - start.y, moved: false };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
  };

  const beginPan = (e) => {
    dragRef.current = { kind: "pan", startClientX: e.clientX, startClientY: e.clientY, startTx: view.tx, startTy: view.ty, moved: false };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
  };

  const onWindowPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === "pan") {
      d.moved = true;
      setView((v) => ({ ...v, tx: d.startTx + (e.clientX - d.startClientX), ty: d.startTy + (e.clientY - d.startClientY) }));
    } else if (d.kind === "node") {
      d.moved = true;
      const p = toWorld(e.clientX, e.clientY);
      liveOverridesRef.current[d.id] = { x: p.x + d.offX, y: p.y + d.offY };
      forceTick((n) => n + 1);
    }
  };

  const onWindowPointerUp = async () => {
    const d = dragRef.current;
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    if (!d) return;
    if (d.kind === "node") {
      if (d.moved) {
        const pos = liveOverridesRef.current[d.id];
        if (pos) {
          if (d.nodeKind === "threat") await updateThreatDB(d.id, { posX: pos.x, posY: pos.y });
          else if (d.nodeKind === "consequence") await updateConsequenceDB(d.id, { posX: pos.x, posY: pos.y });
          else if (d.nodeKind === "barrier") await updateBarrierDB(d.id, { posX: pos.x, posY: pos.y });
          else if (d.nodeKind === "escalationFactor") await updateEscalationFactorDB(d.id, { posX: pos.x, posY: pos.y });
          else if (d.nodeKind === "escalationControl") await updateEscalationControlDB(d.id, { posX: pos.x, posY: pos.y });
          onDataChange();
        }
      } else {
        setSelected({ type: d.nodeKind, id: d.id });
      }
      delete liveOverridesRef.current[d.id];
    }
    dragRef.current = null;
  };

  const zoomBy = (factor) => setView((v) => ({ ...v, scale: Math.min(2.2, Math.max(0.3, v.scale * factor)) }));
  const resetView = () => setView({ scale: 0.62, tx: 40, ty: 20 });
  const onWheel = (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.08 : 0.93); };

  const addThreat = async () => {
    const label = prompt("عنوان تهدید (Threat) جدید:");
    if (!label || !label.trim()) return;
    await insertThreat(bowtie.id, label.trim(), threatsForBowtie.length);
    onDataChange();
  };
  const addConsequence = async () => {
    const label = prompt("عنوان پیامد (Consequence) جدید:");
    if (!label || !label.trim()) return;
    await insertConsequence(bowtie.id, label.trim(), consForBowtie.length);
    onDataChange();
  };
  const addBarrier = async (side, parentId) => {
    const label = prompt(side === "preventive" ? "عنوان مانع پیشگیرانه (Preventive Barrier):" : "عنوان مانع بازیابی (Recovery Barrier):");
    if (!label || !label.trim()) return;
    const count = barriersFor(side, parentId).length;
    await insertBarrier({
      bowtieId: bowtie.id, side, threatId: side === "preventive" ? parentId : null,
      consequenceId: side === "recovery" ? parentId : null, orderIndex: count, label: label.trim(),
    });
    onDataChange();
  };
  const addEscalationFactor = async (barrierId) => {
    const label = prompt("عنوان عامل تشدیدکننده (Escalation Factor):");
    if (!label || !label.trim()) return;
    await insertEscalationFactor(barrierId, label.trim(), factorsFor(barrierId).length);
    onDataChange();
  };
  const addEscalationControl = async (factorId) => {
    const label = prompt("عنوان کنترل تشدید (Escalation Control):");
    if (!label || !label.trim()) return;
    await insertEscalationControl(factorId, label.trim(), controlsFor(factorId).length);
    onDataChange();
  };

  const handleInspectorSave = async (type, id, patch) => {
    if (type === "threat") await updateThreatDB(id, patch);
    else if (type === "consequence") await updateConsequenceDB(id, patch);
    else if (type === "barrier") await updateBarrierDB(id, patch);
    else if (type === "escalationFactor") await updateEscalationFactorDB(id, patch);
    else if (type === "escalationControl") await updateEscalationControlDB(id, patch);
    onDataChange();
    setSelected(null);
  };
  const handleInspectorDelete = async (type, id) => {
    if (!confirm("این المان حذف شود؟")) return;
    if (type === "threat") await deleteThreatDB(id);
    else if (type === "consequence") await deleteConsequenceDB(id);
    else if (type === "barrier") await deleteBarrierDB(id);
    else if (type === "escalationFactor") await deleteEscalationFactorDB(id);
    else if (type === "escalationControl") await deleteEscalationControlDB(id);
    onDataChange();
    setSelected(null);
  };

  const selectedNode =
    selected?.type === "threat" ? threatsForBowtie.find((t) => t.id === selected.id) :
    selected?.type === "consequence" ? consForBowtie.find((c) => c.id === selected.id) :
    selected?.type === "barrier" ? barriers.find((b) => b.id === selected.id) :
    selected?.type === "escalationFactor" ? escalationFactors.find((f) => f.id === selected.id) :
    selected?.type === "escalationControl" ? escalationControls.find((c) => c.id === selected.id) :
    null;

  const resolvedBarrierPos = {};
  threatsForBowtie.forEach((t, i) => {
    const tp = displayPos(t.id, ...Object.values(threatPositions[i]));
    const chain = barriersFor("preventive", t.id);
    const xs = barrierPositions(tp.x + NODE_W / 2, TOP_EVENT.x - 80, chain.length);
    chain.forEach((b, j) => { resolvedBarrierPos[b.id] = displayPos(b.id, xs[j], tp.y); });
  });
  consForBowtie.forEach((c, i) => {
    const cp = displayPos(c.id, ...Object.values(consPositions[i]));
    const chain = barriersFor("recovery", c.id);
    const xs = barrierPositions(TOP_EVENT.x + 80, cp.x - NODE_W / 2, chain.length);
    chain.forEach((b, j) => { resolvedBarrierPos[b.id] = displayPos(b.id, xs[j], cp.y); });
  });

  const resolvedFactorPos = {};
  barriers.forEach((b) => {
    const bp = resolvedBarrierPos[b.id];
    if (!bp) return;
    const chain = factorsFor(b.id);
    const xs = childXs(bp.x, chain.length);
    chain.forEach((f, i) => { resolvedFactorPos[f.id] = displayPos(f.id, xs[i], bp.y + ESC_DROP); });
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "74vh", background: "#f7f9fb", borderRadius: 14, border: `1px solid ${THEME.border}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 10, insetInlineStart: 10, zIndex: 5, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!readOnly && (
          <>
            <button type="button" onClick={addThreat} style={toolBtnStyle(THEME.teal)}><Plus size={13} /> تهدید</button>
            <button type="button" onClick={addConsequence} style={toolBtnStyle("#c2410c")}><Plus size={13} /> پیامد</button>
          </>
        )}
      </div>
      <div style={{ position: "absolute", top: 10, insetInlineEnd: 10, zIndex: 5, display: "flex", gap: 6 }}>
        <button type="button" onClick={() => zoomBy(1.15)} style={iconBtnStyle}><ZoomIn size={15} /></button>
        <button type="button" onClick={() => zoomBy(0.87)} style={iconBtnStyle}><ZoomOut size={15} /></button>
        <button type="button" onClick={resetView} style={iconBtnStyle}><Maximize2 size={15} /></button>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onWheel={onWheel}
        onPointerDown={(e) => { if (e.target === svgRef.current || e.target.dataset?.bg) beginPan(e); }}
        style={{ cursor: dragRef.current?.kind === "pan" ? "grabbing" : "grab", touchAction: "none" }}
      >
        <rect data-bg="1" x={0} y={0} width="100%" height="100%" fill="#f7f9fb" />
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
          <g opacity={0.5}>
            {Array.from({ length: Math.ceil(WORLD_W / 40) }).map((_, i) => (
              <line key={"gx" + i} x1={i * 40} y1={0} x2={i * 40} y2={WORLD_H} stroke="#e7ebf0" strokeWidth={1} />
            ))}
            {Array.from({ length: Math.ceil(WORLD_H / 40) }).map((_, i) => (
              <line key={"gy" + i} x1={0} y1={i * 40} x2={WORLD_W} y2={i * 40} stroke="#e7ebf0" strokeWidth={1} />
            ))}
          </g>

          {threatsForBowtie.map((t, i) => {
            const tp = displayPos(t.id, ...Object.values(threatPositions[i]));
            const chain = barriersFor("preventive", t.id);
            let points = [[tp.x + NODE_W / 2, tp.y]];
            chain.forEach((b) => { const bp = resolvedBarrierPos[b.id]; points.push([bp.x, bp.y]); });
            points.push([TOP_EVENT.x - 80, TOP_EVENT.y]);
            return <path key={"tline" + t.id} d={curvedPathH(points)} fill="none" stroke={THEME.text3} strokeWidth={2} />;
          })}
          {consForBowtie.map((c, i) => {
            const cp = displayPos(c.id, ...Object.values(consPositions[i]));
            const chain = barriersFor("recovery", c.id);
            let points = [[TOP_EVENT.x + 80, TOP_EVENT.y]];
            chain.forEach((b) => { const bp = resolvedBarrierPos[b.id]; points.push([bp.x, bp.y]); });
            points.push([cp.x - NODE_W / 2, cp.y]);
            return <path key={"cline" + c.id} d={curvedPathH(points)} fill="none" stroke={THEME.text3} strokeWidth={2} />;
          })}
          {barriers.map((b) => {
            const bp = resolvedBarrierPos[b.id];
            if (!bp) return null;
            return factorsFor(b.id).map((f) => {
              const fp = resolvedFactorPos[f.id];
              const controlEls = controlsFor(f.id).map((ctl, k) => {
                const cxs = childXs(fp.x, controlsFor(f.id).length);
                const ccp = displayPos(ctl.id, cxs[k], fp.y + ESC_DROP);
                return (
                  <path key={"ecline" + ctl.id} d={curvedPathV(fp.x, fp.y + 20, ccp.x, ccp.y - 18)} fill="none" stroke="#d97706" strokeWidth={1.6} strokeDasharray="4 3" />
                );
              });
              return (
                <React.Fragment key={"efline" + f.id}>
                  <path d={curvedPathV(bp.x, bp.y + 28, fp.x, fp.y - 18)} fill="none" stroke="#d97706" strokeWidth={1.6} strokeDasharray="4 3" />
                  {controlEls}
                </React.Fragment>
              );
            });
          })}

          <g
            transform={`translate(${TOP_EVENT.x},${TOP_EVENT.y})`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setSelected({ type: "topEvent", id: bowtie.id })}
            style={{ cursor: "pointer" }}
          >
            <polygon points="-90,0 -55,-40 55,-40 90,0 55,40 -55,40" fill={THEME.navy} stroke={selected?.type === "topEvent" ? THEME.teal : "none"} strokeWidth={3} />
            <text textAnchor="middle" y={-4} fill="#fff" fontSize={12} fontWeight={700} fontFamily={THEME.font}>Top Event</text>
            <foreignObject x={-80} y={4} width={160} height={34}>
              <div style={{ color: "#cfe3ea", fontSize: 10.5, textAlign: "center", fontFamily: THEME.font, lineHeight: 1.3, padding: "0 4px" }}>
                {bowtie.topEvent.length > 40 ? bowtie.topEvent.slice(0, 40) + "…" : bowtie.topEvent}
              </div>
            </foreignObject>
          </g>

          {threatsForBowtie.map((t, i) => {
            const tp = displayPos(t.id, ...Object.values(threatPositions[i]));
            const chain = barriersFor("preventive", t.id);
            return (
              <React.Fragment key={t.id}>
                <RectNode x={tp.x} y={tp.y} fill="#fef3c7" stroke="#d97706" label={t.label}
                  selected={selected?.type === "threat" && selected.id === t.id}
                  onDown={(e) => beginNodeDrag(e, "threat", t, tp.x, tp.y)} />
                {chain.map((b) => (
                  <BarrierWithEscalation
                    key={b.id} barrier={b} pos={resolvedBarrierPos[b.id]}
                    factors={factorsFor(b.id)} resolvedFactorPos={resolvedFactorPos} controlsFor={controlsFor}
                    displayPos={displayPos} selected={selected} setSelected={setSelected}
                    beginNodeDrag={beginNodeDrag} readOnly={readOnly}
                    onAddFactor={() => addEscalationFactor(b.id)} onAddControl={addEscalationControl}
                  />
                ))}
                {!readOnly && (
                  <g transform={`translate(${tp.x + NODE_W / 2 + 60},${tp.y})`} onPointerDown={(e) => e.stopPropagation()} onClick={() => addBarrier("preventive", t.id)} style={{ cursor: "pointer" }}>
                    <circle r={11} fill="#fff" stroke={THEME.teal} strokeWidth={1.5} />
                    <text textAnchor="middle" y={4} fontSize={14} fill={THEME.teal} fontWeight={700}>+</text>
                  </g>
                )}
              </React.Fragment>
            );
          })}

          {consForBowtie.map((c, i) => {
            const cp = displayPos(c.id, ...Object.values(consPositions[i]));
            const chain = barriersFor("recovery", c.id);
            return (
              <React.Fragment key={c.id}>
                <RectNode x={cp.x} y={cp.y} fill="#fee2e2" stroke="#c92a2a" label={c.label}
                  selected={selected?.type === "consequence" && selected.id === c.id}
                  onDown={(e) => beginNodeDrag(e, "consequence", c, cp.x, cp.y)} />
                {chain.map((b) => (
                  <BarrierWithEscalation
                    key={b.id} barrier={b} pos={resolvedBarrierPos[b.id]}
                    factors={factorsFor(b.id)} resolvedFactorPos={resolvedFactorPos} controlsFor={controlsFor}
                    displayPos={displayPos} selected={selected} setSelected={setSelected}
                    beginNodeDrag={beginNodeDrag} readOnly={readOnly}
                    onAddFactor={() => addEscalationFactor(b.id)} onAddControl={addEscalationControl}
                  />
                ))}
                {!readOnly && (
                  <g transform={`translate(${cp.x - NODE_W / 2 - 60},${cp.y})`} onPointerDown={(e) => e.stopPropagation()} onClick={() => addBarrier("recovery", c.id)} style={{ cursor: "pointer" }}>
                    <circle r={11} fill="#fff" stroke={THEME.teal} strokeWidth={1.5} />
                    <text textAnchor="middle" y={4} fontSize={14} fill={THEME.teal} fontWeight={700}>+</text>
                  </g>
                )}
              </React.Fragment>
            );
          })}
        </g>
      </svg>

      {selectedNode !== undefined && selected && (
        <NodeInspectorPanel
          type={selected.type}
          node={selected.type === "topEvent" ? bowtie : selectedNode}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
          onSave={(patch) => handleInspectorSave(selected.type, selected.id, patch)}
          onDelete={selected.type === "topEvent" ? null : () => handleInspectorDelete(selected.type, selected.id)}
        />
      )}
    </div>
  );
}

function toolBtnStyle(bg) {
  return {
    display: "flex", alignItems: "center", gap: 4, background: bg, color: "#fff", border: "none",
    borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: THEME.font,
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  };
}
const iconBtnStyle = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, background: "#fff",
  border: `1px solid ${THEME.border}`, borderRadius: 8, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

function RectNode({ x, y, fill, stroke, label, selected, onDown }) {
  return (
    <g transform={`translate(${x},${y})`} onPointerDown={onDown} style={{ cursor: "grab" }}>
      <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx={9} fill={fill} stroke={selected ? THEME.teal : stroke} strokeWidth={selected ? 3 : 1.5} />
      <foreignObject x={-NODE_W / 2 + 6} y={-NODE_H / 2 + 4} width={NODE_W - 12} height={NODE_H - 8}>
        <div style={{ fontSize: 11.5, color: "#1e293b", fontFamily: THEME.font, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", lineHeight: 1.3, fontWeight: 600 }}>
          {label}
        </div>
      </foreignObject>
    </g>
  );
}

function BarrierNode({ x, y, barrier, selected, onDown }) {
  const sm = statusMeta(barrier.status);
  return (
    <g transform={`translate(${x},${y})`} onPointerDown={onDown} style={{ cursor: "grab" }}>
      <rect x={-46} y={-30} width={92} height={60} rx={8} fill="#fff" stroke={selected ? THEME.teal : "#cbd5e1"} strokeWidth={selected ? 3 : 1.5} />
      <rect x={-46} y={-30} width={7} height={60} rx={3} fill={sm.color} />
      {barrier.isCriticalControl && <g transform="translate(34,-22)"><ShieldAlert size={14} color="#c92a2a" /></g>}
      <foreignObject x={-38} y={-24} width={76} height={48}>
        <div style={{ fontSize: 10, color: "#1e293b", fontFamily: THEME.font, textAlign: "center", lineHeight: 1.25 }}>{barrier.label}</div>
      </foreignObject>
    </g>
  );
}

function EscalationFactorNode({ x, y, factor, selected, onDown }) {
  return (
    <g transform={`translate(${x},${y})`} onPointerDown={onDown} style={{ cursor: "grab" }}>
      <polygon points="0,-20 34,18 -34,18" fill="#fff7ed" stroke={selected ? THEME.teal : "#d97706"} strokeWidth={selected ? 3 : 1.5} />
      <foreignObject x={-32} y={-8} width={64} height={30}>
        <div style={{ fontSize: 8.5, color: "#7c2d12", fontFamily: THEME.font, textAlign: "center", lineHeight: 1.15 }}>{factor.label}</div>
      </foreignObject>
    </g>
  );
}

function EscalationControlNode({ x, y, control, selected, onDown }) {
  return (
    <g transform={`translate(${x},${y})`} onPointerDown={onDown} style={{ cursor: "grab" }}>
      <rect x={-34} y={-18} width={68} height={36} rx={18} fill="#fff" stroke={selected ? THEME.teal : "#d97706"} strokeWidth={selected ? 3 : 1.5} />
      <foreignObject x={-30} y={-14} width={60} height={28}>
        <div style={{ fontSize: 8.5, color: "#7c2d12", fontFamily: THEME.font, textAlign: "center", lineHeight: 1.15 }}>{control.label}</div>
      </foreignObject>
    </g>
  );
}

function BarrierWithEscalation({ barrier, pos, factors, resolvedFactorPos, controlsFor, displayPos, selected, setSelected, beginNodeDrag, readOnly, onAddFactor, onAddControl }) {
  if (!pos) return null;
  return (
    <>
      <BarrierNode
        x={pos.x} y={pos.y} barrier={barrier}
        selected={selected?.type === "barrier" && selected.id === barrier.id}
        onDown={(e) => beginNodeDrag(e, "barrier", barrier, pos.x, pos.y)}
      />
      {!readOnly && (
        <g transform={`translate(${pos.x},${pos.y + 42})`} onPointerDown={(e) => e.stopPropagation()} onClick={onAddFactor} style={{ cursor: "pointer" }}>
          <circle r={9} fill="#fff" stroke="#d97706" strokeWidth={1.4} />
          <text textAnchor="middle" y={3.5} fontSize={12} fill="#d97706" fontWeight={700}>+</text>
        </g>
      )}
      {factors.map((f) => {
        const fp = resolvedFactorPos[f.id];
        if (!fp) return null;
        const controls = controlsFor(f.id);
        const cxs = childXs(fp.x, controls.length);
        return (
          <React.Fragment key={f.id}>
            <EscalationFactorNode
              x={fp.x} y={fp.y} factor={f}
              selected={selected?.type === "escalationFactor" && selected.id === f.id}
              onDown={(e) => beginNodeDrag(e, "escalationFactor", f, fp.x, fp.y)}
            />
            {!readOnly && (
              <g transform={`translate(${fp.x},${fp.y + 40})`} onPointerDown={(e) => e.stopPropagation()} onClick={() => onAddControl(f.id)} style={{ cursor: "pointer" }}>
                <circle r={8} fill="#fff" stroke="#d97706" strokeWidth={1.3} />
                <text textAnchor="middle" y={3} fontSize={11} fill="#d97706" fontWeight={700}>+</text>
              </g>
            )}
            {controls.map((ctl, k) => {
              const ccp = displayPos(ctl.id, cxs[k], fp.y + ESC_DROP);
              return (
                <EscalationControlNode
                  key={ctl.id} x={ccp.x} y={ccp.y} control={ctl}
                  selected={selected?.type === "escalationControl" && selected.id === ctl.id}
                  onDown={(e) => beginNodeDrag(e, "escalationControl", ctl, ccp.x, ccp.y)}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}
