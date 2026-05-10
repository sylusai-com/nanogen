"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import ElementRenderer from "./ElementRenderer";
import { buildStandaloneHtml } from "@/lib/bannerDownload";

function aspectRatio(aspect) {
  const map = { "16:9": 9 / 16, "1:1": 1, "4:5": 5 / 4, "9:16": 16 / 9 };
  return map[aspect] || 9 / 16;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const CANVAS_W = 1200;

function Canvas(
  {
    elements,
    selectedId,
    background,
    aspect,
    html,
    css,
    fields,
    alignment,
    hiddenSlots,
    onSelectElement,
    onUpdateElement,
    onDeselectAll,
    onIframeLoad,
    zoom,
    onZoomChange,
    editingId,
    onStartEdit,
    onEndEdit,
    subjectImageUrl,
  },
  ref,
) {
  const containerRef = useRef(null);
  const surfaceRef = useRef(null);
  const iframeRef = useRef(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  const CANVAS_H = CANVAS_W * aspectRatio(aspect);

  useImperativeHandle(ref, () => ({
    getIframe: () => iframeRef.current,
    getContainer: () => containerRef.current,
  }), []);

  const fitToContainer = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!width || !height) return;
    const fitZoom = Math.min(
      (width * 0.86) / CANVAS_W,
      (height * 0.86) / CANVAS_H,
      1,
    );
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));
    setOffset({
      x: (width - CANVAS_W * next) / 2,
      y: (height - CANVAS_H * next) / 2,
    });
    onZoomChange?.(next);
    setInitialized(true);
  }, [CANVAS_H, onZoomChange]);

  // Initial fit + on aspect change
  useEffect(() => {
    fitToContainer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // External "fit to screen" sentinel value (parent sets zoom = 0.001)
  useEffect(() => {
    if (zoom === 0.001) fitToContainer();
  }, [zoom, fitToContainer]);

  // Re-center if container resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !initialized) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setOffset((prev) => {
        const cw = CANVAS_W * zoom;
        const ch = CANVAS_H * zoom;
        if (cw < width && ch < height) {
          return { x: (width - cw) / 2, y: (height - ch) / 2 };
        }
        return prev;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [initialized, zoom, CANVAS_H]);

  // Wheel zoom (Ctrl/Cmd + wheel)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));
      const scale = newZoom / zoom;
      setOffset((prev) => ({
        x: mx - (mx - prev.x) * scale,
        y: my - (my - prev.y) * scale,
      }));
      onZoomChange?.(newZoom);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, onZoomChange]);

  // Middle-mouse / Alt+drag panning
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMouseDown = (e) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        el.style.cursor = "grabbing";
      }
    };
    const onMouseMove = (e) => {
      if (!isPanning.current) return;
      setOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.x),
        y: panStart.current.oy + (e.clientY - panStart.current.y),
      });
    };
    const onMouseUp = () => {
      if (isPanning.current) {
        isPanning.current = false;
        el.style.cursor = "";
      }
    };
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [offset]);

  // Click on empty canvas area → deselect.
  // The iframe has pointer-events: none so clicks pass through to the
  // overlay div sibling. We attach the deselect handler to BOTH the
  // surface div and the elements overlay so any background click works.
  const onSurfaceMouseDown = useCallback((e) => {
    if (isPanning.current) return;
    // Element renderers stopPropagation on their own mousedowns, so any
    // event reaching here is a background click.
    onDeselectAll?.();
  }, [onDeselectAll]);

  const srcDoc = html && css
    ? buildStandaloneHtml({
        html,
        css,
        fields: fields || [],
        alignment: alignment || "left",
        title: "preview",
        hiddenSlots,
        subjectImageUrl: subjectImageUrl || null,
      })
    : null;

  // Screen-space size of the visible canvas (for the outer wrapper that
  // takes layout space; the inner uses transform scaling).
  const screenW = CANVAS_W * zoom;
  const screenH = CANVAS_H * zoom;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{ background: "var(--canvas-bg, #0d0d10)" }}
    >
      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: `${Math.max(16, 24 * zoom)}px ${Math.max(16, 24 * zoom)}px`,
          backgroundPosition: `${offset.x % (24 * zoom)}px ${offset.y % (24 * zoom)}px`,
        }}
      />

      {initialized && (
        <>
          {/* Outer wrapper — actual layout box at scaled size, gives
              the canvas a real footprint on screen for shadow/border. */}
          <div
            style={{
              position: "absolute",
              left: offset.x,
              top: offset.y,
              width: screenW,
              height: screenH,
              borderRadius: 8,
              boxShadow:
                "0 8px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
              background: background || "#0c0c10",
              overflow: "hidden",
            }}
            onMouseDown={(e) => {
              // Only deselect when the click was directly on this wrapper —
              // otherwise inner elements handle selection themselves.
              if (e.target === e.currentTarget) onDeselectAll?.();
            }}
          >
            {/* Inner — fixed logical size, scaled with CSS transform.
                The iframe always sees CANVAS_W × CANVAS_H so clamp/vw
                resolve to the same value at every zoom level. */}
            <div
              ref={surfaceRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                background: background || "#0c0c10",
              }}
            >
              {srcDoc && (
                <iframe
                  ref={iframeRef}
                  title="banner-base"
                  srcDoc={srcDoc}
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={() => onIframeLoad?.(iframeRef.current)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: CANVAS_W,
                    height: CANVAS_H,
                    border: "none",
                    pointerEvents: "none",
                  }}
                />
              )}

              <div
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) onDeselectAll?.();
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: CANVAS_W,
                  height: CANVAS_H,
                }}
              >
                {elements.map((el) => (
                  <ElementRenderer
                    key={el.id}
                    element={el}
                    isSelected={el.id === selectedId}
                    isEditing={el.id === editingId}
                    zoom={zoom}
                    canvasW={CANVAS_W}
                    canvasH={CANVAS_H}
                    containerRef={containerRef}
                    onSelect={onSelectElement}
                    onUpdateElement={onUpdateElement}
                    onStartEdit={onStartEdit}
                    onEndEdit={onEndEdit}
                  />
                ))}
              </div>

              {elements.length === 0 && !srcDoc && (
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 select-none"
                  style={{ color: "rgba(255,255,255,0.15)", fontSize: 14 }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  <span>Add elements from the left panel</span>
                </div>
              )}
            </div>
          </div>

          {/* Canvas size label */}
          <div
            className="pointer-events-none absolute select-none font-mono text-[10px]"
            style={{
              left: offset.x,
              top: offset.y + screenH + 8,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            {Math.round(CANVAS_W)} × {Math.round(CANVAS_H)} px · {Math.round(zoom * 100)}%
          </div>
        </>
      )}
    </div>
  );
}

export default forwardRef(Canvas);
