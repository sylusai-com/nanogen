// src/components/generate/GenerationProgress.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Circle, LoaderCircle, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import { GenerationSteps } from "@/lib/bannerGeneration";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

const STEP_MS = 8000;
const STEP_PCTS = [0, 20, 40, 60, 80, 90];
const STEP_LIST = Object.values(GenerationSteps);

function useSteppedProgress({ done = false } = {}) {
  const [pct, setPct] = useState(STEP_PCTS[0]);

  useEffect(() => {
    if (done) {
      const id = setInterval(() => {
        setPct((p) => {
          if (p >= 100) {
            clearInterval(id);
            return 100;
          }
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
  error = null,
  onCancel = null,
}) {
  const [elapsed, setElapsed] = useState(0);
  const pct = useSteppedProgress({ done });

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(tick);
  }, []);

  const display = Math.min(100, Math.max(0, Math.round(pct)));
  const completedSet = useMemo(
    () => new Set((stepsCompleted || []).map((step) => step?.step || step?.name || step?.id)),
    [stepsCompleted],
  );

  const completedCount = done
    ? STEP_LIST.length
    : STEP_LIST.filter((step) => completedSet.has(step.name) && currentStep?.name !== step.name).length;

  const activeLabel = done ? "Banner ready" : currentStep?.label || "Preparing your banner";
  const statusPercent = done ? 100 : currentStep?.progress || display;

  return (
    <Card elevated className="overflow-hidden p-0">
      <div className="relative">
        <div className={`${aspectClass(aspect)} skeleton relative w-full overflow-hidden bg-surface-2`}>
          <motion.div
            className="absolute inset-0"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklab, var(--foreground) 10%, transparent), transparent)",
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

        {error && (
          <div className="border-t border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-red-600">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-800">Generation failed</p>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="shrink-0 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-border bg-surface-2 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="inline-flex items-center gap-2 text-xs text-muted">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  {done ? "Complete!" : activeLabel}
                </div>
                <div className="font-mono text-sm font-semibold tracking-tight text-foreground">
                  {statusPercent}%
                </div>
                <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                    style={{ width: `${statusPercent}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-strong">
                {elapsed}s
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STEP_LIST.map((step) => {
                const isActive = !done && currentStep?.name === step.name;
                const isComplete = done || (completedSet.has(step.name) && !isActive);

                return (
                  <div
                    key={step.name}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                      isComplete
                        ? "border-emerald-500/20 bg-emerald-500/8"
                        : isActive
                        ? "border-primary/25 bg-primary/8"
                        : "border-border bg-background/40"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        isComplete
                          ? "border-emerald-500/25 bg-emerald-500 text-white"
                          : isActive
                          ? "border-primary/25 bg-primary text-white"
                          : "border-border bg-surface-2 text-muted"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isActive ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-strong">
                          Step {step.id}
                        </span>
                        <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                          {isComplete ? "Done" : isActive ? "Now" : "Next"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium leading-5 text-foreground">
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
