import { cn } from "@/lib/cn";
import Container from "./Container";

export default function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  containerSize,
  align = "left",
  noDivider = false,
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <section id={id} className={cn("relative py-24 md:py-32", className)}>
      {/* Subtle top divider for visual separation between sections */}
      {!noDivider && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(100%,40rem)] h-px bg-gradient-to-r from-transparent via-border-strong/60 to-transparent" />
      )}

      <Container size={containerSize}>
        {(eyebrow || title || description) && (
          <header className={cn("max-w-2xl mb-14 md:mb-20", alignCls)}>
            {eyebrow && (
              <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
                <span className="h-px w-6 bg-[var(--border-strong)]" />
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.1]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">
                {description}
              </p>
            )}
          </header>
        )}
        {children}
      </Container>
    </section>
  );
}
