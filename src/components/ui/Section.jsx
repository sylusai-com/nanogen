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
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <section id={id} className={cn("relative py-20 md:py-28", className)}>
      <Container size={containerSize}>
        {(eyebrow || title || description) && (
          <header className={cn("max-w-2xl mb-12 md:mb-16", alignCls)}>
            {eyebrow && (
              <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
                <span className="h-px w-6 bg-[var(--border-strong)]" />
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.1]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-4 text-base leading-relaxed text-muted">
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
