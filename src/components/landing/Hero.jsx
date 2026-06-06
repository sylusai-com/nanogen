"use client";

import { motion } from "motion/react";
import { ArrowRight, PlayCircle } from "lucide-react";
import Container from "@/components/ui/Container";
import Eyebrow from "@/components/ui/Eyebrow";
import Button from "@/components/ui/Button";
// import HeroPreview from "./HeroPreview";

const titleVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: 0.05 * i, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
};

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-ambient pointer-events-none" />
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-60" />

      <Container className="relative pt-20 pb-12 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Eyebrow tone="primary">Multi-model generation + Developer API</Eyebrow>
          </motion.div>

          <h1 className="mt-7 text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[64px]">
            <motion.span
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              custom={0}
              className="block text-gradient"
            >
              AI banners that
            </motion.span>
            <motion.span
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              custom={1}
              className="block text-primary-gradient"
            >
              just look right.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg"
          >
            Describe what you want. Nanogen runs multiple image models in parallel,
            scores every output for visual quality, and returns the best one — in seconds.
            Now available as a REST API for your apps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button
              href="/generate"
              size="lg"
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
            >
              Generate a banner
            </Button>
            <Button
              href="#how-it-works"
              size="lg"
              variant="secondary"
              leftIcon={<PlayCircle className="h-4 w-4" />}
            >
              See how it works
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-6 text-xs text-muted"
          >
            No credit card · Free during beta
          </motion.p>
        </div>

        {/* <HeroPreview /> */}
      </Container>
    </section>
  );
}
