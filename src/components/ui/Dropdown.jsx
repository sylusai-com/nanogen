"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export default function Dropdown({
  trigger,
  align = "end",
  width = 220,
  children,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState("bottom");
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggleOpen = (e) => {
    if (open) {
      setOpen(false);
      return;
    }
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If there is less than ~200px of space below the trigger, open upwards.
      setPosition(spaceBelow < 200 ? "top" : "bottom");
    }
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className={cn("relative inline-block", className)}>
      <span onClick={toggleOpen}>{trigger}</span>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: position === "top" ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: position === "top" ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ width }}
            className={cn(
              "absolute z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/30 backdrop-blur-xl",
              align === "end" ? "right-0" : "left-0",
              position === "top" ? "bottom-full mb-2" : "top-full mt-2"
            )}
            onClick={() => setOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownItem({ children, className, onClick, danger = false, leftIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-foreground hover:bg-surface-2",
        className,
      )}
    >
      {leftIcon && <span className="shrink-0 text-muted">{leftIcon}</span>}
      {children}
    </button>
  );
}

export function DropdownSection({ children, label }) {
  return (
    <div className="border-t border-border first:border-t-0 py-1">
      {label && (
        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
