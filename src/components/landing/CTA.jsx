"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

export default function CTA() {
  return (
    <section className="relative py-24 md:py-32">
      <Container>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0b] p-12 md:p-20 shadow-[0_30px_100px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          <div className="relative mx-auto max-w-2xl text-center z-10">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[56px] md:leading-[1.05] drop-shadow-sm dark:drop-shadow-lg">
              Ready to make your <span className="text-primary-gradient drop-shadow-[0_0_20px_rgba(167,139,250,0.6)]">first banner?</span>
            </h2>
            <p className="mt-6 text-lg text-slate-600 dark:text-white/70 font-light">
              No setup, no credit card. Generate, score, ship — in under a minute.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                href="/generate"
                size="lg"
                rightIcon={<ArrowRight className="h-5 w-5" strokeWidth={2.5} />}
                className="h-14 px-8 text-base shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:shadow-[0_0_60px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-all"
              >
                Start generating
              </Button>
              <Button href="#features" size="lg" variant="secondary" className="h-14 px-8 text-base border-slate-300 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white backdrop-blur-md">
                Explore features
              </Button>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
