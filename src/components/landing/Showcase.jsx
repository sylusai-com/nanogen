"use client";

import { motion } from "motion/react";
import Section from "@/components/ui/Section";
import Badge from "@/components/ui/Badge";

const items = [
  {
    title: "Aurora launch hero",
    score: 96,
    style: "Launch",
    aspect: "16:9",
    gradient: "linear-gradient(135deg, #08111f 0%, #13365f 46%, #0f766e 100%)",
    glow: "from-cyan-300/30 via-sky-400/20 to-emerald-300/20",
  },
  {
    title: "Editorial product story",
    score: 93,
    style: "Editorial",
    aspect: "16:9",
    gradient: "linear-gradient(135deg, #0f172a 0%, #312e81 48%, #7c3aed 100%)",
    glow: "from-violet-300/20 via-fuchsia-300/10 to-cyan-300/20",
  },
  {
    title: "App store spotlight",
    score: 90,
    style: "Spotlight",
    aspect: "1:1",
    gradient: "linear-gradient(135deg, #3f1d6f 0%, #9f1239 50%, #f97316 100%)",
    glow: "from-pink-300/30 via-rose-300/20 to-amber-300/20",
  },
  {
    title: "Social campaign crop",
    score: 88,
    style: "Social",
    aspect: "4:5",
    gradient: "linear-gradient(135deg, #10172a 0%, #1f2937 48%, #334155 100%)",
    glow: "from-slate-200/20 via-zinc-300/10 to-cyan-300/20",
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
      title="A look at the modern banner outputs"
      description="A few recent examples from the pipeline — polished treatments picked automatically."
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
              <div className={`absolute inset-0 bg-linear-to-br ${it.glow} opacity-70`} />
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
