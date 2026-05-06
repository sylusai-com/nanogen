"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Cpu,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { compressImage, isImageFile } from "@/lib/imageUpload";

const SUGGESTIONS = [
  "Launch banner for a fintech app, soft gold accent on navy",
  "Cyberpunk product hero with neon violet glow",
  "Editorial sale promo with bold serif headline",
];

// ChatGPT-style composer. The textarea, reference-image attach button,
// and model picker live inside one bordered container so the whole input
// reads as a single conversational surface. Reference state and model
// state are owned by the parent (PromptForm).
export default function PromptInput({
  value,
  onChange,
  reference,
  onReferenceChange,
  models,
  modelsLoading,
  modelSlug,
  onModelChange,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-widest text-muted">
          Prompt
        </label>
        <span className="text-[11px] text-muted">{value.length}/500</span>
      </div>

      <div className="rounded-2xl border border-border bg-background transition-shadow focus-within:border-border-strong focus-within:ring-2 focus-within:ring-ring">
        {reference && (
          <ReferenceChip
            reference={reference}
            onRemove={() => onReferenceChange(null)}
          />
        )}

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="Describe the banner you want — e.g. modern HTML/CSS hero for a fintech app, bold headline, navy + gold palette."
          className="block w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed placeholder:text-muted outline-none"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <ReferenceButton
              reference={reference}
              onChange={onReferenceChange}
            />
            <InlineModelPicker
              models={models}
              loading={modelsLoading}
              value={modelSlug}
              onChange={onModelChange}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          <Wand2 className="h-3 w-3" /> Try
        </span>
        {SUGGESTIONS.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => onChange(s)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-strong hover:border-border-strong hover:text-foreground transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// Paperclip-style attach button. Compresses the image client-side before
// handing it back so the form's eventual POST stays under the body limit.
function ReferenceButton({ reference, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    setError(null);
    if (!isImageFile(file)) {
      setError("Please choose an image (PNG, JPG, WEBP).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      onChange({ name: file.name, dataUrl });
    } catch (e) {
      setError(e?.message || "Failed to process image");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={
          error ||
          (reference
            ? "Replace reference image"
            : "Attach a reference image — AI extracts subject, palette, mood")
        }
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
          reference
            ? "border-primary/40 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
            : "border-border bg-surface text-muted-strong hover:border-border-strong hover:text-foreground",
          busy && "opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        <span>{reference ? "Reference attached" : "Reference image"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </>
  );
}

function ReferenceChip({ reference, onRemove }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border/70 px-3 pt-2.5 pb-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={reference.dataUrl}
        alt=""
        className="h-10 w-10 rounded-md object-cover ring-1 ring-border"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-foreground">{reference.name}</div>
        <div className="text-[10px] text-muted">
          AI will analyze this for subject, palette, mood
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
        aria-label="Remove reference image"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Compact model picker that lives inside the composer toolbar. Trigger is
// a pill with the current model name; the popover lists Auto + every
// admin-enabled text model.
function InlineModelPicker({ models, loading, value, onChange }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = Array.isArray(models) ? models : [];
  const selected = list.find((m) => m.slug === value || m.id === value) || null;
  const isAuto = value === "auto" || !selected;
  const triggerLabel = loading
    ? "Loading…"
    : isAuto
    ? "Auto"
    : selected.label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={loading}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
          "border-border bg-surface text-foreground hover:border-border-strong",
          open && "border-border-strong",
          loading && "opacity-60",
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
        ) : (
          <Sparkles
            className={cn(
              "h-3.5 w-3.5",
              isAuto ? "text-primary" : "text-muted",
            )}
          />
        )}
        <span className="max-w-48 truncate">{triggerLabel}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && !loading && (
        <div className="absolute bottom-full left-0 z-30 mb-1.5 w-72 max-h-80 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
          <Option
            label="Auto"
            sub="Best of every enabled model"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            selected={isAuto}
            onClick={() => {
              onChange("auto");
              setOpen(false);
            }}
          />
          {list.length > 0 && <div className="my-1 border-t border-border" />}
          {list.map((m) => (
            <Option
              key={m.id}
              label={m.label}
              sub={`${m.provider} · ${m.modelId}`}
              icon={<Cpu className="h-3.5 w-3.5" />}
              badge={m.isDefault ? "Default" : null}
              selected={value === m.slug}
              onClick={() => {
                onChange(m.slug);
                setOpen(false);
              }}
            />
          ))}
          {list.length === 0 && (
            <div className="px-3 py-4 text-center text-[11px] text-muted">
              No text models enabled. Ask an admin to add one in Admin → Models.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Option({ label, sub, icon, badge, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        "hover:bg-surface-2",
        selected && "bg-surface-2",
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted",
        )}
      >
        {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm text-foreground">{label}</span>
          {badge && (
            <span className="rounded-full bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
              {badge}
            </span>
          )}
        </span>
        <span className="block truncate text-[11px] text-muted">{sub}</span>
      </span>
    </button>
  );
}
