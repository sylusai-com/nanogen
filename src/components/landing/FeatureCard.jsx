"use client";

import { motion } from "motion/react";
import IconBox from "@/components/ui/IconBox";

export default function FeatureCard({ icon, title, body, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="h-full"
    >
      <div className="group relative h-full rounded-2xl border border-white/10 bg-[#0a0a0b]/80 p-6 backdrop-blur-xl transition-all duration-300 hover:border-primary/50 hover:bg-[#131316] hover:shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_20%,transparent)]">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative z-10">
          <IconBox>{icon}</IconBox>
          <h3 className="mt-5 text-base font-semibold tracking-tight text-white group-hover:text-primary-gradient transition-all">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
        </div>
      </div>
    </motion.div>
  );
}
