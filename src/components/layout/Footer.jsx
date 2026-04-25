import Logo from "./Logo";
import Container from "@/components/ui/Container";

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.04c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.17.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.48 3.16-1.17 3.16-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.78 1.05.78 2.12v3.14c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function TwitterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.84l-5.36-6.97L4.6 22H1.34l8.02-9.16L1 2h6.92l4.85 6.4L18.24 2zm-1.2 18h1.86L7.05 4H5.07l11.97 16z" />
    </svg>
  );
}

const sections = [
  {
    title: "Product",
    links: [
      { label: "Generate", href: "/generate" },
      { label: "Features", href: "/#features" },
      { label: "Workflow", href: "/#how-it-works" },
      { label: "Showcase", href: "/#showcase" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Roadmap", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              AI banner generation evaluated and selected automatically. Built for
              marketers, founders, and design-curious teams.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="#"
                aria-label="GitHub"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-strong hover:text-foreground hover:border-border-strong transition-colors"
              >
                <GithubIcon className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="Twitter"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-strong hover:text-foreground hover:border-border-strong transition-colors"
              >
                <TwitterIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {sections.map((s) => (
            <div key={s.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {s.title}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {s.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-muted-strong hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} Nanogen. All rights reserved.</span>
          <span>Crafted with attention to detail.</span>
        </div>
      </Container>
    </footer>
  );
}
