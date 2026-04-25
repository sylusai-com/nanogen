"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export default function Tabs({ tabs, value, onChange, className, size = "md" }) {
  const sizeCls = size === "sm" ? "h-8 text-xs" : "h-9 text-sm";
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-surface p-1",
        className,
      )}
    >
      {tabs.map((t) => {
        const id = typeof t === "string" ? t : t.id;
        const label = typeof t === "string" ? t : t.label;
        const active = value === id;
        return (
          <button
            type="button"
            role="tab"
            key={id}
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full px-3 transition-colors",
              sizeCls,
              active ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-surface-2 ring-1 ring-border"
                transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
