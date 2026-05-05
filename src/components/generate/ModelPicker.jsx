// src/components/generate/ModelPicker.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Cpu, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

// ChatGPT-style model picker — pinned dropdown that lists every
// admin-enabled text model. The selected model is what /api/banners
// uses to generate the banner. Picking "Auto" runs the multi-model
// fan-out (the legacy behavior).
//
// `models` are returned by /lib/db/models.js#listEnabledTextModels and
// have shape { id, slug, label, provider, modelId, isDefault }.
export default function ModelPicker({ models, value, onChange, loading }) {
  const [open, setOpen] = useState(false);
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
  }, [open]);

  const list = Array.isArray(models) ? models : [];
  const selected = list.find((m) => m.slug === value || m.id === value) || null;

  const triggerLabel = loading
    ? "Loading models…"
    : value === "auto" || !selected
    ? "Auto · best of every model"
    : selected.label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={loading}
        className={cn(
          "inline-flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5 text-left text-sm transition-colors",
          "hover:border-border-strong",
          open && "border-border-strong",
          loading && "opacity-60",
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-foreground">{triggerLabel}</span>
            <span className="block truncate text-[11px] text-muted">
              {value === "auto" || !selected
                ? "Runs every enabled model in parallel and keeps the best"
                : `${selected.provider} · ${selected.modelId}`}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && !loading && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-80 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
          <Option
            label="Auto"
            sub="Best of every enabled model"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            selected={value === "auto"}
            onClick={() => {
              onChange("auto");
              setOpen(false);
            }}
          />
          {list.length > 0 && (
            <div className="my-1 border-t border-border" />
          )}
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
