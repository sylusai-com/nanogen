"use client";

import { motion } from "motion/react";
import Section from "@/components/ui/Section";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Jane Doe",
    role: "Lead Engineer, Acme Corp",
    content: "Nanogen completely transformed our ad generation pipeline. We replaced 3 different tools with a single API call. The automatic scoring saves us hours of manual QA.",
  },
  {
    name: "John Smith",
    role: "Product Manager, TechNova",
    content: "The latency is incredible. We generate placeholder product shots on the fly in our staging environments, and it never bottlenecks our CI/CD pipeline.",
  },
  {
    name: "Alice Johnson",
    role: "CTO, Globex",
    content: "Switching between models like Flux and SDXL by just changing a single parameter in the JSON payload is pure magic. It's the Stripe for image generation.",
  },
];

function StarRating() {
  return (
    <div className="flex items-center gap-0.5 text-amber-400 mb-4">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-current" />
      ))}
    </div>
  );
}

export default function Showcase() {
  return (
    <Section
      id="testimonials"
      eyebrow="Wall of love"
      title="Trusted by forward-thinking teams"
      description="See how developers and product teams are using Nanogen to build the next generation of creative tools."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <Card elevated className="flex h-full flex-col p-6 transition-all hover:border-primary/30 hover:ring-1 hover:ring-primary/20">
              <StarRating />
              <p className="flex-1 text-sm leading-relaxed text-muted">
                &quot;{t.content}&quot;
              </p>
              <div className="mt-8 flex items-center gap-3 border-t border-border/50 pt-4">
                <Avatar name={t.name} size={36} />
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
                  <div className="text-[11px] text-muted-strong">{t.role}</div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
