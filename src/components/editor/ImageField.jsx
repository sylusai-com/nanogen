// src/components/editor/ImageField.jsx
"use client";

import { useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
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
// Companion field discovery — when this image field is "bg_image" we also
// surface the related range/select fields (brightness, blur, overlay, zoom,
// position) right here so the user has one cohesive panel to dial in the look.
// ─────────────────────────────────────────────────────────────────────────
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

  const isDataUri = draft.startsWith("data:");

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-3 min-w-0">
      <Label className="flex items-center gap-1.5 text-xs">
        <ImageIcon className="h-3 w-3" />
        {field.label}
      </Label>

      {/* Read-only display when an upload (data: URI) is set; otherwise empty */}
      <div className="relative">
        <Input
          value={isDataUri ? "Uploaded image" : draft}
          onChange={() => {}}
          placeholder="Upload an image to use as the banner background"
          className="pr-9 text-xs font-mono"
          readOnly
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

      {/* Upload from device — the only way to set an image. External URLs
          are intentionally not supported: backgrounds come from the AI
          model (CSS-only) or from a user upload. */}
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

      <p className="text-[10px] leading-snug text-muted">
        Backgrounds are generated by the AI model from your prompt. Upload a
        photo here only if you want to override the AI-generated background
        with your own image.
      </p>

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
