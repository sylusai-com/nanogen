"use client";

import { motion } from "motion/react";

export default function StepCard({ index, total, title, body, delay = 0 }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative rounded-3xl border border-slate-200/80 dark:border-white/[0.06] bg-gradient-to-b from-slate-50/60 dark:from-white/[0.015] to-white/40 dark:to-transparent p-8 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 dark:hover:border-primary/30 hover:shadow-[0_16px_48px_-12px_color-mix(in_oklab,var(--primary)_18%,transparent)] group"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100 rounded-3xl pointer-events-none" />

      {/* Step header */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 group-hover:bg-primary/10 group-hover:border-primary/40 group-hover:shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)] transition-all duration-300">
          <span className="font-mono text-sm font-bold text-primary-700 dark:text-primary-300">
            {String(index).padStart(2, "0")}
          </span>
        </div>

        {/* Connector line */}
        <span className="h-px flex-1 bg-gradient-to-r from-primary/25 to-transparent group-hover:from-primary/50 transition-all duration-300" />

        {/* Step indicator */}
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted/40 group-hover:text-muted/60 transition-colors">
          Step {index}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <h3 className="mt-7 text-lg font-semibold tracking-tight text-slate-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-300">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-white/50">
          {body}
        </p>
      </div>
    </motion.li>
  );
}
