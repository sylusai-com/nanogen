"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ElementRenderer from "./ElementRenderer";
import { buildStandaloneHtml } from "@/lib/bannerDownload";

function aspectRatio(aspect) {
  const map = { "16:9": 9 / 16, "1:1": 1, "4:5": 5 / 4, "9:16": 16 / 9 };
  return map[aspect] || 9 / 16;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const CANVAS_W = 1200; // logical px

export default function Canvas({
  elements,
  selectedId,
  background,
  aspect,
  html,
  css,
  fields,
  alignment,
  onSelectElement,
  onUpdateElement,
  onDeselectAll,
  zoom,
  onZoomChange,
  editingId,
  onStartEdit,
  onEndEdit,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const iframeRef = useRef(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  const CANVAS_H = CANVAS_W * aspectRatio(aspect);

  // Center canvas on mount / aspect change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const fitZoom = Math.min(
      (width * 0.82) / CANVAS_W,
      (height * 0.82) / CANVAS_H,
      1
    );
    onZoomChange?.(fitZoom);
    setOffset({
      x: (width - CANVAS_W * fitZoom) / 2,
      y: (height - CANVAS_H * fitZoom) / 2,
    });
    setInitialized(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // Wheel zoom
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
      setOffset((prev) => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));
        const scale = newZoom / zoom;
        onZoomChange?.(newZoom);
        return {
          x: mx - (mx - prev.x) * scale,
          y: my - (my - prev.y) * scale,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, onZoomChange]);

  // Middle-mouse / space+drag panning
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

  const toCanvasCoords = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left - offset.x) / zoom / CANVAS_W) * 100,
      y: ((clientY - rect.top - offset.y) / zoom / CANVAS_H) * 100,
    };
  }, [offset, zoom, CANVAS_W, CANVAS_H]);

  const onCanvasMouseDown = useCallback((e) => {
    if (isPanning.current) return;
    if (e.target === canvasRef.current || e.target === iframeRef.current) {
      onDeselectAll?.();
    }
  }, [onDeselectAll]);

  const srcDoc = html && css
    ? buildStandaloneHtml({
        html, css, fields: fields || [], alignment: alignment || "left",
        title: "preview", hideSlots: false,
      })
    : null;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{ background: "var(--canvas-bg, #0d0d10)" }}
      onMouseDown={onCanvasMouseDown}
    >
      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: `${Math.max(16, 24 * zoom)}px ${Math.max(16, 24 * zoom)}px`,
          backgroundPosition: `${offset.x % (24 * zoom)}px ${offset.y % (24 * zoom)}px`,
        }}
      />

      {/* Canvas surface */}
      {initialized && (
        <div
          ref={canvasRef}
          style={{
            position: "absolute",
            left: offset.x,
            top: offset.y,
            width: CANVAS_W * zoom,
            height: CANVAS_H * zoom,
            background: background || "#0c0c10",
            borderRadius: 8 * zoom,
            boxShadow: "0 8px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
            overflow: "hidden",
            transformOrigin: "top left",
          }}
        >
          {/* HTML/CSS banner template layer */}
          {srcDoc && (
            <iframe
              ref={iframeRef}
              title="banner-base"
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-same-origin"
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                border: "none", pointerEvents: "none",
              }}
            />
          )}

          {/* Elements overlay */}
          <div
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
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
                offset={offset}
                onSelect={onSelectElement}
                onUpdateElement={onUpdateElement}
                onStartEdit={onStartEdit}
                onEndEdit={onEndEdit}
                toCanvasCoords={toCanvasCoords}
              />
            ))}
          </div>

          {/* Empty state */}
          {elements.length === 0 && !srcDoc && (
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 select-none"
              style={{ color: "rgba(255,255,255,0.15)", fontSize: 14 }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              <span>Add elements from the left panel</span>
            </div>
          )}
        </div>
      )}

      {/* Canvas size label */}
      {initialized && (
        <div
          className="pointer-events-none absolute select-none font-mono text-[10px]"
          style={{
            left: offset.x,
            top: offset.y + CANVAS_H * zoom + 8,
            color: "rgba(255,255,255,0.2)",
          }}
        >
          {Math.round(CANVAS_W)} × {Math.round(CANVAS_H)} px · {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}