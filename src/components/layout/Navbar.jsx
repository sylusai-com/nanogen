"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import Button from "@/components/ui/Button";

const links = [
  { href: "/generate", label: "Generate" },
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "Workflow" },
  { href: "/#showcase", label: "Showcase" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-200",
        scrolled
          ? "border-b border-border bg-[color-mix(in_oklab,var(--background)_72%,transparent)] backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        <Logo />

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active =
              l.href === pathname ||
              (l.href.startsWith("/#") && pathname === "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition-colors",
                  active && l.href === pathname
                    ? "text-foreground bg-surface"
                    : "text-muted hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            href="/generate"
            size="md"
            className="hidden sm:inline-flex"
            rightIcon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
          >
            Start generating
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-strong"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-muted-strong hover:bg-surface"
              >
                {l.label}
              </Link>
            ))}
            <Button href="/generate" size="md" className="mt-2 w-full">
              Start generating
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
