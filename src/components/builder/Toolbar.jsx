// src/components/builder/Toolbar.jsx
"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Image as ImageIcon,
  LayoutTemplate,
  MinusSquare,
  MousePointer2,
  Square,
  Redo2,
  Undo2,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ELEMENTS = [
  { type: "text",    icon: Type,          label: "Text" },
  { type: "rect",    icon: Square,        label: "Shape" },
  { type: "button",  icon: MousePointer2, label: "Button" },
  { type: "image",   icon: ImageIcon,     label: "Image" },
  { type: "divider", icon: MinusSquare,   label: "Divider" },
];

const ALIGN = [
  { value: "left",   icon: AlignLeft,   label: "Left" },
  { value: "center", icon: AlignCenter, label: "Center" },
  { value: "right",  icon: AlignRight,  label: "Right" },
];

function ToolButton({ icon: Icon, label, onClick, active, danger, disabled }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-[10px] transition-colors",
        active
          ? "bg-primary/20 text-primary ring-1 ring-primary/40"
          : danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-muted hover:bg-surface-2 hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="mx-1 my-2 h-px w-full bg-border" />;
}

export default function Toolbar({
  onAddElement,
  selectedId,
  selectedElement,
  onDuplicate,
  onDelete,
  onAlignElement,
  background,
  onBackgroundChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  return (
    <aside className="flex h-full w-22 shrink-0 flex-col border-r border-border bg-surface/60 py-3 backdrop-blur">
      {/* Section: Add */}
      <div className="px-2">
        <div className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-muted">
          Add
        </div>
        <div className="space-y-0.5">
          {ELEMENTS.map((el) => (
            <ToolButton
              key={el.type}
              icon={el.icon}
              label={el.label}
              onClick={() => onAddElement(el.type)}
            />
          ))}
        </div>
      </div>

      <Divider />

      {/* Section: Selected element actions */}
      <div className="px-2">
        <div className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-muted">
          Selection
        </div>
        <div className="space-y-0.5">
          {ALIGN.map((a) => (
            <ToolButton
              key={a.value}
              icon={a.icon}
              label={a.label}
              disabled={!selectedId}
              onClick={() => onAlignElement?.(a.value)}
            />
          ))}
          <ToolButton
            icon={Copy}
            label="Duplicate"
            disabled={!selectedId}
            onClick={onDuplicate}
          />
          <ToolButton
            icon={Trash2}
            label="Delete"
            disabled={!selectedId}
            danger
            onClick={onDelete}
          />
        </div>
      </div>

      <Divider />

      {/* Section: History */}
      <div className="px-2">
        <div className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-muted">
          History
        </div>
        <div className="space-y-0.5">
          <ToolButton
            icon={Undo2}
            label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolButton
            icon={Redo2}
            label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
          />
        </div>
      </div>

      {/* Section: Canvas background */}
      <div className="px-2">
        <div className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-muted">
          Canvas
        </div>
        <div className="flex flex-col items-center gap-2">
          <label
            title="Canvas background"
            className="group relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border transition-colors hover:border-border-strong"
            style={{ background }}
          >
            <LayoutTemplate className="h-3.5 w-3.5 text-white/50 opacity-0 transition-opacity group-hover:opacity-100" />
            <input
              type="color"
              value={background || "#0c0c10"}
              onChange={(e) => onBackgroundChange?.(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <span className="text-[9px] text-muted">Bg color</span>
        </div>
      </div>
    </aside>
  );
}