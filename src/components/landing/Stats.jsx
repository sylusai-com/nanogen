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
    <section className="relative">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-[var(--border)] md:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-background px-6 py-7 text-center"
            >
              <div className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {s.value}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
