"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

export default function CTA() {
  return (
    <section className="relative py-20 md:py-28">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-[#0a0a0b]/60 p-10 backdrop-blur-3xl md:p-16 shadow-[0_0_80px_color-mix(in_oklab,var(--primary)_10%,transparent)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_15%,transparent)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-grid pointer-events-none opacity-40" />

          <div className="relative mx-auto max-w-2xl text-center z-10">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-[44px] md:leading-[1.05]">
              Ready to make your <span className="text-primary-gradient drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]">first banner?</span>
            </h2>
            <p className="mt-4 text-white/70">
              No setup, no credit card. Generate, score, ship — in under a minute.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                href="/generate"
                size="lg"
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
                className="shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_40%,transparent)]"
              >
                Start generating
              </Button>
              <Button href="#features" size="lg" variant="secondary" className="border-white/10 hover:bg-white/5 text-white">
                Explore features
              </Button>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
