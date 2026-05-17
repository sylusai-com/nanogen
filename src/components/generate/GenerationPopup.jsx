// src/components/generate/GenerationPopup.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  X as XIcon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { GenerationSteps } from "@/lib/bannerGeneration";

// Floating, non-blocking generation indicator anchored bottom-right.
// Replaces the full-screen GenerationProgress card on the new hub page —
// the user keeps scrolling / clicking through their existing banners
// while a fresh one is generated in the background.
//
// Shape: a compact card showing the aspect-correct skeleton preview, the
// current step label, a percentage, and a thin progress bar. A chevron
// expands it into the full step list (collapsed by default so the popup
// stays out of the way).
//
// State semantics:
//   - `open` toggles visibility entirely (parent unmounts when null).
//   - `done` flips the header to a success state and freezes the bar at 100%.
//   - `error` shows a red banner; the user can dismiss the popup.
//   - `onCancel` is required because the user can't otherwise abort.

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

const STEP_ORDER = [
  "upload_images",
  "analyze_reference",
  "analyze_subject",
  "enhance_prompt",
  "parallel_models",
  "score_banners",
  "detect_category",
  "fetch_bg_image",
  "save_banner",
];
const STEP_LIST = STEP_ORDER
  .map((name) => Object.values(GenerationSteps).find((s) => s.name === name))
  .filter(Boolean);

export default function GenerationPopup({
  open,
  aspect = "16:9",
  currentStep = null,
  stepsCompleted = [],
  stepsSkipped = [],
  done = false,
  error = null,
  onDismiss = null,
  onCancel = null,
  // Optional: a tiny title appended to the success state (e.g. the
  // banner's headline). Falls back to "Banner ready" alone when absent.
  successTitle = null,
}) {
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Stop the elapsed-seconds counter the moment the job completes or
    // errors out — keeping it running was making the popup feel like the
    // generation was still in flight even after the success state landed.
    if (!open || done || error) return;
    const start = Date.now() - elapsed * 1000;
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 250);
    return () => clearInterval(tick);
    // We intentionally exclude `elapsed` — it's a seed for `start` on
    // resume, not a dependency that should re-arm the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done, error]);

  // Reset the counter whenever the popup transitions from closed→open so
  // a second generation starts from 0s instead of resuming the prior count.
  useEffect(() => {
    if (open) setElapsed(0);
  }, [open]);

  const completedSet = useMemo(
    () => new Set((stepsCompleted || []).map((s) => s?.step || s?.name || s?.id)),
    [stepsCompleted],
  );
  const skippedSet = useMemo(
    () => new Set((stepsSkipped || []).map((s) => s?.step || s?.name || s?.id)),
    [stepsSkipped],
  );

  // Progress derived from step index — keeps the bar monotonic even when
  // the backend reports out-of-order progress numbers.
  const stepIdx = currentStep
    ? STEP_LIST.findIndex((s) => s.name === currentStep.name)
    : -1;
  const positional = stepIdx >= 0
    ? Math.round(((stepIdx + 1) / STEP_LIST.length) * 100)
    : 0;
  const pct = done ? 100 : (error ? positional : Math.max(positional, 5));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="generation-popup"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
          className={cn(
            "fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))]",
            "overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          )}
          role="status"
          aria-live="polite"
        >
          {/* Skeleton mini-preview — fixed compact height, content-aspect inside */}
          <div className="relative border-b border-border bg-surface-2/60 p-3">
            <div className={cn(
              aspectClass(aspect),
              "skeleton relative w-full overflow-hidden rounded-lg bg-surface-2",
            )}>
              <motion.div
                className="absolute inset-0"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
                style={{
                  background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--foreground) 10%, transparent), transparent)",
                }}
              />
              <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 p-3">
                <div className="h-2 w-12 rounded-full bg-foreground/10" />
                <div className="h-4 w-2/3 rounded-md bg-foreground/15" />
                <div className="h-3 w-1/2 rounded-md bg-foreground/10" />
              </div>
            </div>
          </div>

          {/* Header row */}
          <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
              {error
                ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                : done
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <Sparkles className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {error
                    ? "Generation failed"
                    : done
                      ? (successTitle ? `Banner ready · ${successTitle}` : "Banner ready")
                      : (currentStep?.label || "Preparing your banner…")}
                </span>
                {!done && !error && (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted" />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                <span className="tabular-nums">{pct}%</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{elapsed}s</span>
                {!done && !error && currentStep && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{currentStep.name?.replace(/_/g, " ")}</span>
                  </>
                )}
              </div>
            </div>
            {(done || error) ? (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            ) : onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-7 shrink-0 items-center rounded-full border border-border bg-surface-2/60 px-2.5 text-[11px] font-medium text-muted hover:border-border-strong hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            ) : null}
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-2.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/8">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  error ? "bg-amber-400/80" : done ? "bg-emerald-400" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-snug text-red-300">
              {error}
            </div>
          )}

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 border-t border-border bg-surface-2/40 px-4 py-2 text-[11px] font-medium text-muted hover:text-foreground transition-colors"
          >
            <span>{expanded ? "Hide" : "Show"} pipeline steps</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.ol
                key="step-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden border-t border-border bg-surface-2/30"
              >
                <div className="px-4 py-3 space-y-1.5">
                  {STEP_LIST.map((step) => {
                    const isSkipped = skippedSet.has(step.name);
                    const isComplete = !isSkipped && (
                      done ? true : (completedSet.has(step.name) && currentStep?.name !== step.name)
                    );
                    const isActive = !done && !isSkipped && currentStep?.name === step.name;
                    return (
                      <li
                        key={step.name}
                        className="flex items-center gap-2.5 text-[11px]"
                      >
                        <span className={cn(
                          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                          isComplete && "bg-primary text-primary-fg",
                          isActive && "border-2 border-primary",
                          isSkipped && "border border-muted/40 bg-surface-2",
                          !isComplete && !isActive && !isSkipped && "border border-border bg-surface-2",
                        )}>
                          {isComplete && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {isActive && <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />}
                          {isSkipped && <XIcon className="h-2 w-2 text-muted" />}
                        </span>
                        <span className={cn(
                          isComplete && "text-muted line-through decoration-muted/40",
                          isActive && "font-medium text-foreground",
                          isSkipped && "text-muted/70 line-through decoration-muted/40",
                          !isComplete && !isActive && !isSkipped && "text-muted/60",
                        )}>
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </div>
              </motion.ol>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
