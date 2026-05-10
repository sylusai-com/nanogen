"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import ElementRenderer from "./ElementRenderer";
import { buildStandaloneHtml, exportRenderSize } from "@/lib/bannerDownload";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

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
  const isSpaceDown = useRef(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [spaceCursor, setSpaceCursor] = useState(false);

  // Single source of truth for design dimensions — this is the same
  // logical canvas size used by BannerPreview, the export rasterizer,
  // and the SVG embed. Keeping them aligned guarantees pixel-identical
  // rendering across builder ⇆ preview ⇆ download.
  const { width: CANVAS_W, height: CANVAS_H } = exportRenderSize(aspect);

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
  }, [CANVAS_W, CANVAS_H, onZoomChange]);

  useEffect(() => {
    fitToContainer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  useEffect(() => {
    if (zoom === 0.001) fitToContainer();
  }, [zoom, fitToContainer]);

  // Keep the canvas centered when the container resizes, only when the
  // canvas comfortably fits inside.
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
  }, [initialized, zoom, CANVAS_W, CANVAS_H]);

  // Wheel: ⌘/Ctrl+wheel zooms (cursor-anchored), bare wheel pans.
  // Trackpad two-finger scroll naturally produces wheel events with
  // both deltaX and deltaY, so this gives Figma/Canva-style panning
  // for free. We always preventDefault so horizontal swipe-to-navigate
  // (Chrome's two-finger gesture for back/forward) is suppressed
  // whenever the cursor is over the canvas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
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
      } else {
        // Pan. Hold Shift to lock to horizontal scroll-only mice.
        const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        setOffset((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, onZoomChange]);

  // Space-to-pan: holding spacebar + dragging anywhere pans the canvas
  // (Figma convention). We track the keydown globally on the window so
  // the user doesn't need to focus the canvas first.
  useEffect(() => {
    const isTextField = (target) => {
      const tag = target?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || target?.isContentEditable;
    };
    const onKeyDown = (e) => {
      if (e.code === "Space" && !isTextField(e.target)) {
        if (!isSpaceDown.current) {
          isSpaceDown.current = true;
          setSpaceCursor(true);
        }
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        isSpaceDown.current = false;
        setSpaceCursor(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Mouse-driven panning: middle button, Alt+drag, or Space+drag.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMouseDown = (e) => {
      const wantsPan =
        e.button === 1 ||
        (e.button === 0 && (e.altKey || isSpaceDown.current));
      if (!wantsPan) return;
      e.preventDefault();
      e.stopPropagation();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      el.style.cursor = "grabbing";
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

  const screenW = CANVAS_W * zoom;
  const screenH = CANVAS_H * zoom;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{
        background: "var(--canvas-bg, #0d0d10)",
        // Stop browsers from interpreting horizontal trackpad swipes
        // as back/forward navigation while the cursor is over the
        // canvas — that gesture is reserved for panning here.
        overscrollBehavior: "contain",
        touchAction: "none",
        cursor: spaceCursor ? "grab" : undefined,
      }}
    >
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
              if (e.target === e.currentTarget) onDeselectAll?.();
            }}
          >
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

          {/* Pan-mode hint */}
          {spaceCursor && (
            <div
              className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 select-none rounded-full bg-black/70 px-3 py-1 text-[10px] font-medium text-white shadow-lg"
            >
              Hold space + drag to pan
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default forwardRef(Canvas);
