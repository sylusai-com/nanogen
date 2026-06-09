"use client";

import { motion } from "motion/react";
import IconBox from "@/components/ui/IconBox";

export default function FeatureCard({ icon, title, body, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="h-full"
    >
      <div className="group relative h-full rounded-3xl border border-slate-200 dark:border-white/5 bg-gradient-to-b from-slate-50/90 dark:from-[#0a0a0b]/90 to-slate-50/60 dark:to-[#0a0a0b]/60 p-8 backdrop-blur-2xl transition-all duration-300 hover:border-primary/50 dark:hover:border-primary/50 hover:-translate-y-1 hover:shadow-[0_20px_50px_color-mix(in_oklab,var(--primary)_20%,transparent)]">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 mix-blend-multiply dark:mix-blend-screen pointer-events-none" />
        
        <div className="relative z-10">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/50 dark:bg-white/5 ring-1 ring-slate-300/50 dark:ring-white/10 group-hover:ring-primary/50 group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_var(--primary)] transition-all">
            {icon}
          </div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors">{title}</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-white/60">{body}</p>
        </div>
      </div>
    </motion.div>
  );
}
