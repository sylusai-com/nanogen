"use client";

import { motion } from "motion/react";

export default function StepCard({ index, total, title, body, delay = 0 }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative rounded-3xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] p-8 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-2 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)] dark:hover:shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_30%,transparent)] group"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-3xl pointer-events-none" />
      <div className="flex items-center gap-4">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 group-hover:shadow-[0_0_15px_var(--primary)] transition-all">
          <span className="font-mono text-xs font-bold text-primary-700 dark:text-primary-300">
            {String(index).padStart(2, "0")}
          </span>
        </div>
        <span className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent group-hover:from-primary/60 transition-all" />
      </div>
      <h3 className="mt-8 text-xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-white/60">{body}</p>
    </motion.li>
  );
}
