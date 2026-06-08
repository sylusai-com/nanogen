// src/components/dashboard/Sidebar.jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import Logo from "@/components/layout/Logo";

export default function Sidebar({ sections, footer, className }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on route change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  const renderNav = () => (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-thin">
      {sections.map((section) => (
        <div key={section.title}>
          {section.title && (
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {section.title}
            </div>
          )}
          <ul className="space-y-0.5">
            {section.items.map((it) => {
              const active =
                it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-surface-2 text-foreground"
                        : "text-muted hover:bg-surface hover:text-foreground",
                    )}
                  >
                    {it.icon && (
                      <span
                        className={cn(
                          "shrink-0",
                          active ? "text-primary" : "text-muted group-hover:text-foreground",
                        )}
                      >
                        {it.icon}
                      </span>
                    )}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.badge && (
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {it.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/40 md:sticky md:top-0",
          className,
        )}
      >
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        {renderNav()}
        {footer && <div className="border-t border-border p-3">{footer}</div>}
      </aside>

      {/* Mobile menu trigger — fixed in the top-left so it never overlaps
          the page's TopBar action button on the right. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/90 text-muted-strong shadow-sm backdrop-blur md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="relative flex h-dvh w-72 max-w-[85vw] flex-col border-r border-border bg-background shadow-xl">
            <div className="flex h-16 items-center justify-between gap-2 px-5">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-strong"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNav()}
            {footer && <div className="border-t border-border p-3">{footer}</div>}
          </aside>
        </div>
      )}
    </>
  );
}
