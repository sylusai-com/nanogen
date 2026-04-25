"use client";

import { motion } from "motion/react";
import Card from "@/components/ui/Card";
import IconBox from "@/components/ui/IconBox";

export default function FeatureCard({ icon, title, body, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      <Card interactive className="group p-6 h-full">
        <IconBox>{icon}</IconBox>
        <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
      </Card>
    </motion.div>
  );
}
