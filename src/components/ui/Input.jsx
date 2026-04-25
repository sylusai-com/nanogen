"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const baseField =
  "w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted outline-none transition-shadow focus:border-border-strong focus:ring-2 focus:ring-ring";

export const Input = forwardRef(function Input(
  { className, type = "text", leftIcon, rightSlot, ...props },
  ref,
) {
  if (leftIcon || rightSlot) {
    return (
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(baseField, "h-10", leftIcon && "pl-10", rightSlot && "pr-10", className)}
          {...props}
        />
        {rightSlot && (
          <span className="absolute inset-y-0 right-2 flex items-center">{rightSlot}</span>
        )}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      type={type}
      className={cn(baseField, "h-10", className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(baseField, "py-3 leading-relaxed resize-none", className)}
      {...props}
    />
  );
});

export const Label = ({ children, className, htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className={cn("text-xs font-medium uppercase tracking-[0.1em] text-muted", className)}
  >
    {children}
  </label>
);
