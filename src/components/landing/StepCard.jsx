"use client";

import { motion } from "motion/react";

export default function StepCard({ index, total, title, body, delay = 0 }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative rounded-2xl surface-card p-6"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted">
          {String(index).padStart(2, "0")}
        </span>
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className="font-mono text-[10px] text-muted">
          {String(index)} / {String(total)}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </motion.li>
  );
}
