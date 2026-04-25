"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary:
    "bg-primary text-primary-fg hover:brightness-110 active:brightness-95 shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--primary)_70%,transparent)]",
  secondary:
    "bg-surface text-foreground border border-border hover:border-border-strong hover:bg-surface-2",
  ghost:
    "bg-transparent text-foreground hover:bg-surface",
  outline:
    "bg-transparent text-foreground border border-border-strong hover:bg-surface",
};

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

const Button = forwardRef(function Button(
  {
    as,
    href,
    variant = "primary",
    size = "md",
    className,
    children,
    leftIcon,
    rightIcon,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 select-none whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

  const content = (
    <>
      {leftIcon && <span className="flex shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex shrink-0">{rightIcon}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} ref={ref} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  const Comp = as || "button";
  return (
    <Comp ref={ref} type={Comp === "button" ? type : undefined} className={classes} {...props}>
      {content}
    </Comp>
  );
});

export default Button;
