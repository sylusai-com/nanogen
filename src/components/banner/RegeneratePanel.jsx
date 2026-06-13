"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Cpu,
  Loader2,
  RefreshCcw,
  Shapes,
  Sparkles,
  Wand2,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/layout/AuthProvider";
import { useCachedQuery } from "@/lib/cache";
import { listEnabledTextModels } from "@/lib/db/models";
import { useGeneration } from "@/components/generate/GenerationProvider";
import { cn } from "@/lib/cn";

// Inline regeneration composer for the banner detail page.
//
// This replaces the old modal RegenerateDialog: the input box now lives
// directly on /dashboard/banners/[id], always visible, no popup. Submitting
// hands off to the GenerationProvider — its floating bottom-right popup
// tracks progress and (on click) opens the freshly regenerated banner.

const SUGGESTIONS = [
  "Swap palette to warm earthy tones",
  "Tighten the headline and add a trust line",
  "Make the layout more minimal and spacious",
];

export default function RegeneratePanel({ banner }) {
  const { supabase, isAdmin } = useAuth();
  const { gen, startGeneration } = useGeneration();

  const [prompt, setPrompt] = useState("");
  const [modelSlug, setModelSlug] = useState("auto");
  // Opt-in for decorative extras — OFF by default so a regenerate stays
  // strictly faithful to the change request.
  const [allowExtras, setAllowExtras] = useState(false);

  // A generation is mid-flight when the popup is open and not yet
  // done / errored. Disables the submit button so a second regenerate
  // can't stomp the first.
  const busy = gen.open && !gen.done && !gen.error;

  const modelsQ = useCachedQuery(
    ["catalog", "text-models"],
    () => listEnabledTextModels(supabase),
    { ttlMs: 5 * 60_000, tags: ["models"] },
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim() || busy || !banner) return;
    startGeneration({
      payload: {
        prompt: prompt.trim(),
        regenerateFromId: banner.id,
        aspect: banner.aspect,
        style: banner.style || null,
        model: modelSlug && modelSlug !== "auto" ? modelSlug : null,
        allowExtras,
      },
      aspect: banner.aspect || "16:9",
      isAdmin,
    });
    // Clear the box — progress now lives in the floating popup, which
    // also handles navigating to the new banner once it's ready.
    setPrompt("");
  };

  if (!banner) return null;

  return (
    <Card elevated as="form" className="p-5">
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

      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <label className="text-xs font-medium uppercase tracking-widest text-muted">
              What should change?
            </label>
            <span className="text-[11px] text-muted">{prompt.length}/500</span>
          </div>
          <div className="rounded-2xl border border-border bg-background transition-colors duration-150 focus-within:border-primary/50">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
              rows={2}
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
              <span className="mx-0.5 h-4 w-px bg-border-strong/60" />
              <ExtrasToggle value={allowExtras} onChange={setAllowExtras} />
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

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted">
            {busy
              ? "A generation is already running — see the popup."
              : "Progress shows in the bottom-right popup."}
          </p>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!prompt.trim() || busy}
            leftIcon={
              busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )
            }
          >
            {busy ? "Regenerating" : "Regenerate"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Toggle for decorative "magic prompt". OFF → strict regeneration from
// the change request; ON → the model may add richer ornamentation.
function ExtrasToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      title={
        value
          ? "Magic prompt ON — the model may add decorative orbs, badges, patterns and other ornamentation."
          : "Magic prompt OFF — the banner is regenerated strictly from your request, with no extra decoration."
      }
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        value
          ? "border-primary/35 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
          : "border-border text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      <Shapes className="h-3 w-3" />
      <span>{value ? "Magic prompt ✓" : "Magic prompt"}</span>
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
