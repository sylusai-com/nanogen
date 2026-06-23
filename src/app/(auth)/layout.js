import Link from "next/link";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AuthShowcase from "@/components/auth/AuthShowcase";

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <AuthShowcase />

      <div className="relative flex w-full lg:w-1/2 flex-col bg-background">
        {/* Subtle background for the form side */}
        <div className="absolute inset-0 bg-grid pointer-events-none opacity-[0.15]" />

        <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8 lg:px-12">
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

        <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12 lg:px-12">
          <div className="w-full max-w-md">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
