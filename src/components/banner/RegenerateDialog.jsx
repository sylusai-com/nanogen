"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Check,
  ChevronDown,
  Cpu,
  Loader2,
  RefreshCcw,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/layout/AuthProvider";
import { useCachedQuery } from "@/lib/cache";
import { listEnabledTextModels } from "@/lib/db/models";
import { useGeneration } from "@/components/generate/GenerationProvider";
import { cn } from "@/lib/cn";

// Lightweight regeneration composer. The dialog is just the textarea +
// suggestions + model picker; the floating GenerationPopup mounted by
// GenerationProvider takes over for progress and persists across page
// navigation, so the user can leave the detail page mid-regenerate and
// still see the job's status in the bottom-right corner.
//
// On submit:
//   1. Close the dialog immediately so the underlying banner stays visible.
//   2. Provider's popup takes over; job is owned at the layout level.
//   3. On completion, the provider routes to /dashboard/banners (set via
//      the redirectTo arg below).

const SUGGESTIONS = [
  "Swap palette to warm earthy tones",
  "Tighten the headline and add a trust line",
  "Make the layout more minimal and spacious",
];

export default function RegenerateDialog({ banner, open, onClose }) {
  const { startGeneration } = useGeneration();
  const { isAdmin } = useAuth();

  // Hand-off to the provider so the popup outlives this component when
  // the user navigates away from the detail page. The provider handles
  // popup state, polling, invalidation, and the post-completion redirect
  // to /dashboard/banners (the gallery the user expects to land on after
  // a regenerate).
  const runRegeneration = useCallback(async ({ prompt, modelSlug }) => {
    if (!banner) return;
    await startGeneration({
      payload: {
        prompt: prompt.trim(),
        regenerateFromId: banner.id,
        aspect: banner.aspect,
        style: banner.style || null,
        model: modelSlug && modelSlug !== "auto" ? modelSlug : null,
      },
      aspect: banner.aspect || "16:9",
      isAdmin,
      // Per the user's request: regenerate lands on the gallery, not the
      // new banner's editor. The provider will route here on dismiss.
      redirectTo: "/dashboard/banners",
    });
  }, [banner, isAdmin, startGeneration]);

  if (!open || !banner) return null;
  return (
    <DialogBody
      banner={banner}
      onClose={onClose}
      onSubmit={runRegeneration}
    />
  );
}

function DialogBody({ banner, onClose, onSubmit }) {
  const { supabase } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [modelSlug, setModelSlug] = useState("auto");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  const modelsQ = useCachedQuery(
    ["catalog", "text-models"],
    () => listEnabledTextModels(supabase),
    { ttlMs: 5 * 60_000, tags: ["models"] },
  );

  useEffect(() => {
    const id = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    // Close the dialog immediately. The parent's onSubmit (defined in
    // RegenerateDialog, not here) holds the polling closure so it
    // survives this unmount — that's the fix for the "Job not found"
    // popup the old version produced.
    onClose?.();

    // Hand off to the parent and let it own polling + navigation.
    // Awaiting here is fine even though DialogBody is about to unmount;
    // setState after unmount is a no-op in React 19, and the parent
    // tracks the actual lifecycle of the popup.
    await onSubmit({ prompt, modelSlug });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => !submitting && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
              <RefreshCcw className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Regenerate banner</h3>
              <p className="text-[11px] text-muted">
                Describe what should change. The original brief and assets are kept.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label className="text-xs font-medium uppercase tracking-widest text-muted">
                What should change?
              </label>
              <span className="text-[11px] text-muted">{prompt.length}/500</span>
            </div>
            <div className="rounded-2xl border border-border bg-background transition-colors duration-150 focus-within:border-primary/50">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="e.g. swap to warm earthy palette, replace the headline with 'Made for everyday', simplify decoration."
                className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-3 text-sm leading-relaxed placeholder:text-muted/60 outline-none"
              />
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2.5">
                <InlineModelPicker
                  models={modelsQ.data}
                  loading={modelsQ.isLoading && !modelsQ.data}
                  value={modelSlug}
                  onChange={setModelSlug}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Wand2 className="h-3 w-3" /> Try
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setPrompt(s)}
                className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-strong hover:border-border-strong hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!prompt.trim() || submitting}
              leftIcon={
                submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )
              }
            >
              {submitting ? "Starting" : "Regenerate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className={cn("h-3 w-3", isAuto ? "text-primary" : "text-muted")} />
        )}
        <span className="max-w-36 truncate">{triggerLabel}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && !loading && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-72 max-h-80 overflow-auto rounded-xl border border-border-strong bg-surface p-1 shadow-2xl">
          <Option
            label="Auto"
            sub="Best-scoring model from history"
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
