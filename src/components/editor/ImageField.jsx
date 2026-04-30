// src/components/editor/ImageField.jsx
"use client";

import { useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Input, Label } from "@/components/ui/Input";
import { compressImage, isImageFile } from "@/lib/imageUpload";

// ─────────────────────────────────────────────────────────────────────────
// CSS url() helpers
// ─────────────────────────────────────────────────────────────────────────
function unwrap(value) {
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/^url\(["']?(.+?)["']?\)$/i);
  return m ? m[1] : s;
}
function wrap(url) {
  const u = (url || "").trim();
  if (!u) return "";
  return `url("${u}")`;
}

// ─────────────────────────────────────────────────────────────────────────
// Curated Unsplash quick-pick — broad set so users have starting points
// without leaving the app. These are real Unsplash photo IDs.
// ─────────────────────────────────────────────────────────────────────────
const UNSPLASH_PICKS = [
  { id: "1518770660439-4636190af475",   label: "Tech / Circuit" },
  { id: "1620712943543-bcc4688e7485",   label: "AI / Abstract" },
  { id: "1517336714731-489689fd1ca8",   label: "Laptop work" },
  { id: "1556761175-b413da4baf72",      label: "Business" },
  { id: "1524758631624-e2822e304c36",   label: "Modern office" },
  { id: "1542435503-956c469947f6",      label: "Food" },
  { id: "1502602898657-3e91760cbb34",   label: "Travel" },
  { id: "1505740420928-5e560c06d30e",   label: "Lifestyle" },
  { id: "1483985988355-763728e1935b",   label: "Fashion" },
  { id: "1542291026-7eec264c27ff",      label: "Product" },
  { id: "1531297484001-80022131f5a1",   label: "Workspace" },
  { id: "1493612276216-ee3925520721",   label: "Code" },
];

function unsplashUrl(id, size = 800) {
  return `https://images.unsplash.com/photo-${id}?w=${size}&q=80&auto=format&fit=crop`;
}

// ─────────────────────────────────────────────────────────────────────────
// Companion field discovery — when this image field is "bg_image" we also
// surface the related range/select fields (brightness, blur, overlay, zoom,
// position) right here so the user has one cohesive panel to dial in the look.
// ─────────────────────────────────────────────────────────────────────────
const COMPANION_IDS = ["bg_brightness", "bg_blur", "bg_overlay", "bg_zoom", "bg_position"];

function findCompanion(allFields, id) {
  return allFields.find((f) => f.id === id);
}

// ─────────────────────────────────────────────────────────────────────────
// Inline range slider matching house style (RangeField is its own component
// elsewhere; we re-implement the same look here for tight in-panel layout).
// ─────────────────────────────────────────────────────────────────────────
function MiniRange({ field, onChange, format }) {
  if (!field) return null;
  const min  = Number(field.min ?? 0);
  const max  = Number(field.max ?? 100);
  const step = Number(field.step ?? 1);
  const v    = Number(field.value ?? min);
  const display = format ? format(v, field.unit) : `${v}${field.unit || ""}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.id}>{field.label}</Label>
        <span className="font-mono text-[11px] text-muted-strong">{display}</span>
      </div>
      <input
        id={field.id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(field.id, Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
      />
    </div>
  );
}

function MiniSelect({ field, onChange }) {
  if (!field) return null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>{field.label}</Label>
      <select
        id={field.id}
        value={field.value}
        onChange={(e) => onChange(field.id, e.target.value)}
        className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-border-strong focus:ring-2 focus:ring-ring"
      >
        {(field.options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Live preview of the image with current adjustments applied — gives users
// instant feedback on brightness/blur/overlay/zoom/position before they
// commit the change to the actual banner.
// ─────────────────────────────────────────────────────────────────────────
function LivePreview({ url, brightness, blur, overlay, zoom, position }) {
  const filter = `brightness(${brightness ?? 0.7}) blur(${blur ?? 0}px)`;
  return (
    <div className="relative h-32 w-full overflow-hidden rounded-lg border border-border bg-surface-2">
      <div
        className="absolute inset-0 transition-[filter] duration-150"
        style={{
          backgroundImage: `url("${url}")`,
          backgroundSize: `${zoom ?? 110}%`,
          backgroundPosition: position ?? "center center",
          filter,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent, rgba(0,0,0,${overlay ?? 0.45}))`,
        }}
      />
      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between text-[10px] text-white/80">
        <span className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono backdrop-blur">preview</span>
        <span className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono backdrop-blur">
          {Math.round((brightness ?? 0.7) * 100)}% · {blur ?? 0}px · {Math.round((overlay ?? 0.45) * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main field component
// ─────────────────────────────────────────────────────────────────────────
export default function ImageField({ field, onChange, allFields = [] }) {
  const [draft, setDraft]       = useState(unwrap(field.value));
  const [showPicker, setPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const commit = (val) => {
    setDraft(val);
    onChange(field.id, val ? wrap(val) : "");
  };

  const onPickFile = async (file) => {
    if (!file) return;
    setUploadError(null);
    if (!isImageFile(file)) {
      setUploadError("Please choose an image file (PNG, JPG, WEBP).");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      commit(dataUrl);
    } catch (e) {
      setUploadError(e?.message || "Failed to process image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Only attach the companion controls when this is the conventional
  // "bg_image" field. Other image fields stay simple URL inputs.
  const isBgImage = field.id === "bg_image";

  const brightness = isBgImage ? findCompanion(allFields, "bg_brightness") : null;
  const blur       = isBgImage ? findCompanion(allFields, "bg_blur")       : null;
  const overlay    = isBgImage ? findCompanion(allFields, "bg_overlay")    : null;
  const zoom       = isBgImage ? findCompanion(allFields, "bg_zoom")       : null;
  const position   = isBgImage ? findCompanion(allFields, "bg_position")   : null;

  const hasAnyCompanion = !!(brightness || blur || overlay || zoom || position);

  // Helper for slider format strings.
  const fmtMul     = (v) => `${Math.round(v * 100)}%`;
  const fmtZoom    = (v) => `${v}%`;
  const fmtPx      = (v) => `${v}px`;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-4">
      <Label className="flex items-center gap-1.5 text-xs">
        <ImageIcon className="h-3 w-3" />
        {field.label}
      </Label>

      {/* URL input + clear */}
      <div className="relative">
        <Input
          value={draft.startsWith("data:") ? "Uploaded image" : draft}
          onChange={(e) => commit(e.target.value)}
          placeholder="https://images.unsplash.com/..."
          className="pr-9 text-xs font-mono"
          readOnly={draft.startsWith("data:")}
        />
        {draft && (
          <button
            type="button"
            onClick={() => commit("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            aria-label="Clear"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Upload from device */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-strong transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {uploading ? "Processing…" : "Upload image"}
        </button>
        <span className="text-[10px] text-muted">PNG/JPG/WEBP — auto-compressed</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
      </div>
      {uploadError && (
        <div className="text-[11px] text-red-400">{uploadError}</div>
      )}

      {/* Quick-pick from curated Unsplash list */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setPicker((s) => !s)}
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          {showPicker ? "Hide quick picks" : "Show quick picks"}
        </button>
        {showPicker && (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {UNSPLASH_PICKS.map((p) => {
              const url = unsplashUrl(p.id, 400);
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => commit(unsplashUrl(p.id))}
                  className="group relative aspect-video overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-border-strong"
                >
                  <span
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundImage: `url("${url}")` }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Live preview with current adjustments */}
      {draft && (
        <LivePreview
          url={draft}
          brightness={brightness?.value}
          blur={blur?.value}
          overlay={overlay?.value}
          zoom={zoom?.value}
          position={position?.value}
        />
      )}

      {/* Image controls (auto-shown for bg_image) */}
      {hasAnyCompanion && draft && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Image adjustments
          </div>
          <MiniRange  field={brightness} onChange={onChange} format={fmtMul}  />
          <MiniRange  field={blur}       onChange={onChange} format={fmtPx}   />
          <MiniRange  field={overlay}    onChange={onChange} format={fmtMul}  />
          <MiniRange  field={zoom}       onChange={onChange} format={fmtZoom} />
          <MiniSelect field={position}   onChange={onChange} />
        </div>
      )}
    </div>
  );
}