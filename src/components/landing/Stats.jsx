"use client";

import { motion } from "motion/react";
import Container from "@/components/ui/Container";

const stats = [
  { value: "4+", label: "AI models available" },
  { value: "≥ 80", label: "Quality threshold" },
  { value: "~55s", label: "Median time to result" },
  { value: "100%", label: "Auto-evaluated outputs" },
];

export default function Stats() {
  return (
    <section className="relative py-8 md:py-12 -mt-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_5%,transparent)_0%,transparent_50%)] pointer-events-none" />
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] p-6 md:p-8 text-center backdrop-blur-3xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-[0_12px_36px_-8px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
            >
              <div className="absolute -inset-1 bg-gradient-to-b from-black/5 dark:from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-5xl">
                {s.value}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45 font-medium">
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
