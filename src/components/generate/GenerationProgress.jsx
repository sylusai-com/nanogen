// src/components/generate/GenerationProgress.jsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Card from "@/components/ui/Card";

// Lightweight loading screen for the banner studio. The internal pipeline
// (multi-model fan-out, scoring, persistence, etc.) is intentionally
// hidden from the user — they see a clean "we're working on it" view
// and a chunky stepped progress bar paired with a skeleton banner.

function aspectClass(a) {
  if (a === "1:1")  return "aspect-square";
  if (a === "4:5")  return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

// Discrete +20% jumps every 8s, totalling 40s to reach 90%. We never
// interpolate between steps — the user sees the bar pop forward in
// confident chunks instead of crawling. When `done` flips true (the API
// has returned), we sprint the remaining 10% to 100.
//
//   t = 0s   → 0%
//   t = 8s   → 20%
//   t = 16s  → 40%
//   t = 24s  → 60%
//   t = 32s  → 80%
//   t = 40s  → 90%   (hold)
//   on done  → 100%
const STEP_MS = 8000;
const STEP_PCTS = [0, 20, 40, 60, 80, 90];

function useSteppedProgress({ done = false } = {}) {
  const [pct, setPct] = useState(STEP_PCTS[0]);

  useEffect(() => {
    if (done) {
      // Sprint to 100. ~30ms × 5 = 150ms is fast enough that the user
      // perceives the redirect as instant but still sees the fill.
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
      const stepIdx = Math.min(
        STEP_PCTS.length - 1,
        Math.floor(elapsed / STEP_MS),
      );
      const target = STEP_PCTS[stepIdx];
      setPct((p) => (p < target ? target : p));
    }, 200);
    return () => clearInterval(id);
  }, [done]);

  return pct;
}

export default function GenerationProgress({ aspect = "16:9", done = false }) {
  const [elapsed, setElapsed] = useState(0);
  const pct = useSteppedProgress({ done });

  useEffect(() => {
    const start = Date.now();
    const tick  = setInterval(
      () => setElapsed(Math.round((Date.now() - start) / 1000)),
      250,
    );
    return () => clearInterval(tick);
  }, []);

  const display = Math.min(100, Math.max(0, Math.round(pct)));

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

        {/* Status strip — "Generating your banner…" with the live
            percentage + progress bar stacked directly underneath, so the
            user can read both states from a single visual region instead
            of glancing between cards. */}
        <div className="flex items-start justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-xs text-muted">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {done ? "Almost there…" : "Generating your banner…"}
            </div>
            <div className="font-mono text-sm font-semibold tracking-tight text-foreground">
              {display}%
            </div>
            <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-foreground/8">
              {/* duration-700 makes the +20 jump readable without feeling sluggish */}
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: `${display}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-muted-strong">
            {elapsed}s
          </span>
        </div>
      </div>
    </Card>
  );
}
