import { cn } from "@/lib/cn";

export default function AuthCard({ title, subtitle, children, footer, className }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-base text-muted">{subtitle}</p>}
      </div>
      <div className="mt-8">{children}</div>
      {footer && (
        <p className="mt-8 text-sm text-muted">{footer}</p>
      )}
    </div>
  );
}
