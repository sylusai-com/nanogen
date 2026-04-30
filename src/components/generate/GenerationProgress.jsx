// src/components/generate/GenerationProgress.jsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";

// A polished loading screen for the banner studio. Shows the user that
// work is happening across multiple stages, even though the API is a
// single request — without it, a 20-60s wait feels like the page is hung.
//
// We advance through visible stages on a timed schedule that matches the
// rough latency of the real pipeline (3 variants in parallel, scoring per
// variant, persistence). The actual API call resolves whenever it
// resolves; this component just keeps the UI alive in the meantime.

const STAGES = [
  { id: "compose",   label: "Composing your brief",            hint: "Picking the right archetype, palette, and copy direction.",      minMs: 800 },
  { id: "fanout",    label: "Fanning out across enabled models", hint: "Calling every admin-enabled text model in parallel.",          minMs: 8000 },
  { id: "score",     label: "Scoring every variant",            hint: "Each banner is rated on relevance, composition, polish.",       minMs: 4000 },
  { id: "select",    label: "Selecting the winner",             hint: "Top scorer ≥ 80 — or the absolute top if none reach threshold.", minMs: 1500 },
  { id: "save",      label: "Saving to your library",           hint: "Persisting the winning variant and dropping you into the editor.", minMs: 1000 },
];

function aspectClass(a) {
  if (a === "1:1")  return "aspect-square";
  if (a === "4:5")  return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

export default function GenerationProgress({ aspect = "16:9" }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed]   = useState(0);

  useEffect(() => {
    const start = Date.now();
    let acc = 0;
    const timers = [];

    for (let i = 0; i < STAGES.length - 1; i++) {
      acc += STAGES[i].minMs;
      timers.push(setTimeout(() => setStageIdx(i + 1), acc));
    }
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 250);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card elevated className="overflow-hidden p-0">
        <div className="relative">
          {/* Skeleton banner preview with shimmer */}
          <div className={`${aspectClass(aspect)} relative w-full overflow-hidden bg-surface-2`}>
            <motion.div
              className="absolute inset-0"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in oklab, var(--foreground) 8%, transparent), transparent)",
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

          <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-3 text-xs text-muted">
            <div className="inline-flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {STAGES[stageIdx]?.label}…
            </div>
            <span className="font-mono text-[10px] text-muted-strong">{elapsed}s</span>
          </div>
        </div>
      </Card>

      <Card elevated className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight">Generating your banner</h3>
        </div>
        <ol className="space-y-3">
          {STAGES.map((s, i) => {
            const done    = i < stageIdx;
            const active  = i === stageIdx;
            return (
              <li key={s.id} className="flex items-start gap-3">
                <span
                  className={[
                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors",
                    done
                      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
                      : active
                      ? "bg-primary/15 text-primary ring-primary/30"
                      : "bg-surface-2 text-muted ring-border",
                  ].join(" ")}
                >
                  {done ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                  )}
                </span>
                <div className="min-w-0">
                  <div
                    className={[
                      "text-sm",
                      done || active ? "text-foreground" : "text-muted",
                    ].join(" ")}
                  >
                    {s.label}
                  </div>
                  {(active || done) && (
                    <div className="text-[11px] text-muted">{s.hint}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted">
          This usually takes 10–30 seconds depending on the model.
        </p>
      </Card>
    </div>
  );
}
