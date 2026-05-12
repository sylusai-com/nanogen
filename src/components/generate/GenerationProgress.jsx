"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, XCircle, X as XIcon } from "lucide-react";
import Card from "@/components/ui/Card";
import { GenerationSteps } from "@/lib/bannerGeneration";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

const STEP_MS = 8000;
const STEP_PCTS = [0, 15, 30, 45, 60, 75, 85, 95];

// Step order matches the live /api/banners execution order. Authoritative
// here (not derived from GenerationJobSteps insertion order) because we
// also need to skip steps the live route doesn't run (e.g. the orchestrator-
// only GENERATE_BACKGROUND stage).
//
// fetch_bg_image runs LATE in the pipeline now: the model writes its CSS-
// only design first, the classifier labels it, and only then do we try to
// fetch a matching photographic background. If the providers + AI image
// fallback all return nothing, the step is marked skipped and the model's
// own design ships.
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

function useSteppedProgress({ done = false } = {}) {
  const [pct, setPct] = useState(STEP_PCTS[0]);

  useEffect(() => {
    if (done) {
      const id = setInterval(() => {
        setPct((p) => {
          if (p >= 100) { clearInterval(id); return 100; }
          return Math.min(100, p + 5);
        });
      }, 30);
      return () => clearInterval(id);
    }

    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const stepIdx = Math.min(STEP_PCTS.length - 1, Math.floor(elapsed / STEP_MS));
      const target = STEP_PCTS[stepIdx];
      setPct((p) => (p < target ? target : p));
    }, 200);
    return () => clearInterval(id);
  }, [done]);

  return pct;
}

export default function GenerationProgress({
  aspect = "16:9",
  done = false,
  currentStep = null,
  stepsCompleted = [],
  stepsSkipped = [],
  error = null,
  onCancel = null,
}) {
  const [elapsed, setElapsed] = useState(0);
  const pct = useSteppedProgress({ done });

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 250);
    return () => clearInterval(tick);
  }, []);

  const display = Math.min(100, Math.max(0, Math.round(pct)));

  const completedSet = useMemo(
    () => new Set((stepsCompleted || []).map((s) => s?.step || s?.name || s?.id)),
    [stepsCompleted],
  );
  // Skip reasons keyed by step name — so we can both render the cross icon
  // AND show the explanation as a tooltip on hover.
  const skippedMap = useMemo(() => {
    const m = new Map();
    for (const s of stepsSkipped || []) {
      const key = s?.step || s?.name || s?.id;
      if (key) m.set(key, s?.reason || null);
    }
    return m;
  }, [stepsSkipped]);

  // Derive the bar from the step's position in the execution order rather
  // than its embedded progress number. The orchestrator's progress values
  // are non-monotonic across the live pipeline (DETECT_CATEGORY=80 fires
  // *after* SCORE_BANNERS=90), so using positional progress keeps the bar
  // moving forward visibly regardless of the underlying values.
  const stepIdx = currentStep
    ? STEP_LIST.findIndex((s) => s.name === currentStep.name)
    : -1;
  const positional = stepIdx >= 0
    ? Math.round(((stepIdx + 1) / STEP_LIST.length) * 100)
    : display;
  const statusPercent = done ? 100 : positional;
  const activeLabel = done ? "Banner ready" : currentStep?.label || "Preparing your banner…";

  return (
    <Card elevated className="overflow-hidden p-0">
      {/* Skeleton preview */}
      <div className="relative">
        <div className={`${aspectClass(aspect)} skeleton relative w-full overflow-hidden bg-surface-2`}>
          <motion.div
            className="absolute inset-0"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
            style={{
              background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--foreground) 10%, transparent), transparent)",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 p-6 md:p-10">
            <div className="h-3 w-24 rounded-full bg-foreground/10" />
            <div className="h-10 w-3/4 rounded-md bg-foreground/15" />
            <div className="h-10 w-1/2 rounded-md bg-foreground/15" />
            <div className="h-3 w-2/3 rounded-full bg-foreground/8" />
            <div className="h-3 w-1/3 rounded-full bg-foreground/8" />
            <div className="mt-2 flex gap-2">
              <div className="h-9 w-32 rounded-full bg-foreground/15" />
              <div className="h-9 w-24 rounded-full bg-foreground/8" />
            </div>
          </div>
        </div>
      </div>

      {/* Progress panel */}
      <div className="border-t border-border bg-surface px-5 py-5 md:px-6">
        {/* Header row */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              {!done && (
                <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
              )}
              <span className="text-sm font-medium text-foreground truncate">{activeLabel}</span>
            </div>
            {/* Progress bar */}
            <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-foreground/8">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: `${statusPercent}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 tabular-nums text-xs text-muted">{elapsed}s</span>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-border-strong bg-surface-2 px-4 py-3">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Generation failed</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{error}</p>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="shrink-0 text-xs font-medium text-muted hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Steps — clean vertical list. Four states per row:
            ✓  completed — backend recorded this step in stepsCompleted
            ✗  skipped   — backend marked it via job.markStepSkipped()
            ◌  active    — backend's currentStep matches this row
            ·  pending   — hasn't been reached yet
        */}
        <ol className="space-y-0">
          {STEP_LIST.map((step, idx) => {
            const skipReason = skippedMap.get(step.name);
            const isSkipped = skipReason !== undefined;
            const isComplete = !isSkipped && (
              done
                ? !isSkipped // when done, everything not skipped is complete
                : (completedSet.has(step.name) && currentStep?.name !== step.name)
            );
            const isActive = !done && !isSkipped && currentStep?.name === step.name;
            const isLast = idx === STEP_LIST.length - 1;

            return (
              <li key={step.name} className="flex items-stretch gap-3">
                {/* Track column */}
                <div className="flex flex-col items-center">
                  {/* Dot */}
                  <div
                    className={cn(
                      "relative z-10 mt-3 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-4 transition-colors duration-300",
                      isComplete
                        ? "bg-primary ring-[color-mix(in_oklab,var(--primary)_15%,transparent)]"
                        : isActive
                        ? "bg-background ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] border-2 border-primary"
                        : isSkipped
                        ? "bg-surface-2 ring-[color-mix(in_oklab,var(--muted)_15%,transparent)] border border-muted/40"
                        : "bg-surface-2 ring-transparent border border-border",
                    )}
                    title={isSkipped && skipReason ? skipReason : undefined}
                  >
                    {isComplete && <CheckCircle2 className="h-2.5 w-2.5 text-primary-fg" />}
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                    {isSkipped && <XIcon className="h-2.5 w-2.5 text-muted" strokeWidth={2.5} />}
                  </div>
                  {/* Connector line. Stays bright (primary) once any step
                      past this row has run — completed OR skipped both
                      count as "we got past it". */}
                  {!isLast && (
                    <div
                      className={cn(
                        "mt-1 w-px flex-1 mb-1 rounded-full transition-colors duration-500",
                        (isComplete || isSkipped) ? "bg-primary/30" : "bg-border",
                      )}
                    />
                  )}
                </div>

                {/* Label */}
                <div className={cn("pb-4 pt-2.5 min-w-0", isLast && "pb-0")}>
                  <p
                    className={cn(
                      "text-sm transition-colors duration-300",
                      isComplete
                        ? "text-muted line-through decoration-muted/40"
                        : isActive
                        ? "font-medium text-foreground"
                        : isSkipped
                        ? "text-muted/70 line-through decoration-muted/40"
                        : "text-muted/60",
                    )}
                    title={isSkipped && skipReason ? skipReason : undefined}
                  >
                    {step.label}
                  </p>
                  {isSkipped && skipReason && (
                    <p className="mt-0.5 text-[10px] leading-tight text-muted/60">
                      Skipped — {skipReason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}