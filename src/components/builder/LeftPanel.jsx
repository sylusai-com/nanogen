"use client";

import { useState, useRef } from "react";
import {
  Type, Square, MousePointer2, Image as ImageIcon,
  MinusSquare, Circle, Triangle, Star, Hash,
  Layers, Upload, Shapes, ChevronRight,
  Sparkles, Grid3x3,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { compressImage, isImageFile } from "@/lib/imageUpload";

// ── Element type catalogue ─────────────────────────────────────────────────
const ELEMENT_GROUPS = [
  {
    label: "Text",
    items: [
      {
        type: "text", label: "Heading", icon: Type,
        preview: (
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
            Heading
          </div>
        ),
        defaults: { content: "Heading", w: 55, h: null, style: { fontSize: "36px", fontWeight: "700", color: "#ffffff", textAlign: "left", lineHeight: "1.2" } },
      },
      {
        type: "text", label: "Subheading", icon: Type,
        preview: (
          <div style={{ fontSize: 13, fontWeight: 500, color: "#ccc" }}>Subheading</div>
        ),
        defaults: { content: "Subheading", w: 50, h: null, style: { fontSize: "20px", fontWeight: "500", color: "#cccccc", textAlign: "left", lineHeight: "1.4" } },
      },
      {
        type: "text", label: "Body text", icon: Type,
        preview: (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>Body text</div>
        ),
        defaults: { content: "Body text goes here", w: 45, h: null, style: { fontSize: "14px", fontWeight: "400", color: "rgba(255,255,255,0.75)", textAlign: "left", lineHeight: "1.6" } },
      },
    ],
  },
  {
    label: "Shapes",
    items: [
      {
        type: "rect", label: "Rectangle", icon: Square,
        preview: <div style={{ width: 36, height: 22, background: "#a78bfa", borderRadius: 4 }} />,
        defaults: { w: 30, h: 18, style: { background: "#a78bfa", borderRadius: "8px", opacity: 1 } },
      },
      {
        type: "rect", label: "Rounded", icon: Square,
        preview: <div style={{ width: 36, height: 22, background: "#22d3ee", borderRadius: 11 }} />,
        defaults: { w: 30, h: 18, style: { background: "#22d3ee", borderRadius: "999px", opacity: 1 } },
      },
      {
        type: "rect", label: "Circle", icon: Circle,
        preview: <div style={{ width: 24, height: 24, background: "#f472b6", borderRadius: "50%" }} />,
        defaults: { w: 18, h: 18, style: { background: "#f472b6", borderRadius: "50%", opacity: 1 } },
      },
      {
        type: "divider", label: "Line", icon: MinusSquare,
        preview: <div style={{ width: 40, height: 2, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />,
        defaults: { w: 70, h: 1, style: { color: "rgba(255,255,255,0.3)", thickness: "2px" } },
      },
    ],
  },
  {
    label: "Buttons",
    items: [
      {
        type: "button", label: "Primary", icon: MousePointer2,
        preview: (
          <div style={{ padding: "4px 12px", background: "#a78bfa", borderRadius: 999, fontSize: 11, color: "#fff", fontWeight: 600 }}>
            Button
          </div>
        ),
        defaults: { content: "Get started", w: 22, h: 8, style: { background: "#a78bfa", color: "#ffffff", borderRadius: "999px", fontSize: "14px", fontWeight: "600" } },
      },
      {
        type: "button", label: "Outline", icon: MousePointer2,
        preview: (
          <div style={{ padding: "4px 12px", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 999, fontSize: 11, color: "#fff", fontWeight: 500 }}>
            Button
          </div>
        ),
        defaults: { content: "Learn more", w: 22, h: 8, style: { background: "transparent", color: "#ffffff", borderRadius: "999px", fontSize: "14px", fontWeight: "500", border: "1.5px solid rgba(255,255,255,0.5)" } },
      },
    ],
  },
];

// ── Preset color palettes ──────────────────────────────────────────────────
const BG_PRESETS = [
  "#0a0a0f", "#0f172a", "#1e1b4b", "#0c1a0f",
  "#1a0a0a", "#0a0f1a", "#111827", "#18181b",
  "#ffffff", "#f8fafc", "#fefce8", "#fdf4ff",
];

// ── Left Panel ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "elements", icon: Shapes,    label: "Elements" },
  { id: "layers",   icon: Layers,    label: "Layers" },
  { id: "upload",   icon: Upload,    label: "Upload" },
];

export default function LeftPanel({
  elements,
  selectedId,
  background,
  onAddElement,
  onSelectElement,
  onMoveUp,
  onMoveDown,
  onBackgroundChange,
}) {
  const [tab, setTab] = useState("elements");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const fileRef = useRef(null);

  const addElement = (group) => {
    const { type, label, defaults } = group;
    onAddElement(type, defaults);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadErr(null);
    if (!isImageFile(file)) { setUploadErr("Please choose an image file."); return; }
    setUploadBusy(true);
    try {
      const { compressImage: compress } = await import("@/lib/imageUpload");
      const dataUrl = await compress(file);
      onAddElement("image", { content: dataUrl, w: 40, h: 30, style: { borderRadius: "8px" } });
    } catch (e) {
      setUploadErr(e?.message || "Failed to process image");
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface/70 backdrop-blur">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-border px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-semibold uppercase tracking-widest transition-colors",
              tab === t.id
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "elements" && (
          <div className="p-3 space-y-5">
            {/* Canvas background */}
            <div>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-muted px-0.5">
                Background
              </div>
              <div className="flex flex-wrap gap-1.5">
                {BG_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => onBackgroundChange(c)}
                    style={{ background: c }}
                    className={cn(
                      "h-7 w-7 rounded-md border transition-all",
                      background === c
                        ? "border-primary ring-1 ring-primary/40 scale-110"
                        : "border-border hover:border-border-strong hover:scale-105"
                    )}
                  />
                ))}
                <label
                  title="Custom color"
                  className="relative h-7 w-7 cursor-pointer rounded-md border border-dashed border-border hover:border-border-strong transition-colors flex items-center justify-center text-muted hover:text-foreground"
                  style={{ background: BG_PRESETS.includes(background) ? undefined : background }}
                >
                  <Hash className="h-3.5 w-3.5" />
                  <input
                    type="color"
                    value={background || "#0c0c10"}
                    onChange={(e) => onBackgroundChange(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>

            {/* Element groups */}
            {ELEMENT_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-muted px-0.5">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item, i) => (
                    <button
                      key={`${item.type}-${item.label}-${i}`}
                      type="button"
                      onClick={() => addElement(item)}
                      className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-all hover:border-border hover:bg-surface-2"
                    >
                      <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-surface-2 border border-border group-hover:border-border-strong transition-colors overflow-hidden">
                        {item.preview}
                      </div>
                      <span className="text-xs text-muted-strong group-hover:text-foreground transition-colors">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "layers" && (
          <LayersTab
            elements={elements}
            selectedId={selectedId}
            onSelect={onSelectElement}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        )}

        {tab === "upload" && (
          <div className="p-4 space-y-4">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-muted px-0.5">
              Upload Image
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 border border-border">
                <Upload className="h-4 w-4 text-muted" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-strong">Click to upload</p>
                <p className="mt-0.5 text-[10px] text-muted">PNG, JPG, GIF, WebP</p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
            />
            {uploadBusy && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Processing image…
              </div>
            )}
            {uploadErr && <p className="text-[11px] text-red-400">{uploadErr}</p>}
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Layers tab ─────────────────────────────────────────────────────────────
import {
  ChevronUp, ChevronDown,
  Type as TypeIcon, Square as SquareIcon,
  MousePointer2 as BtnIcon, Image as ImgIcon, MinusSquare as DivIcon,
} from "lucide-react";

const TYPE_ICON = {
  text: TypeIcon, rect: SquareIcon, button: BtnIcon, image: ImgIcon, divider: DivIcon,
};

function LayersTab({ elements, selectedId, onSelect, onMoveUp, onMoveDown }) {
  if (elements.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <Layers className="h-7 w-7 text-muted opacity-40" />
        <p className="text-xs text-muted">No layers yet</p>
        <p className="text-[10px] text-muted opacity-60">Add elements from the Elements tab</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {[...elements].reverse().map((el, ri) => {
        const realIdx = elements.length - 1 - ri;
        const Icon = TYPE_ICON[el.type] || SquareIcon;
        const isSelected = el.id === selectedId;
        const fromTemplate = String(el.id || "").startsWith("template:");
        return (
          <div
            key={el.id}
            onClick={() => onSelect(el.id)}
            className={cn(
              "group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors",
              isSelected
                ? "bg-primary/10 text-foreground"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            )}
          >
            {/* Color dot */}
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: el.style?.background || el.style?.color || "#a78bfa" }}
            />
            <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            <span className="flex-1 truncate capitalize">
              {el.content
                ? String(el.content).slice(0, 18) + (String(el.content).length > 18 ? "…" : "")
                : (el.slot || el.type)}
            </span>
            {fromTemplate && (
              <span
                title="From template"
                className="shrink-0 rounded bg-primary/10 px-1 py-0 text-[8px] font-semibold uppercase tracking-widest text-primary"
              >
                T
              </span>
            )}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                title="Bring forward"
                onClick={(e) => { e.stopPropagation(); onMoveUp(realIdx); }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface text-muted hover:text-foreground"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Send backward"
                onClick={(e) => { e.stopPropagation(); onMoveDown(realIdx); }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface text-muted hover:text-foreground"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}