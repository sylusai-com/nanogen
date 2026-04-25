"use client";

import { motion } from "motion/react";
import Section from "@/components/ui/Section";
import Badge from "@/components/ui/Badge";

const items = [
  {
    title: "Cyberpunk SaaS launch",
    score: 94,
    style: "Cyberpunk",
    aspect: "16:9",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #082f49 100%)",
    glow: "from-violet-400/30 via-fuchsia-400/20 to-cyan-300/20",
  },
  {
    title: "Editorial fintech hero",
    score: 91,
    style: "Editorial",
    aspect: "16:9",
    gradient: "linear-gradient(135deg, #0c1a3a 0%, #1e293b 50%, #082f49 100%)",
    glow: "from-amber-300/20 via-rose-300/10 to-cyan-300/20",
  },
  {
    title: "Playful sale promo",
    score: 87,
    style: "Playful",
    aspect: "1:1",
    gradient: "linear-gradient(135deg, #831843 0%, #be185d 50%, #f59e0b 100%)",
    glow: "from-pink-300/30 via-amber-300/20 to-rose-300/20",
  },
  {
    title: "Minimal product reveal",
    score: 89,
    style: "Minimal",
    aspect: "4:5",
    gradient: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)",
    glow: "from-zinc-200/20 via-zinc-300/10 to-violet-300/20",
  },
];

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  return "aspect-[16/9]";
}

export default function Showcase() {
  return (
    <Section
      id="showcase"
      eyebrow="Selected outputs"
      title="A look at what comes out"
      description="A few real examples from the pipeline — winning outputs picked automatically."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="group relative overflow-hidden rounded-2xl surface-card"
          >
            <div className="relative">
              <div className={aspectClass(it.aspect)} style={{ background: it.gradient }} />
              <div className={`absolute inset-0 bg-gradient-to-br ${it.glow} opacity-70`} />
              <div className="absolute left-3 top-3">
                <Badge tone="primary" dot>
                  {it.style}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-3 py-2 text-xs">
              <span className="truncate text-foreground">{it.title}</span>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
                {it.score}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
