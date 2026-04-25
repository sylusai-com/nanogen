"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import Card from "@/components/ui/Card";

export default function StatCard({ label, value, delta, positive = true, icon, sub, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      <Card elevated className="p-5">
        <div className="flex items-start justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            {label}
          </div>
          {icon && (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary">
              {icon}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="text-2xl font-semibold tracking-tight md:text-3xl">{value}</div>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                positive ? "text-emerald-400" : "text-red-400",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
              ) : (
                <ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />
              )}
              {delta}
            </span>
          )}
        </div>
        {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
      </Card>
    </motion.div>
  );
}
