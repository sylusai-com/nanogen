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
  Shapes,
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
  allowExtras,
  onAllowExtrasChange,
}) {
  const textareaRef = useRef(null);
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-widest text-muted">
          Prompt
        </label>
        <span className="text-[11px] text-muted">{value.length}/500</span>
      </div>

      {/* Single contained surface — border never shifts */}
      <div
        className={cn(
          "rounded-2xl border bg-background transition-colors duration-150",
          focused
            ? "border-primary/50"
            : "border-border hover:border-border-strong",
        )}
      >
        {/* Attachment chips */}
        {(reference || subject) && (
          <div className="flex flex-wrap gap-2 border-b border-border px-3 pt-3 pb-2.5">
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

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 500))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={4}
          placeholder="Describe the banner you want — e.g. modern HTML/CSS hero for a fintech app, bold headline, navy + gold palette."
          className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-3 text-sm leading-relaxed placeholder:text-muted/60 outline-none"
        />

        {/* Toolbar — always inside the border, separated by a hairline */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2.5">
          <ReferenceButton reference={reference} onChange={onReferenceChange} />
          <SubjectButton subject={subject} onChange={onSubjectChange} />
          {/* Soft divider */}
          <span className="mx-0.5 h-4 w-px bg-border-strong/60" />
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
          {onAllowExtrasChange && (
            <>
              <span className="mx-0.5 h-4 w-px bg-border-strong/60" />
              <ExtrasToggle value={!!allowExtras} onChange={onAllowExtrasChange} />
            </>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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

function AttachmentChip({ label, hint, attachment, onRemove, tone = "default" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-2 py-1.5",
        tone === "primary"
          ? "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]"
          : "border-border bg-surface-2/60",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.dataUrl}
        alt=""
        className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
      />
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-foreground">{label}</div>
        <div className="truncate text-[10px] text-muted max-w-28">
          {attachment.name || hint}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
        aria-label={`Remove ${label.toLowerCase()}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

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
          "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
          attached
            ? tone === "primary"
              ? "border-primary/35 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
              : "border-border-strong bg-surface-2 text-foreground"
            : "border-border text-muted hover:border-border-strong hover:text-foreground",
          busy && "opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
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
      attachedLabel="Reference ✓"
      attached={!!reference}
      onChange={onChange}
      title={reference ? "Replace reference image" : "Reference image — AI extracts subject, palette, mood"}
    />
  );
}

function SubjectButton({ subject, onChange }) {
  return (
    <ImagePillButton
      icon={UserPlus}
      label="Subject"
      attachedLabel="Subject ✓"
      attached={!!subject}
      onChange={onChange}
      tone="primary"
      title={subject ? "Replace subject image" : "Subject image — appears IN the banner"}
    />
  );
}

// Toggle for decorative "extra elements". OFF → the banner is generated
// strictly from the prompt; ON → the model may add orbs, badges,
// patterns, and other rich decoration.
function ExtrasToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      title={
        value
          ? "Extra elements ON — the model may add decorative orbs, badges, patterns and other ornamentation."
          : "Extra elements OFF — the banner is generated strictly from your prompt, with no extra decoration."
      }
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        value
          ? "border-primary/35 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
          : "border-border text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      <Shapes className="h-3 w-3" />
      <span>{value ? "Extra elements ✓" : "Extra elements"}</span>
    </button>
  );
}

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

function InlineModelPicker({ models, loading, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = usePopover(open, setOpen);

  const list = Array.isArray(models) ? models : [];
  const selected = list.find((m) => m.slug === value || m.id === value) || null;
  const isAuto = value === "auto" || !selected;
  const triggerLabel = loading ? "Loading…" : isAuto ? "Auto" : selected.label;

  return (
    <div ref={ref} className="relative">
      <PillTrigger
        open={open}
        setOpen={setOpen}
        loading={loading}
        icon={<Sparkles className={cn("h-3 w-3", isAuto ? "text-primary" : "text-muted")} />}
        label={triggerLabel}
      />
      {open && !loading && (
        <Popover>
          <Option
            label="Auto"
            sub="Best of every enabled model"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            selected={isAuto}
            onClick={() => { onChange("auto"); setOpen(false); }}
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
              onClick={() => { onChange(m.slug); setOpen(false); }}
            />
          ))}
          {list.length === 0 && (
            <div className="px-3 py-4 text-center text-[11px] text-muted">
              No text models enabled.
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
  const triggerLabel = loading ? "Loading…" : selected ? selected.ratio : value || "Aspect";

  return (
    <div ref={ref} className="relative">
      <PillTrigger
        open={open}
        setOpen={setOpen}
        loading={loading}
        icon={<Ratio className="h-3 w-3 text-muted" />}
        label={triggerLabel}
      />
      {open && !loading && (
        <Popover>
          {list.length === 0 && (
            <div className="px-3 py-4 text-center text-[11px] text-muted">No aspect ratios configured.</div>
          )}
          {list.map((o) => (
            <Option
              key={o.id || o.ratio}
              label={o.ratio}
              sub={o.label && o.label !== o.ratio ? o.label : undefined}
              icon={<AspectFrame ratio={o.ratio} />}
              selected={value === o.ratio}
              onClick={() => { onChange(o.ratio); setOpen(false); }}
            />
          ))}
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
  const triggerLabel = loading ? "Loading…" : selected ? selected.label : "Style";

  return (
    <div ref={ref} className="relative">
      <PillTrigger
        open={open}
        setOpen={setOpen}
        loading={loading}
        icon={<Palette className="h-3 w-3 text-muted" />}
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
            onClick={() => { onChange(null); setOpen(false); }}
          />
          {list.length > 0 && <div className="my-1 border-t border-border" />}
          {list.map((s) => {
            const swatch = s.gradient || `linear-gradient(135deg, ${s.bg || "#0c0c10"} 0%, ${s.accent || "#a78bfa"} 60%, ${s.fg || "#ffffff"} 100%)`;
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
                onClick={() => { onChange(s.label); setOpen(false); }}
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
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        open
          ? "border-border-strong bg-surface-2 text-foreground"
          : "border-border text-muted hover:border-border-strong hover:text-foreground",
        loading && "opacity-60",
      )}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
      <span className="max-w-36 truncate">{label}</span>
      <ChevronDown className={cn("h-3 w-3 transition-transform duration-150", open && "rotate-180")} />
    </button>
  );
}

function Popover({ children }) {
  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-72 max-h-80 overflow-auto rounded-xl border border-border-strong bg-surface p-1 shadow-2xl">
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
      <span className="rounded-[2px] border border-muted-strong/70" style={dims} />
    </span>
  );
}

function Option({ label, sub, icon, badge, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2",
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
        {sub && <span className="block truncate text-[11px] text-muted">{sub}</span>}
      </span>
    </button>
  );
}