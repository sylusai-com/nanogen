"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Cpu,
  ImagePlus,
  Loader2,
  Palette,
  Ratio,
  Sparkles,
  UserPlus,
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

// ChatGPT-style composer. The textarea, attach buttons (reference + subject
// image), model picker, aspect-ratio dropdown, and style dropdown all live
// inside one bordered container so the whole input reads as a single
// conversational surface. Reference / subject / model / aspect / style state
// is owned by the parent (PromptForm).
export default function PromptInput({
  value,
  onChange,
  reference,
  onReferenceChange,
  subject,
  onSubjectChange,
  models,
  modelsLoading,
  modelSlug,
  onModelChange,
  aspects,
  aspect,
  onAspectChange,
  styles,
  style,
  onStyleChange,
  catalogLoading,
}) {
  const textareaRef = useRef(null);

  // Make the whole rounded container behave like a label — clicking the
  // gutter area focuses the textarea so the focus border lands cleanly
  // without overlapping the inline dropdown popovers.
  const focusTextarea = (e) => {
    if (e.target.closest("button, input, select, textarea, [data-no-focus]")) {
      return;
    }
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-widest text-muted">
          Prompt
        </label>
        <span className="text-[11px] text-muted">{value.length}/500</span>
      </div>

      <div
        onMouseDown={focusTextarea}
        className="group rounded-2xl border border-border bg-background transition-colors hover:border-border-strong focus-within:border-primary/60"
      >
        {(reference || subject) && (
          <div className="flex flex-wrap gap-2 border-b border-border/70 px-3 pt-2.5 pb-2">
            {reference && (
              <AttachmentChip
                label="Reference"
                hint="AI inspiration"
                attachment={reference}
                onRemove={() => onReferenceChange(null)}
              />
            )}
            {subject && (
              <AttachmentChip
                label="Subject"
                hint="Featured in banner"
                attachment={subject}
                onRemove={() => onSubjectChange(null)}
                tone="primary"
              />
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="Describe the banner you want — e.g. modern HTML/CSS hero for a fintech app, bold headline, navy + gold palette."
          className="block w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed placeholder:text-muted outline-none"
        />

        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
          <ReferenceButton
            reference={reference}
            onChange={onReferenceChange}
          />
          <SubjectButton
            subject={subject}
            onChange={onSubjectChange}
          />
          <InlineModelPicker
            models={models}
            loading={modelsLoading}
            value={modelSlug}
            onChange={onModelChange}
          />
          <InlineAspectPicker
            options={aspects}
            value={aspect}
            onChange={onAspectChange}
            loading={catalogLoading}
          />
          <InlineStylePicker
            options={styles}
            value={style}
            onChange={onStyleChange}
            loading={catalogLoading}
          />
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

// Generic attachment chip used by both the reference image and the subject
// image. Tone toggles a subtle accent so the user can tell at a glance
// which slot is filled.
function AttachmentChip({ label, hint, attachment, onRemove, tone = "default" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-2 py-1.5",
        tone === "primary"
          ? "border-primary/40 bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]"
          : "border-border bg-surface-2/60",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.dataUrl}
        alt=""
        className="h-9 w-9 rounded-md object-cover ring-1 ring-border"
      />
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-foreground">{label}</div>
        <div className="truncate text-[10px] text-muted max-w-32">
          {attachment.name || hint}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
        aria-label={`Remove ${label.toLowerCase()}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Generic image picker — handles the file input, compression, and error
// surfacing. Reused by the reference and subject buttons so they stay
// visually consistent.
function ImagePillButton({ icon, label, attachedLabel, attached, onChange, tone = "default", title }) {
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

  const Icon = icon;
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={error || title}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
          attached
            ? tone === "primary"
              ? "border-primary/40 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
              : "border-foreground/30 bg-surface-2 text-foreground"
            : "border-border bg-surface text-muted-strong hover:border-border-strong hover:text-foreground",
          busy && "opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        <span>{attached ? attachedLabel : label}</span>
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

function ReferenceButton({ reference, onChange }) {
  return (
    <ImagePillButton
      icon={ImagePlus}
      label="Reference"
      attachedLabel="Reference attached"
      attached={!!reference}
      onChange={onChange}
      title={
        reference
          ? "Replace reference image"
          : "Reference image — AI extracts subject, palette, mood (used as inspiration only)"
      }
    />
  );
}

function SubjectButton({ subject, onChange }) {
  return (
    <ImagePillButton
      icon={UserPlus}
      label="Subject image"
      attachedLabel="Subject attached"
      attached={!!subject}
      onChange={onChange}
      tone="primary"
      title={
        subject
          ? "Replace subject image"
          : "Subject image — appears IN the banner (e.g. a person, product, or photo you want featured)"
      }
    />
  );
}

// Hook used by every inline popover trigger. Centralises the click-outside
// + Escape close logic so each picker stays slim.
function usePopover(open, setOpen) {
  const ref = useRef(null);
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
  }, [open, setOpen]);
  return ref;
}

// Compact model picker that lives inside the composer toolbar. Trigger is
// a pill with the current model name; the popover lists Auto + every
// admin-enabled text model.
function InlineModelPicker({ models, loading, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = usePopover(open, setOpen);

  const list = Array.isArray(models) ? models : [];
  const selected = list.find((m) => m.slug === value || m.id === value) || null;
  const isAuto = value === "auto" || !selected;
  const triggerLabel = loading
    ? "Loading…"
    : isAuto
    ? "Auto"
    : selected.label;

  return (
    <div ref={ref} className="relative" data-no-focus>
      <PillTrigger
        open={open}
        setOpen={setOpen}
        loading={loading}
        icon={
          <Sparkles
            className={cn(
              "h-3.5 w-3.5",
              isAuto ? "text-primary" : "text-muted",
            )}
          />
        }
        label={triggerLabel}
      />

      {open && !loading && (
        <Popover>
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
        </Popover>
      )}
    </div>
  );
}

function InlineAspectPicker({ options, value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const ref = usePopover(open, setOpen);
  const list = Array.isArray(options) ? options : [];
  const selected = list.find((o) => o.ratio === value) || null;
  const triggerLabel = loading
    ? "Loading…"
    : selected
    ? selected.ratio
    : value || "Aspect";

  return (
    <div ref={ref} className="relative" data-no-focus>
      <PillTrigger
        open={open}
        setOpen={setOpen}
        loading={loading}
        icon={<Ratio className="h-3.5 w-3.5 text-muted" />}
        label={triggerLabel}
      />
      {open && !loading && (
        <Popover>
          {list.length === 0 && (
            <div className="px-3 py-4 text-center text-[11px] text-muted">
              No aspect ratios configured.
            </div>
          )}
          {list.map((o) => {
            const active = value === o.ratio;
            return (
              <Option
                key={o.id || o.ratio}
                label={o.ratio}
                sub={o.label && o.label !== o.ratio ? o.label : undefined}
                icon={<AspectFrame ratio={o.ratio} />}
                selected={active}
                onClick={() => {
                  onChange(o.ratio);
                  setOpen(false);
                }}
              />
            );
          })}
        </Popover>
      )}
    </div>
  );
}

function InlineStylePicker({ options, value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const ref = usePopover(open, setOpen);
  const list = Array.isArray(options) ? options : [];
  const selected = list.find((s) => s.label === value) || null;
  const triggerLabel = loading
    ? "Loading…"
    : selected
    ? selected.label
    : "Auto style";

  return (
    <div ref={ref} className="relative" data-no-focus>
      <PillTrigger
        open={open}
        setOpen={setOpen}
        loading={loading}
        icon={<Palette className="h-3.5 w-3.5 text-muted" />}
        label={triggerLabel}
      />
      {open && !loading && (
        <Popover>
          <Option
            label="Auto"
            sub="Model decides"
            icon={
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--primary)_18%,transparent)] text-primary">
                <Sparkles className="h-3 w-3" />
              </span>
            }
            selected={!value}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          {list.length > 0 && <div className="my-1 border-t border-border" />}
          {list.map((s) => {
            const swatch =
              s.gradient ||
              `linear-gradient(135deg, ${s.bg || "#0c0c10"} 0%, ${s.accent || "#a78bfa"} 60%, ${s.fg || "#ffffff"} 100%)`;
            return (
              <Option
                key={s.id || s.label}
                label={s.label}
                icon={
                  <span
                    className="inline-block h-4 w-4 rounded-md ring-1 ring-inset ring-border"
                    style={{ background: swatch }}
                  />
                }
                selected={value === s.label}
                onClick={() => {
                  onChange(s.label);
                  setOpen(false);
                }}
              />
            );
          })}
        </Popover>
      )}
    </div>
  );
}

function PillTrigger({ open, setOpen, loading, icon, label }) {
  return (
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
        icon
      )}
      <span className="max-w-48 truncate">{label}</span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-muted transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

function Popover({ children }) {
  return (
    <div className="absolute bottom-full left-0 z-30 mb-1.5 w-72 max-h-80 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
      {children}
    </div>
  );
}

function AspectFrame({ ratio }) {
  const [w, h] = String(ratio || "16:9").split(":").map(Number);
  const safeW = Number.isFinite(w) && w > 0 ? w : 16;
  const safeH = Number.isFinite(h) && h > 0 ? h : 9;
  const box = 16;
  const dims =
    safeW >= safeH
      ? { width: box, height: Math.round((box * safeH) / safeW) }
      : { width: Math.round((box * safeW) / safeH), height: box };
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center">
      <span
        className="rounded-[2px] border border-muted-strong/70"
        style={dims}
      />
    </span>
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
        {sub && (
          <span className="block truncate text-[11px] text-muted">{sub}</span>
        )}
      </span>
    </button>
  );
}
