import Link from "next/link";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";

export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-full flex flex-col">
      <div className="absolute inset-0 bg-ambient pointer-events-none" />
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-50" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-strong hover:border-border-strong hover:text-foreground transition-colors"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12">
        {children}
      </main>
    </div>
  );
}
