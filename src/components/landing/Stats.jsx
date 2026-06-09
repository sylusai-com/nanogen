"use client";

import { motion } from "motion/react";
import Container from "@/components/ui/Container";

const stats = [
  { value: "4×", label: "Models per prompt" },
  { value: "≥ 80", label: "Quality threshold" },
  { value: "~55s", label: "Median time to result" },
  { value: "100%", label: "Auto-evaluated outputs" },
];

export default function Stats() {
  return (
    <section className="relative py-12 md:py-16">
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
              className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] p-8 text-center backdrop-blur-3xl transition-transform hover:-translate-y-1 hover:border-primary/30 dark:hover:border-primary/30 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] shadow-md dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
            >
              <div className="absolute -inset-1 bg-gradient-to-b from-black/5 dark:from-white/5 to-transparent opacity-0 transition-opacity hover:opacity-100 pointer-events-none" />
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-5xl drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                {s.value}
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50 font-medium">
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
