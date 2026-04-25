"use client";

import { motion } from "motion/react";
import { Wand2, Sparkles, Layers } from "lucide-react";

const hints = [
  { icon: Wand2, label: "Write a prompt" },
  { icon: Layers, label: "Pick models" },
  { icon: Sparkles, label: "Get the winner" },
];

export default function EmptyState() {
  return (
    <div className="surface-card flex h-full min-h-[480px] flex-col items-center justify-center rounded-2xl p-10 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative"
      >
        <div className="absolute inset-0 -m-6 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_30%,transparent),transparent)] blur-2xl" />
        <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklab,var(--primary)_60%,#ec4899))] text-white shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
          <Sparkles className="h-6 w-6" strokeWidth={2} />
        </div>
      </motion.div>

      <h3 className="mt-6 text-lg font-semibold tracking-tight">
        Your banners will appear here
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Write a prompt on the left and pick the models you want to run.
        Nanogen will fan out your request and rank the results for you.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {hints.map((h) => (
          <span
            key={h.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-strong"
          >
            <h.icon className="h-3 w-3" />
            {h.label}
          </span>
        ))}
      </div>
    </div>
  );
}
