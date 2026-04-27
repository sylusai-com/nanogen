"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import Field from "./Field";
import EmptyData from "@/components/ui/EmptyData";

export default function ModelSelector({ models, selected, onToggle, loading }) {
  if (loading) {
    return (
      <Field label="Models">
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-3 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading models…
        </div>
      </Field>
    );
  }

  if (!models || models.length === 0) {
    return (
      <Field label="Models">
        <EmptyData
          title="No image models configured"
          body="Ask an admin to enable models in Admin → Models."
          className="py-8"
        />
      </Field>
    );
  }

  return (
    <Field
      label="Models"
      hint={`${selected.length} selected · runs in parallel`}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {models.map((m) => {
          const checked = selected.includes(m.slug);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggle(m.slug)}
              className={cn(
                "group flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                checked
                  ? "border-[var(--primary)]/50 bg-[color-mix(in_oklab,var(--primary)_8%,var(--surface))]"
                  : "border-border bg-background hover:border-border-strong hover:bg-surface",
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    checked
                      ? "bg-primary text-primary-fg"
                      : "bg-surface-2 text-muted",
                  )}
                >
                  {checked ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] font-mono">
                      {m.slug.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{m.label}</span>
                  <span className="block truncate text-[10px] text-muted">
                    {m.provider} · {m.modelId}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}
