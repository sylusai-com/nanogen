"use client";

import {
  AlignCenter, AlignLeft, AlignRight,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Copy, Flip2, 
  Minus, Plus,
  Redo2, Trash2, Undo2,
  ZoomIn, ZoomOut,
  ChevronDown,
  Lock, Unlock,
  Group,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/cn";

function ToolBtn({ icon: Icon, label, onClick, disabled, active, danger, size = "default" }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-all",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        active
          ? "bg-primary/20 text-primary"
          : danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-muted-strong hover:bg-surface-2 hover:text-foreground",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.75} />
    </button>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

function ZoomInput({ zoom, onZoomChange }) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="flex items-center gap-0.5">
      <ToolBtn icon={ZoomOut} label="Zoom out" size="sm" onClick={() => onZoomChange(Math.max(0.15, zoom - 0.1))} />
      <div className="relative">
        <input
          type="number"
          value={pct}
          min={15}
          max={400}
          onChange={(e) => onZoomChange(Math.max(0.15, Math.min(4, (parseInt(e.target.value) || 100) / 100)))}
          className="h-7 w-14 rounded-md border border-border bg-surface-2 text-center font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
        />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted">%</span>
      </div>
      <ToolBtn icon={ZoomIn} label="Zoom in" size="sm" onClick={() => onZoomChange(Math.min(4, zoom + 0.1))} />
    </div>
  );
}

const ALIGN_PRESETS = [
  { label: "Align left",   value: "left",   icon: AlignLeft },
  { label: "Align center", value: "center", icon: AlignCenter },
  { label: "Align right",  value: "right",  icon: AlignRight },
  { label: "Align top",    value: "top",    icon: AlignCenterHorizontal },
  { label: "Align middle", value: "middle", icon: AlignCenterVertical },
];

export default function CanvaToolbar({
  selectedId,
  selectedElement,
  onDuplicate,
  onDelete,
  onAlignElement,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  onFitToScreen,
  onZoom100,
}) {
  const hasSelection = !!selectedId;

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-surface/90 px-3 backdrop-blur">
      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <ToolBtn icon={Undo2} label="Undo (⌘Z)" disabled={!canUndo} onClick={onUndo} />
        <ToolBtn icon={Redo2} label="Redo (⌘Y)" disabled={!canRedo} onClick={onRedo} />
      </div>

      <Separator />

      {/* Zoom */}
      <ZoomInput zoom={zoom} onZoomChange={onZoomChange} />
      <button
        type="button"
        title="Fit to screen"
        onClick={onFitToScreen}
        className="ml-0.5 inline-flex h-7 items-center rounded-md border border-border bg-surface-2 px-2 text-[10px] font-medium text-muted-strong hover:border-border-strong hover:text-foreground transition-colors"
      >
        Fit
      </button>
      <button
        type="button"
        title="Actual size (100%)"
        onClick={onZoom100}
        className="ml-0.5 inline-flex h-7 items-center rounded-md border border-border bg-surface-2 px-2 text-[10px] font-medium text-muted-strong hover:border-border-strong hover:text-foreground transition-colors"
      >
        100%
      </button>

      <Separator />

      {/* Alignment — enabled only when element selected */}
      <div className="flex items-center gap-0.5">
        {ALIGN_PRESETS.map((a) => (
          <ToolBtn
            key={a.value}
            icon={a.icon}
            label={a.label}
            size="sm"
            disabled={!hasSelection}
            onClick={() => onAlignElement?.(a.value)}
          />
        ))}
      </div>

      <Separator />

      {/* Selection actions */}
      <div className="flex items-center gap-0.5">
        <ToolBtn
          icon={Copy}
          label="Duplicate (⌘D)"
          size="sm"
          disabled={!hasSelection}
          onClick={onDuplicate}
        />
        <ToolBtn
          icon={Trash2}
          label="Delete (⌫)"
          size="sm"
          danger
          disabled={!hasSelection}
          onClick={onDelete}
        />
      </div>

      {/* Selected element info */}
      {selectedElement && (
        <>
          <Separator />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[9px] font-semibold uppercase tracking-widest text-primary">
              {selectedElement.type}
            </span>
            <span className="font-mono text-[10px] text-muted">
              {selectedElement.x?.toFixed(0)},{selectedElement.y?.toFixed(0)} ·{" "}
              {selectedElement.w?.toFixed(0)}w
              {selectedElement.h ? ` × ${selectedElement.h?.toFixed(0)}h` : ""}
            </span>
          </div>
        </>
      )}
    </div>
  );
}