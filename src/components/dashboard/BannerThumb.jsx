"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function BannerThumb({ banner, href, index = 0 }) {
  const link = href || `/dashboard/banners/${banner.id}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      <Link
        href={link}
        className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:border-border-strong hover:-translate-y-0.5"
      >
        <div className={cn(aspectClass(banner.aspect), "relative")} style={{ background: banner.gradient }}>
          {banner.favourite && (
            <span className="absolute left-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-amber-300 backdrop-blur">
              <Star className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
            </span>
          )}
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur">
            <span className={cn("h-1.5 w-1.5 rounded-full", banner.score >= 80 ? "bg-emerald-400" : "bg-amber-400")} />
            {banner.score}
          </span>
        </div>
        <div className="space-y-0.5 border-t border-border bg-surface-2 px-3 py-2.5">
          <div className="truncate text-sm text-foreground">{banner.title}</div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="truncate">{banner.modelLabel} · {banner.style}</span>
            <span>{fmtDate(banner.createdAt)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
