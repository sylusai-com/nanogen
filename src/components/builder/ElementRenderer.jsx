// src/components/builder/ElementRenderer.jsx
"use client";

import { cn } from "@/lib/cn";

/**
 * Renders a single canvas element. Used in both the live canvas and the
 * export path. Each element type has its own DOM structure that can be
 * selected and resized.
 *
 * Element shape:
 * {
 *   id: string,
 *   type: "text" | "rect" | "image" | "button" | "divider",
 *   x: number,        // % of canvas width
 *   y: number,        // % of canvas height
 *   w: number,        // % of canvas width
 *   h: number,        // % of canvas height (auto for text)
 *   content?: string,
 *   style: { ... }    // CSS-serialisable properties
 * }
 */
export default function ElementRenderer({
  element,
  isSelected,
  isPreview = false,
  onSelect,
  onDragStart,
  onResizeStart,
}) {
  const { id, type, x, y, w, h, content, style = {} } = element;

  const posStyle = {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    width: `${w}%`,
    ...(h != null && type !== "text" ? { height: `${h}%` } : {}),
  };

  const handleMouseDown = (e) => {
    if (isPreview) return;
    e.stopPropagation();
    onSelect?.(id);
    onDragStart?.(e, id);
  };

  const baseClass = cn(
    "absolute select-none",
    !isPreview && "cursor-move",
    isSelected && !isPreview && "ring-2 ring-primary ring-offset-1 ring-offset-transparent",
  );

  const inner = (() => {
    switch (type) {
      case "text":
        return (
          <div
            style={{
              fontFamily: style.fontFamily || "inherit",
              fontSize: style.fontSize || "16px",
              fontWeight: style.fontWeight || "400",
              color: style.color || "#ffffff",
              textAlign: style.textAlign || "left",
              lineHeight: style.lineHeight || "1.4",
              letterSpacing: style.letterSpacing || "normal",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {content || "Text"}
          </div>
        );

      case "rect":
        return (
          <div
            className="h-full w-full rounded"
            style={{
              background: style.background || "#a78bfa",
              borderRadius: style.borderRadius || "8px",
              opacity: style.opacity != null ? style.opacity : 1,
              border: style.border || "none",
            }}
          />
        );

      case "button":
        return (
          <div
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
            style={{
              background: style.background || "#a78bfa",
              color: style.color || "#ffffff",
              borderRadius: style.borderRadius || "999px",
              fontSize: style.fontSize || "14px",
              fontWeight: style.fontWeight || "600",
              width: "100%",
            }}
          >
            {content || "Button"}
          </div>
        );

      case "image":
        return (
          <div
            className="h-full w-full overflow-hidden rounded"
            style={{ borderRadius: style.borderRadius || "8px" }}
          >
            {content ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded text-xs text-white/50"
                style={{ background: style.background || "rgba(255,255,255,0.1)", borderRadius: style.borderRadius || "8px" }}
              >
                Image
              </div>
            )}
          </div>
        );

      case "divider":
        return (
          <div
            className="w-full"
            style={{
              height: style.thickness || "2px",
              background: style.color || "rgba(255,255,255,0.2)",
              borderRadius: "999px",
            }}
          />
        );

      default:
        return null;
    }
  })();

  return (
    <div
      data-element-id={id}
      className={baseClass}
      style={posStyle}
      onMouseDown={handleMouseDown}
    >
      {inner}

      {/* Resize handle — bottom-right corner, only in edit mode */}
      {isSelected && !isPreview && (
        <div
          className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-se-resize rounded-sm bg-primary ring-1 ring-white/30"
          style={{ transform: "translate(50%, 50%)" }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart?.(e, id);
          }}
        />
      )}
    </div>
  );
}