// src/components/builder/Canvas.jsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ElementRenderer from "./ElementRenderer";
import { buildStandaloneHtml, extractEditableComponentsFromDocument } from "@/lib/bannerDownload";

function aspectStyle(aspect) {
  const map = { "16:9": "56.25%", "1:1": "100%", "4:5": "125%", "9:16": "177.78%" };
  return map[aspect] || "56.25%";
}

export default function Canvas({
  elements,
  selectedId,
  background,
  aspect,
  html,
  css,
  fields,
  alignment,
  onTemplateComponentsExtracted,
  onSelectElement,
  onUpdateElement,
  onDeselectAll,
}) {
  const canvasRef = useRef(null);
  const iframeRef = useRef(null);
  const dragging  = useRef(null); // { id, startMouseX, startMouseY, startElemX, startElemY }
  const resizing  = useRef(null); // { id, startMouseX, startMouseY, startW, startH }
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html || !css) return;

    const extract = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const components = extractEditableComponentsFromDocument(doc, { fields: fields || [] });
      if (components.length) onTemplateComponentsExtracted?.(components);
    };

    if (iframe.contentDocument?.readyState === "complete") {
      extract();
      return;
    }

    iframe.addEventListener("load", extract);
    return () => iframe.removeEventListener("load", extract);
  }, [html, css, fields, onTemplateComponentsExtracted]);

  // ── Drag to move ────────────────────────────────────────────────────────
  const onDragStart = useCallback((e, id) => {
    e.preventDefault();
    const el = elements.find((el) => el.id === id);
    if (!el) return;
    dragging.current = {
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startElemX: el.x,
      startElemY: el.y,
    };

    const onMove = (me) => {
      if (!dragging.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((me.clientX - dragging.current.startMouseX) / rect.width) * 100;
      const dy = ((me.clientY - dragging.current.startMouseY) / rect.height) * 100;
      const newX = Math.max(0, Math.min(90, dragging.current.startElemX + dx));
      const newY = Math.max(0, Math.min(90, dragging.current.startElemY + dy));
      const target = elements.find((el) => el.id === dragging.current.id);
      if (target) onUpdateElement({ ...target, x: newX, y: newY });
    };

    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [elements, onUpdateElement]);

  // ── Resize ───────────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e, id) => {
    e.preventDefault();
    const el = elements.find((el) => el.id === id);
    if (!el) return;
    resizing.current = {
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: el.w,
      startH: el.h ?? 20,
    };

    const onMove = (me) => {
      if (!resizing.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dw = ((me.clientX - resizing.current.startMouseX) / rect.width) * 100;
      const dh = ((me.clientY - resizing.current.startMouseY) / rect.height) * 100;
      const newW = Math.max(2, Math.min(100, resizing.current.startW + dw));
      const newH = Math.max(2, Math.min(100, resizing.current.startH + dh));
      const target = elements.find((el) => el.id === resizing.current.id);
      if (target) onUpdateElement({ ...target, w: newW, h: newH });
    };

    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [elements, onUpdateElement]);

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto bg-[#111118] p-8">
      <div
        className="relative w-full max-w-4xl"
        style={{ paddingBottom: aspectStyle(aspect) }}
      >
        <div
          ref={canvasRef}
          className="absolute inset-0 overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: background || "#0c0c10" }}
          onMouseDown={(e) => {
            // Deselect when clicking the canvas background
            if (e.target === canvasRef.current) onDeselectAll?.();
          }}
        >
          {html && css && (
            <iframe
              ref={iframeRef}
              title="banner-preview"
              srcDoc={buildStandaloneHtml({
                html,
                css,
                fields: fields || [],
                alignment: alignment || "left",
                title: "banner-preview",
                hideSlots: elements.length > 0,
              })}
              sandbox="allow-scripts allow-same-origin"
              className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-transparent"
            />
          )}
          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
              backgroundSize: "5% 5%",
            }}
          />

          {elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              isSelected={el.id === selectedId}
              onSelect={onSelectElement}
              onDragStart={onDragStart}
              onResizeStart={onResizeStart}
            />
          ))}

          {elements.length === 0 && (
            <div className="pointer-events-none flex h-full items-center justify-center text-sm text-white/20 select-none">
              Add elements from the toolbar on the left
            </div>
          )}
        </div>
      </div>
    </div>
  );
}