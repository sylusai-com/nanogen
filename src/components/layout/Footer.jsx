"use client";

import Link from "next/link";
import Logo from "./Logo";
import Container from "@/components/ui/Container";
import { ArrowUpRight, ChevronUp } from "lucide-react";

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.04c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.17.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.48 3.16-1.17 3.16-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.78 1.05.78 2.12v3.14c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.84l-5.36-6.97L4.6 22H1.34l8.02-9.16L1 2h6.92l4.85 6.4L18.24 2zm-1.2 18h1.86L7.05 4H5.07l11.97 16z" />
    </svg>
  );
}

function LinkedInIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const sections = [
  {
    title: "Product",
    links: [
      { label: "Generate", href: "/generate" },
      { label: "Features", href: "/#features" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "API", href: "/#api" },
      { label: "Pricing", href: "/#api-pricing" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API Documentation", href: "/dashboard/api" },
      { label: "API Keys", href: "/dashboard/api" },
      { label: "Status", href: "/#api", badge: "Live" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Showcase", href: "/#showcase" },
      { label: "Changelog", href: "/#features", soon: true },
      { label: "Privacy Policy", href: "/#", soon: true },
      { label: "Terms of Service", href: "/#", soon: true },
    ],
  },
];

const socialLinks = [
  { label: "GitHub", icon: GithubIcon, href: "https://github.com" },
  { label: "X", icon: XIcon, href: "https://x.com" },
  { label: "LinkedIn", icon: LinkedInIcon, href: "https://linkedin.com" },
];

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative mt-0">
      {/* Gradient separator */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_6%,transparent),transparent_70%)]" />
      </div>

      <Container className="relative z-10 pt-16 pb-8">
        {/* Main grid */}
        <div className="grid gap-12 md:gap-8 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          {/* Brand column */}
          <div className="max-w-xs">
            <Logo />
            <p className="mt-5 text-sm leading-relaxed text-muted">
              AI-powered banner generation with automatic quality scoring.
              Create stunning marketing visuals in seconds.
            </p>

            {/* Status badge */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-medium text-emerald-500 dark:text-emerald-400 tracking-wide">
                All systems operational
              </span>
            </div>

            {/* Social icons */}
            <div className="mt-6 flex items-center gap-2">
              {socialLinks.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted-strong transition-all duration-200 hover:text-foreground hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
                  >
                    <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {sections.map((s) => (
            <div key={s.title}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/80 mb-5">
                {s.title}
              </h3>
              <ul className="space-y-3">
                {s.links.map((l) => (
                  <li key={l.label}>
                    {l.soon ? (
                      <span className="group inline-flex items-center gap-2 text-sm text-muted/60 cursor-not-allowed">
                        {l.label}
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">
                          Soon
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={l.href}
                        className="group inline-flex items-center gap-1.5 text-sm text-muted-strong transition-colors duration-200 hover:text-foreground"
                      >
                        <span className="relative">
                          {l.label}
                          <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-primary/60 transition-all duration-300 group-hover:w-full" />
                        </span>
                        {l.badge && (
                          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">
                            {l.badge}
                          </span>
                        )}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-14 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col items-start justify-between gap-4 text-xs text-muted md:flex-row md:items-center">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span>© {new Date().getFullYear()} Nanogen. All rights reserved.</span>
            <span className="hidden sm:inline text-border-strong">·</span>
            <span className="text-muted/60">AI Banner Generation Platform</span>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="group inline-flex items-center gap-1.5 text-xs text-muted-strong transition-colors duration-200 hover:text-primary"
          >
            Back to top
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border bg-surface transition-all duration-200 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:-translate-y-0.5">
              <ChevronUp className="h-3 w-3" />
            </span>
          </button>
        </div>
      </Container>
    </footer>
  );
}
