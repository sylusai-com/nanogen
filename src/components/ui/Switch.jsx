"use client";

import { cn } from "@/lib/cn";

export default function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  size = "md",
  className,
}) {
  const dims = size === "sm"
    ? { track: "h-4 w-7", thumb: "h-3 w-3", on: "translate-x-3", off: "translate-x-0.5" }
    : { track: "h-5 w-9", thumb: "h-3.5 w-3.5", on: "translate-x-[18px]", off: "translate-x-0.5" };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors",
        dims.track,
        checked ? "bg-primary" : "bg-surface-2",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block transform rounded-full bg-white shadow transition-transform",
          dims.thumb,
          checked ? dims.on : dims.off,
        )}
      />
    </button>
  );
}
