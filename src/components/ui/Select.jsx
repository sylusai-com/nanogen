"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

// Native <select> styled to match the rest of the design system. Native is
// the right call here — accessibility, mobile pickers, and form integration
// all come for free.
const Select = forwardRef(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-border bg-background px-3.5 pr-9 text-sm text-foreground outline-none transition-shadow focus:border-border-strong focus:ring-2 focus:ring-ring",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
});

export default Select;
