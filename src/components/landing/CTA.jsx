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
          className="relative overflow-hidden rounded-3xl border border-border bg-surface p-10 md:p-16"
        >
          <div className="absolute inset-0 bg-ambient opacity-90 pointer-events-none" />
          <div className="absolute inset-0 bg-grid pointer-events-none opacity-40" />

          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-[44px] md:leading-[1.05]">
              Ready to make your <span className="text-primary-gradient">first banner?</span>
            </h2>
            <p className="mt-4 text-muted">
              No setup, no credit card. Generate, score, ship — in under a minute.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                href="/generate"
                size="lg"
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
              >
                Start generating
              </Button>
              <Button href="#features" size="lg" variant="secondary">
                Explore features
              </Button>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
