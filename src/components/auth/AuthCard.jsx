import { cn } from "@/lib/cn";
import Card from "@/components/ui/Card";

export default function AuthCard({ title, subtitle, children, footer, className }) {
  return (
    <div className={cn("w-full max-w-md", className)}>
      <Card elevated className="p-7 md:p-8">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="mt-7">{children}</div>
      </Card>
      {footer && (
        <p className="mt-5 text-center text-xs text-muted">{footer}</p>
      )}
    </div>
  );
}
