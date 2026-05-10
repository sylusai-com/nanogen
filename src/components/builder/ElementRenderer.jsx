"use client";

import { useCallback, useEffect, useRef } from "react";

// 8-handle selection box, rotation grip, inline text editing.
// Renders inside a parent that is `transform: scale(zoom)`-d, so
// internal pixel sizes appear at zoom× on screen. Selection chrome
// is counter-scaled so handles look the same at every zoom level.
export default function ElementRenderer({
  element,
  isSelected,
  isEditing,
  isPreview = false,
  zoom = 1,
  canvasW = 1200,
  canvasH = 675,
  containerRef,
  onSelect,
  onUpdateElement,
  onStartEdit,
  onEndEdit,
}) {
  const { id, type, x, y, w, h, content, style = {}, rotation = 0 } = element;
  const elRef = useRef(null);
  const textareaRef = useRef(null);

  // Counter-scale factor for fixed-size chrome (handles, ring border).
  const inv = zoom > 0 ? 1 / zoom : 1;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // ── Drag to move ──────────────────────────────────────────────────────────
  // Screen-space delta → canvas-space percent. The parent applies
  // CSS transform: scale(zoom), so dividing by `zoom` recovers logical
  // pixels; dividing by canvas dimension yields the percentage delta.
  const onDragStart = useCallback((e) => {
    if (isPreview || isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(id);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startEX = element.x;
    const startEY = element.y;

    const onMove = (me) => {
      const clientDeltaX = me.clientX - startClientX;
      const clientDeltaY = me.clientY - startClientY;
      const canvasDeltaX = (clientDeltaX / zoom / canvasW) * 100;
      const canvasDeltaY = (clientDeltaY / zoom / canvasH) * 100;

      const newX = startEX + canvasDeltaX;
      const newY = startEY + canvasDeltaY;

      onUpdateElement?.({
        ...element,
        x: Math.max(0, Math.min(100 - element.w, newX)),
        y: Math.max(0, Math.min(100 - (element.h ?? 10), newY)),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [isPreview, isEditing, id, element, zoom, canvasW, canvasH, onSelect, onUpdateElement]);

  // ── Resize handles ───────────────────────────────────────────────────────
  const onResizeHandleMouseDown = useCallback((e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = element.x;
    const origY = element.y;
    const origW = element.w;
    const origH = element.h ?? 20;
    const onMove = (me) => {
      const clientDeltaX = me.clientX - startClientX;
      const clientDeltaY = me.clientY - startClientY;
      const canvasDeltaX = (clientDeltaX / zoom / canvasW) * 100;
      const canvasDeltaY = (clientDeltaY / zoom / canvasH) * 100;
      let nx = origX;
      let ny = origY;
      let nw = origW;
      let nh = origH;
      if (handle.includes("e")) nw = Math.max(3, origW + canvasDeltaX);
      if (handle.includes("s")) nh = Math.max(2, origH + canvasDeltaY);
      if (handle.includes("w")) {
        nw = Math.max(3, origW - canvasDeltaX);
        nx = origX + canvasDeltaX;
      }
      if (handle.includes("n")) {
        nh = Math.max(2, origH - canvasDeltaY);
        ny = origY + canvasDeltaY;
      }
      onUpdateElement({
        ...element,
        x: Math.max(0, Math.min(100 - nw, nx)),
        y: Math.max(0, Math.min(100 - nh, ny)),
        w: Math.min(100, nw),
        h: Math.min(100, nh),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [element, zoom, canvasW, canvasH, onUpdateElement]);

  // ── Rotation ─────────────────────────────────────────────────────────────
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

  // ── Inner content ────────────────────────────────────────────────────────
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
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            background: style.background || "#a78bfa",
            borderRadius: style.borderRadius || "999px",
          }}>
            <textarea
              ref={textareaRef}
              value={content || ""}
              onChange={(e) => onUpdateElement?.({ ...element, content: e.target.value })}
              onBlur={() => onEndEdit?.()}
              onKeyDown={(e) => { if (e.key === "Escape") onEndEdit?.(); }}
              style={{
                ...textStyle, background: "transparent", border: "none", outline: "none",
                resize: "none", textAlign: "center", cursor: "text",
                fontSize: style.fontSize || "14px",
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
          padding: "0 12px",
        }}>
          {content || "Button"}
        </div>
      );
    }

    if (type === "image") {
      return (
        <div style={{
          width: "100%", height: "100%", overflow: "hidden",
          borderRadius: style.borderRadius || "8px",
        }}>
          {content ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
          ) : (
            <div style={{
              width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center",
              background: style.background || "rgba(255,255,255,0.08)",
              borderRadius: style.borderRadius || "8px",
              color: "rgba(255,255,255,0.3)", fontSize: 12,
              border: "1.5px dashed rgba(255,255,255,0.15)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>
      );
    }

    if (type === "divider") {
      return (
        <div style={{
          width: "100%",
          height: style.thickness || "2px",
          background: style.color || "rgba(255,255,255,0.2)",
          borderRadius: "999px",
        }} />
      );
    }

    return null;
  })();

  // Selection chrome — counter-scaled by 1/zoom so on-screen size is constant.
  const handleSize = 8 * inv;
  const handleOffset = -5 * inv;
  const ringInset = -1 * inv;
  const ringBorder = `${1.5 * inv}px solid #a78bfa`;
  const handleBorder = `${1.5 * inv}px solid #a78bfa`;
  const rotateOffset = -28 * inv;
  const rotateLineHeight = 12 * inv;
  const rotateDot = 12 * inv;

  const handles = [
    { id: "n",  style: { top: handleOffset, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
    { id: "s",  style: { bottom: handleOffset, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
    { id: "e",  style: { right: handleOffset, top: "50%", transform: "translateY(-50%)", cursor: "e-resize" } },
    { id: "w",  style: { left: handleOffset, top: "50%", transform: "translateY(-50%)", cursor: "w-resize" } },
    { id: "ne", style: { top: handleOffset, right: handleOffset, cursor: "ne-resize" } },
    { id: "nw", style: { top: handleOffset, left: handleOffset, cursor: "nw-resize" } },
    { id: "se", style: { bottom: handleOffset, right: handleOffset, cursor: "se-resize" } },
    { id: "sw", style: { bottom: handleOffset, left: handleOffset, cursor: "sw-resize" } },
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
        ...(h != null && type !== "text" ? { height: `${h}%` } : {}),
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

      {isSelected && !isPreview && (
        <>
          <div
            style={{
              position: "absolute",
              top: ringInset, left: ringInset, right: ringInset, bottom: ringInset,
              border: ringBorder,
              borderRadius:
                type === "rect" ? (style.borderRadius || "8px")
                : type === "button" ? (style.borderRadius || "999px")
                : "2px",
              pointerEvents: "none",
              boxShadow: `0 0 0 ${1 * inv}px rgba(167,139,250,0.2)`,
            }}
          />

          {handles.map((handle) => (
            <div
              key={handle.id}
              style={{
                position: "absolute",
                width: handleSize,
                height: handleSize,
                background: "#ffffff",
                border: handleBorder,
                borderRadius: 2 * inv,
                zIndex: 10,
                ...handle.style,
              }}
              onMouseDown={(e) => onResizeHandleMouseDown(e, handle.id)}
            />
          ))}

          {/* Rotation grip */}
          <div
            style={{
              position: "absolute",
              top: rotateOffset,
              left: "50%",
              transform: "translateX(-50%)",
              cursor: "crosshair",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3 * inv,
            }}
            onMouseDown={onRotateMouseDown}
          >
            <div style={{ width: 1 * inv, height: rotateLineHeight, background: "#a78bfa" }} />
            <div style={{
              width: rotateDot, height: rotateDot, borderRadius: "50%",
              background: "#ffffff", border: handleBorder,
            }} />
          </div>
        </>
      )}
    </div>
  );
}
