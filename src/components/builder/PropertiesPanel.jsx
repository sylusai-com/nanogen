"use client";

import { useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, AlignJustify,
  Bold, Italic, Underline,
  Loader2, Upload, Minus, Plus,
  ChevronDown, CornerUpLeft,
  Type, Square, MousePointer2, Image as ImageIcon, MinusSquare,
  Layers, Sliders, Text,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { compressImage, isImageFile } from "@/lib/imageUpload";

// ── Primitive field components ─────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-foreground transition-colors"
      >
        {title}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[11px] text-muted">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, unit, className }) {
  return (
    <div className="flex items-center gap-0.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        className={cn(
          "h-7 w-16 rounded-md border border-border bg-surface-2 px-2 text-center font-mono text-[11px] text-foreground focus:border-primary focus:outline-none",
          className
        )}
      />
      {unit && <span className="text-[10px] text-muted">{unit}</span>}
    </div>
  );
}

function ColorSwatch({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-2">
      <label
        className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-md border border-border shadow-sm hover:border-border-strong transition-all"
        style={{ background: value || "#ffffff" }}
      >
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="h-7 flex-1 rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, unit }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="font-mono text-[10px] text-muted">{value}{unit || ""}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full h-1 accent-primary cursor-pointer"
        style={{
          appearance: "none",
          background: `linear-gradient(to right, var(--primary) ${((value - min) / (max - min)) * 100}%, var(--surface-2) 0)`,
          borderRadius: "999px",
          height: "4px",
        }}
      />
    </div>
  );
}

function AlignButtons({ value, onChange, options }) {
  return (
    <div className="flex gap-1">
      {options.map(({ v, icon: Icon, title }) => (
        <button
          key={v}
          type="button"
          title={title}
          onClick={() => onChange(v)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border text-[11px] transition-all",
            value === v
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted hover:border-border-strong hover:bg-surface-2 hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function upd(element, patch) {
  return { ...element, style: { ...element.style, ...patch } };
}

// ── Position & Size section ────────────────────────────────────────────────
function PositionSection({ element, onChange }) {
  const set = (key, val) => onChange({ ...element, [key]: parseFloat(val) || 0 });
  return (
    <Section title="Position & Size" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-muted">X</span>
          <div className="flex items-center gap-1">
            <input type="number" value={element.x?.toFixed(1) ?? 0} min={0} max={100} step={0.1}
              onChange={(e) => set("x", e.target.value)}
              className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[10px] text-muted shrink-0">%</span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-muted">Y</span>
          <div className="flex items-center gap-1">
            <input type="number" value={element.y?.toFixed(1) ?? 0} min={0} max={100} step={0.1}
              onChange={(e) => set("y", e.target.value)}
              className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[10px] text-muted shrink-0">%</span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-muted">Width</span>
          <div className="flex items-center gap-1">
            <input type="number" value={element.w?.toFixed(1) ?? 10} min={1} max={100} step={0.1}
              onChange={(e) => set("w", e.target.value)}
              className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[10px] text-muted shrink-0">%</span>
          </div>
        </div>
        {element.type !== "text" && element.type !== "divider" && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted">Height</span>
            <div className="flex items-center gap-1">
              <input type="number" value={element.h?.toFixed(1) ?? 10} min={1} max={100} step={0.1}
                onChange={(e) => set("h", e.target.value)}
                className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
              />
              <span className="text-[10px] text-muted shrink-0">%</span>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <span className="text-[10px] text-muted">Rotation</span>
          <div className="flex items-center gap-1">
            <input type="number" value={element.rotation ?? 0} min={-360} max={360}
              onChange={(e) => onChange({ ...element, rotation: parseInt(e.target.value) || 0 })}
              className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[10px] text-muted shrink-0">°</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── Text section ───────────────────────────────────────────────────────────
function TextSection({ element, onChange }) {
  const s = element.style || {};
  const update = (patch) => onChange(upd(element, patch));

  const WEIGHTS = ["100","200","300","400","500","600","700","800","900"];
  const FAMILIES = [
    { value: "inherit", label: "Default" },
    { value: "ui-sans-serif, system-ui, sans-serif", label: "System Sans" },
    { value: "ui-serif, Georgia, serif", label: "Serif" },
    { value: "ui-monospace, monospace", label: "Monospace" },
    { value: "'Playfair Display', Georgia, serif", label: "Playfair" },
    { value: "'Space Grotesk', sans-serif", label: "Space Grotesk" },
  ];

  return (
    <Section title="Text" defaultOpen>
      {/* Content textarea */}
      <div className="space-y-1">
        <span className="text-[10px] text-muted">Content</span>
        <textarea
          rows={3}
          value={element.content || ""}
          onChange={(e) => onChange({ ...element, content: e.target.value })}
          className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>
      {/* Font family */}
      <div className="space-y-1">
        <span className="text-[10px] text-muted">Font</span>
        <select
          value={s.fontFamily || "inherit"}
          onChange={(e) => update({ fontFamily: e.target.value })}
          className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
        >
          {FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
      {/* Size + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-muted">Size</span>
          <div className="flex items-center gap-1">
            <input type="number" value={parseFloat(s.fontSize) || 16} min={8} max={200}
              onChange={(e) => update({ fontSize: `${e.target.value}px` })}
              className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[10px] text-muted shrink-0">px</span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-muted">Weight</span>
          <select
            value={s.fontWeight || "400"}
            onChange={(e) => update({ fontWeight: e.target.value })}
            className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
          >
            {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>
      {/* Color */}
      <div className="space-y-1">
        <span className="text-[10px] text-muted">Color</span>
        <ColorSwatch value={s.color} onChange={(v) => update({ color: v })} />
      </div>
      {/* Align */}
      <Row label="Align">
        <AlignButtons
          value={s.textAlign || "left"}
          onChange={(v) => update({ textAlign: v })}
          options={[
            { v: "left", icon: AlignLeft, title: "Left" },
            { v: "center", icon: AlignCenter, title: "Center" },
            { v: "right", icon: AlignRight, title: "Right" },
          ]}
        />
      </Row>
      {/* Line height */}
      <SliderRow
        label="Line height"
        value={parseFloat(s.lineHeight) || 1.4}
        min={0.8} max={3} step={0.05}
        onChange={(e) => update({ lineHeight: e.target.value })}
      />
      {/* Letter spacing */}
      <SliderRow
        label="Letter spacing"
        value={parseFloat(s.letterSpacing) || 0}
        min={-5} max={20} step={0.5}
        unit="px"
        onChange={(e) => update({ letterSpacing: `${e.target.value}px` })}
      />
    </Section>
  );
}

// ── Fill / Shape section ───────────────────────────────────────────────────
function FillSection({ element, onChange }) {
  const s = element.style || {};
  const update = (patch) => onChange(upd(element, patch));

  return (
    <Section title="Fill & Border" defaultOpen>
      <div className="space-y-1">
        <span className="text-[10px] text-muted">Background</span>
        <ColorSwatch value={s.background} onChange={(v) => update({ background: v })} />
      </div>
      <div className="space-y-1">
        <span className="text-[10px] text-muted">Border color</span>
        <ColorSwatch
          value={s.borderColor || "transparent"}
          onChange={(v) => update({ border: `${parseFloat(s.borderWidth) || 1}px solid ${v}`, borderColor: v })}
        />
      </div>
      <Row label="Border width">
        <input type="number" value={parseFloat(s.borderWidth) || 0} min={0} max={20}
          onChange={(e) => update({ border: `${e.target.value}px solid ${s.borderColor || "rgba(255,255,255,0.3)"}`, borderWidth: `${e.target.value}px` })}
          className="h-7 w-14 rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
        />
        <span className="text-[10px] text-muted">px</span>
      </Row>
      <Row label="Radius">
        <input type="number" value={parseFloat(s.borderRadius) || 0} min={0} max={200}
          onChange={(e) => update({ borderRadius: `${e.target.value}px` })}
          className="h-7 w-14 rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
        />
        <span className="text-[10px] text-muted">px</span>
      </Row>
      <SliderRow
        label="Opacity"
        value={Math.round((s.opacity ?? 1) * 100)}
        min={0} max={100} step={1}
        unit="%"
        onChange={(e) => update({ opacity: parseFloat(e.target.value) / 100 })}
      />
    </Section>
  );
}

// ── Image section ──────────────────────────────────────────────────────────
function ImageSection({ element, onChange }) {
  const s = element.style || {};
  const update = (patch) => onChange(upd(element, patch));
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    setErr(null);
    if (!isImageFile(file)) { setErr("Please choose an image file."); return; }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      onChange({ ...element, content: dataUrl });
    } catch (e) {
      setErr(e?.message || "Failed to process image");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Section title="Image" defaultOpen>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Processing…" : "Upload image"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="space-y-1">
        <span className="text-[10px] text-muted">URL</span>
        <input
          type="text"
          value={element.content?.startsWith("data:") ? "Uploaded image" : (element.content || "")}
          readOnly={element.content?.startsWith("data:")}
          onChange={(e) => onChange({ ...element, content: e.target.value })}
          placeholder="https://…"
          className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[11px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>
      <Row label="Radius">
        <input type="number" value={parseFloat(s.borderRadius) || 0} min={0} max={200}
          onChange={(e) => update({ borderRadius: `${e.target.value}px` })}
          className="h-7 w-14 rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
        />
        <span className="text-[10px] text-muted">px</span>
      </Row>
      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </Section>
  );
}

// ── Divider section ────────────────────────────────────────────────────────
function DividerSection({ element, onChange }) {
  const s = element.style || {};
  const update = (patch) => onChange(upd(element, patch));
  return (
    <Section title="Line" defaultOpen>
      <div className="space-y-1">
        <span className="text-[10px] text-muted">Color</span>
        <ColorSwatch value={s.color} onChange={(v) => update({ color: v })} />
      </div>
      <Row label="Thickness">
        <input type="number" value={parseFloat(s.thickness) || 2} min={1} max={24}
          onChange={(e) => update({ thickness: `${e.target.value}px` })}
          className="h-7 w-14 rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
        />
        <span className="text-[10px] text-muted">px</span>
      </Row>
    </Section>
  );
}

// ── Effects section (shadow, blur) ─────────────────────────────────────────
function EffectsSection({ element, onChange }) {
  const s = element.style || {};
  const update = (patch) => onChange(upd(element, patch));

  const shadowVal = s.boxShadow && s.boxShadow !== "none" ? s.boxShadow : "";
  const hasShadow = !!shadowVal;
  const shadowColor = shadowVal.match(/rgba?\([^)]+\)/) ? shadowVal.match(/rgba?\([^)]+\)/)[0] : "rgba(0,0,0,0.4)";
  const shadowBlur = shadowVal.match(/(\d+)px\s+rgba/) ? parseInt(shadowVal.match(/(\d+)px (\d+)px rgba/)?.[2] || "16") : 16;

  return (
    <Section title="Effects" defaultOpen={false}>
      <Row label="Drop shadow">
        <button
          type="button"
          onClick={() => update({ boxShadow: hasShadow ? "none" : `0 8px 32px -8px rgba(0,0,0,0.5)` })}
          className={cn(
            "h-6 w-10 rounded-full border transition-all",
            hasShadow ? "border-primary bg-primary" : "border-border bg-surface-2"
          )}
        >
          <div className={cn("h-4 w-4 rounded-full bg-white transition-transform mx-0.5", hasShadow ? "translate-x-4" : "translate-x-0")} />
        </button>
      </Row>
      {hasShadow && (
        <SliderRow
          label="Shadow blur"
          value={shadowBlur}
          min={0} max={80} step={2}
          unit="px"
          onChange={(e) => update({ boxShadow: `0 8px ${e.target.value}px -8px ${shadowColor}` })}
        />
      )}
      <SliderRow
        label="Blur"
        value={parseFloat((s.filter || "").replace(/[^0-9.]/g, "")) || 0}
        min={0} max={20} step={0.5}
        unit="px"
        onChange={(e) => update({ filter: parseFloat(e.target.value) > 0 ? `blur(${e.target.value}px)` : "none" })}
      />
    </Section>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 border border-border">
        <Sliders className="h-5 w-5 text-muted opacity-60" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-strong">No element selected</p>
        <p className="mt-1 text-[10px] text-muted">Click any element on the canvas to edit its properties</p>
      </div>
    </div>
  );
}

// ── Main PropertiesPanel ───────────────────────────────────────────────────
const TYPE_META = {
  text:    { icon: Type,          label: "Text",    color: "#a78bfa" },
  rect:    { icon: Square,        label: "Shape",   color: "#22d3ee" },
  button:  { icon: MousePointer2, label: "Button",  color: "#f472b6" },
  image:   { icon: ImageIcon,     label: "Image",   color: "#34d399" },
  divider: { icon: MinusSquare,   label: "Line",    color: "#fbbf24" },
};

export default function PropertiesPanel({ element, onChange }) {
  if (!element) return <EmptyState />;

  const meta = TYPE_META[element.type] || { icon: Square, label: element.type, color: "#a78bfa" };
  const Icon = meta.icon;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}40` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} strokeWidth={1.75} />
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">{meta.label}</div>
          <div className="font-mono text-[9px] text-muted">{element.id.slice(0, 8)}</div>
        </div>
      </div>

      {/* Sections */}
      <PositionSection element={element} onChange={onChange} />

      {(element.type === "text" || element.type === "button") && (
        <TextSection element={element} onChange={onChange} />
      )}

      {(element.type === "rect" || element.type === "button") && (
        <FillSection element={element} onChange={onChange} />
      )}

      {element.type === "image" && (
        <ImageSection element={element} onChange={onChange} />
      )}

      {element.type === "divider" && (
        <DividerSection element={element} onChange={onChange} />
      )}

      <EffectsSection element={element} onChange={onChange} />
    </div>
  );
}