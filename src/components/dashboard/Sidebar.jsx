"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import Logo from "@/components/layout/Logo";

export default function Sidebar({ sections, footer, className }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface/40",
        className,
      )}
    >
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

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

      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </aside>
  );
}
