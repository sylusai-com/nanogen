"use client";

import { motion } from "motion/react";
import Section from "@/components/ui/Section";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Marketing Director, Launchpad",
    content:
      "We used to spend 2–3 hours per campaign banner with our design team. Now I write a prompt, pick a model, and have a polished hero banner in under a minute. Nanogen has completely transformed our creative workflow.",
    highlight: true,
  },
  {
    name: "Raj Patel",
    role: "Founder & CEO, PixelForge",
    content:
      "As a bootstrapped startup, we couldn't afford a full-time designer. Nanogen lets us produce professional-quality banners for product launches, social ads, and landing pages — all from a single prompt.",
  },
  {
    name: "Emily Torres",
    role: "Growth Engineer, ScaleKit",
    content:
      "We integrated the Nanogen API into our marketing automation pipeline. Being able to switch between SDXL, Flux, and Imagen with a single parameter gives us creative variety without any extra tooling.",
  },
  {
    name: "David Kim",
    role: "E-commerce Manager, NovaMart",
    content:
      "Generating product banners at scale was our biggest bottleneck. Nanogen's quality scoring ensures every banner meets our brand standards before it goes live. We ship 10× more creatives now.",
  },
  {
    name: "Maria Santos",
    role: "Creative Director, BrightWave",
    content:
      "The automatic quality scoring is a game-changer. Instead of reviewing dozens of options manually, Nanogen surfaces only the best outputs. Our banner consistency has never been better.",
  },
  {
    name: "Alex Rivera",
    role: "Developer Advocate, BuildStack",
    content:
      "The REST API is beautifully simple — one endpoint, pick your model, get a scored banner back. We built a Slack bot that generates campaign banners on demand. Our marketing team loves it.",
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
      id="showcase"
      eyebrow="Wall of love"
      title="Trusted by forward-thinking teams"
      description="See how marketers, founders, and developers are using Nanogen to create stunning banners and streamline their creative workflows."
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.5,
              delay: i * 0.08,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
          >
            <Card
              elevated
              className={`flex h-full flex-col p-6 transition-all duration-300 hover:border-primary/30 hover:ring-1 hover:ring-primary/20 hover:-translate-y-1 ${
                t.highlight
                  ? "ring-1 ring-primary/20 border-primary/30 bg-[color-mix(in_oklab,var(--primary)_3%,var(--surface))]"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <StarRating />
                <Quote className="h-5 w-5 text-primary/20 rotate-180 shrink-0" />
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted">
                &quot;{t.content}&quot;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-border/50 pt-4">
                <Avatar name={t.name} size={36} />
                <div>
                  <div className="text-[13px] font-semibold text-foreground">
                    {t.name}
                  </div>
                  <div className="text-[11px] text-muted-strong">
                    {t.role}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
