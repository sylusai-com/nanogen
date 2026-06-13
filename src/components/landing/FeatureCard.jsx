"use client";

import { motion } from "motion/react";

export default function FeatureCard({ icon, title, body, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="h-full"
    >
      <div className="group relative h-full rounded-3xl border border-slate-200/80 dark:border-white/[0.06] bg-gradient-to-b from-slate-50/80 dark:from-white/[0.02] to-white/60 dark:to-transparent p-8 backdrop-blur-2xl transition-all duration-300 hover:border-primary/40 dark:hover:border-primary/30 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-15px_color-mix(in_oklab,var(--primary)_18%,transparent)]">
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />

        <div className="relative z-10">
          {/* Icon container */}
          <div className="mb-7 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/80 dark:bg-white/[0.04] ring-1 ring-slate-200/80 dark:ring-white/[0.08] text-slate-700 dark:text-white/70 group-hover:ring-primary/40 group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_25%,transparent)] transition-all duration-300">
            {icon}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-300">
            {title}
          </h3>

          {/* Body */}
          <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-white/50">
            {body}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
