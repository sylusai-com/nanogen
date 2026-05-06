"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// 8-handle selection box, rotation grip, inline text editing
export default function ElementRenderer({
  element,
  isSelected,
  isEditing,
  isPreview = false,
  zoom = 1,
  canvasW = 1200,
  canvasH = 675,
  containerRef,
  offset = { x: 0, y: 0 },
  onSelect,
  onUpdateElement,
  onStartEdit,
  onEndEdit,
  toCanvasCoords,
}) {
  const { id, type, x, y, w, h, content, style = {}, rotation = 0 } = element;
  const elRef = useRef(null);
  const textareaRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const rotateRef = useRef(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const pxX = (x / 100) * canvasW;
  const pxY = (y / 100) * canvasH;
  const pxW = (w / 100) * canvasW;
  const pxH = h != null ? (h / 100) * canvasH : null;

  // ── Drag to move ──────────────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    if (isPreview || isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startEX = element.x;
    const startEY = element.y;

    const onMove = (me) => {
      const dx = ((me.clientX - startX) / zoom / canvasW) * 100;
      const dy = ((me.clientY - startY) / zoom / canvasH) * 100;
      onUpdateElement?.({
        ...element,
        x: Math.max(0, Math.min(100 - w, startEX + dx)),
        y: Math.max(0, Math.min(100 - (h ?? 10), startEY + dy)),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [isPreview, isEditing, id, element, zoom, canvasW, canvasH, w, h, onSelect, onUpdateElement]);

  // ── Resize handles ────────────────────────────────────────────────────────
  const onResizeHandleMouseDown = useCallback((e, handle) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = element.x;
    const origY = element.y;
    const origW = element.w;
    const origH = element.h ?? 20;

    const onMove = (me) => {
      const dx = ((me.clientX - startX) / zoom / canvasW) * 100;
      const dy = ((me.clientY - startY) / zoom / canvasH) * 100;
      let nx = origX, ny = origY, nw = origW, nh = origH;

      if (handle.includes("e")) nw = Math.max(3, origW + dx);
      if (handle.includes("s")) nh = Math.max(2, origH + dy);
      if (handle.includes("w")) { nw = Math.max(3, origW - dx); nx = origX + dx; }
      if (handle.includes("n")) { nh = Math.max(2, origH - dy); ny = origY + dy; }

      onUpdateElement?.({ ...element, x: nx, y: ny, w: nw, h: nh });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [element, zoom, canvasW, canvasH, onUpdateElement]);

  // ── Rotation ──────────────────────────────────────────────────────────────
  const onRotateMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = elRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const onMove = (me) => {
      const angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90;
      onUpdateElement?.({ ...element, rotation: Math.round(angle) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [element, onUpdateElement]);

  const handleDblClick = (e) => {
    if (isPreview) return;
    if (type === "text" || type === "button") {
      e.stopPropagation();
      onStartEdit?.(id);
    }
  };

  const handleClick = (e) => {
    if (isPreview) return;
    e.stopPropagation();
    onSelect?.(id);
  };

  // ── Render inner content ──────────────────────────────────────────────────
  const inner = (() => {
    const textStyle = {
      fontFamily: style.fontFamily || "inherit",
      fontSize: style.fontSize || "16px",
      fontWeight: style.fontWeight || "400",
      color: style.color || "#ffffff",
      textAlign: style.textAlign || "left",
      lineHeight: style.lineHeight || "1.4",
      letterSpacing: style.letterSpacing || "normal",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    };

    if (type === "text") {
      if (isEditing) {
        return (
          <textarea
            ref={textareaRef}
            value={content || ""}
            onChange={(e) => onUpdateElement?.({ ...element, content: e.target.value })}
            onBlur={() => onEndEdit?.()}
            onKeyDown={(e) => { if (e.key === "Escape") onEndEdit?.(); }}
            style={{
              ...textStyle,
              width: "100%", height: "100%", minHeight: 24,
              background: "transparent", border: "none", outline: "none",
              resize: "none", padding: 0, cursor: "text",
            }}
          />
        );
      }
      return (
        <div style={{ ...textStyle, minHeight: 20 }}>
          {content || <span style={{ opacity: 0.3 }}>Double-click to edit</span>}
        </div>
      );
    }

    if (type === "rect") {
      return (
        <div
          style={{
            width: "100%", height: "100%",
            background: style.background || "#a78bfa",
            borderRadius: style.borderRadius || "8px",
            opacity: style.opacity ?? 1,
            border: style.border || "none",
          }}
        />
      );
    }

    if (type === "button") {
      if (isEditing) {
        return (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            background: style.background || "#a78bfa", borderRadius: style.borderRadius || "999px",
          }}>
            <textarea
              ref={textareaRef}
              value={content || ""}
              onChange={(e) => onUpdateElement?.({ ...element, content: e.target.value })}
              onBlur={() => onEndEdit?.()}
              onKeyDown={(e) => { if (e.key === "Escape") onEndEdit?.(); }}
              style={{
                ...textStyle, background: "transparent", border: "none", outline: "none",
                resize: "none", textAlign: "center", cursor: "text", fontSize: style.fontSize || "14px",
              }}
            />
          </div>
        );
      }
      return (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: style.background || "#a78bfa",
          color: style.color || "#ffffff",
          borderRadius: style.borderRadius || "999px",
          fontSize: style.fontSize || "14px",
          fontWeight: style.fontWeight || "600",
        }}>
          {content || "Button"}
        </div>
      );
    }

    if (type === "image") {
      return (
        <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: style.borderRadius || "8px" }}>
          {content ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
          ) : (
            <div style={{
              width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              background: style.background || "rgba(255,255,255,0.08)",
              borderRadius: style.borderRadius || "8px",
              color: "rgba(255,255,255,0.3)", fontSize: 12,
              border: "1.5px dashed rgba(255,255,255,0.15)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
          )}
        </div>
      );
    }

    if (type === "divider") {
      return (
        <div style={{ width: "100%", height: style.thickness || "2px", background: style.color || "rgba(255,255,255,0.2)", borderRadius: "999px" }} />
      );
    }

    return null;
  })();

  const handles = [
    { id: "n",  style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
    { id: "s",  style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
    { id: "e",  style: { right: -5, top: "50%", transform: "translateY(-50%)", cursor: "e-resize" } },
    { id: "w",  style: { left: -5, top: "50%", transform: "translateY(-50%)", cursor: "w-resize" } },
    { id: "ne", style: { top: -5, right: -5, cursor: "ne-resize" } },
    { id: "nw", style: { top: -5, left: -5, cursor: "nw-resize" } },
    { id: "se", style: { bottom: -5, right: -5, cursor: "se-resize" } },
    { id: "sw", style: { bottom: -5, left: -5, cursor: "sw-resize" } },
  ];

  return (
    <div
      ref={elRef}
      data-element-id={id}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        ...(pxH != null && type !== "text" ? { height: `${h}%` } : {}),
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
        cursor: isEditing ? "text" : (isPreview ? "default" : "move"),
        userSelect: isEditing ? "text" : "none",
        outline: "none",
      }}
      onMouseDown={!isEditing ? onDragStart : undefined}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
    >
      {inner}

      {/* Selection ring + handles */}
      {isSelected && !isPreview && (
        <>
          <div
            style={{
              position: "absolute", inset: -1,
              border: "1.5px solid #a78bfa",
              borderRadius: type === "rect" ? (style.borderRadius || "8px") : type === "button" ? (style.borderRadius || "999px") : "2px",
              pointerEvents: "none",
              boxShadow: "0 0 0 1px rgba(167,139,250,0.2)",
            }}
          />

          {/* 8 resize handles */}
          {handles.map((handle) => (
            <div
              key={handle.id}
              style={{
                position: "absolute",
                width: 8, height: 8,
                background: "#ffffff",
                border: "1.5px solid #a78bfa",
                borderRadius: 2,
                zIndex: 10,
                ...handle.style,
              }}
              onMouseDown={(e) => onResizeHandleMouseDown(e, handle.id)}
            />
          ))}

          {/* Rotation handle */}
          <div
            style={{
              position: "absolute",
              top: -24, left: "50%", transform: "translateX(-50%)",
              cursor: "crosshair",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}
            onMouseDown={onRotateMouseDown}
          >
            <div style={{ width: 1, height: 10, background: "#a78bfa" }} />
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#ffffff", border: "1.5px solid #a78bfa",
            }} />
          </div>
        </>
      )}
    </div>
  );
}