import React, { useState, useRef } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { isPdfDataUrl } from "./fileHelpers.js";

/**
 * Full-screen in-app document viewer.
 * Images: pinch/scroll-to-zoom + drag-to-pan (no new tab).
 * PDFs: rendered inline via <iframe> on the base64 data URL (no new tab).
 */
export default function DocumentViewerModal({ src, onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  if (!src) return null;
  const isPdf = isPdfDataUrl(src);

  const zoomBy = (f) => setScale((s) => Math.min(4, Math.max(1, +(s * f).toFixed(2))));
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  const onPointerDown = (e) => {
    if (scale <= 1) return;
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPos({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
  };
  const onPointerUp = () => { dragRef.current = null; };
  const onWheel = (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 0.87); };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", top: 16, insetInlineEnd: 16, display: "flex", gap: 8, zIndex: 5 }} onClick={(e) => e.stopPropagation()}>
        {!isPdf && (
          <>
            <IconBtn onClick={() => zoomBy(1.25)}><ZoomIn size={17} color="#fff" /></IconBtn>
            <IconBtn onClick={() => zoomBy(0.8)}><ZoomOut size={17} color="#fff" /></IconBtn>
            <IconBtn onClick={reset}><RotateCcw size={17} color="#fff" /></IconBtn>
          </>
        )}
        <IconBtn onClick={onClose}><X size={18} color="#fff" /></IconBtn>
      </div>

      {isPdf ? (
        <iframe
          src={src}
          title="پیش‌نمایش PDF"
          style={{ width: "94vw", height: "88vh", border: "none", borderRadius: 8, background: "#fff" }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={src}
          alt="پیش‌نمایش مدرک"
          onClick={(e) => e.stopPropagation()}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onDoubleClick={() => (scale > 1 ? reset() : zoomBy(2))}
          style={{
            maxWidth: "94vw",
            maxHeight: "88vh",
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragRef.current ? "none" : "transform .15s",
            cursor: scale > 1 ? "grab" : "zoom-in",
            touchAction: "none",
            borderRadius: 6,
          }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}
