"use client";

import { motion } from "motion/react";
import { ArrowRight, PlayCircle } from "lucide-react";
import Container from "@/components/ui/Container";
import Eyebrow from "@/components/ui/Eyebrow";
import Button from "@/components/ui/Button";
import HeroPreview from "./HeroPreview";

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
    <section className="relative overflow-hidden min-h-screen flex items-center pt-24 md:pt-28 pb-16 md:pb-24">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <Container className="relative z-10 w-full">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 backdrop-blur-md mb-8 shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
          >
            <span className="flex h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary-700 dark:text-primary-300 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]">Multi-model generation + Developer API</span>
          </motion.div>

          <h1 className="text-[56px] font-extrabold leading-[0.95] tracking-tighter md:text-[96px] text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-2xl">
            <motion.span
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              custom={0}
              className="block pb-2"
            >
              AI banners that
            </motion.span>
            <motion.span
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              custom={1}
              className="block text-primary-gradient pb-4 drop-shadow-md dark:drop-shadow-[0_0_30px_rgba(167,139,250,0.4)]"
            >
              just look right.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-white/70 md:text-xl font-light"
          >
            Describe what you want. Choose from multiple AI image models,
            get every output scored for visual quality, and receive the best one — in seconds.
            Now available as a REST API for your apps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button
              href="/dashboard/banners"
              size="lg"
              rightIcon={<ArrowRight className="h-5 w-5" strokeWidth={2.5} />}
              className="h-14 px-8 text-base shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_30%,transparent)] dark:shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_50%,transparent)] hover:shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_50%,transparent)] dark:hover:shadow-[0_0_60px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-shadow duration-300"
            >
              Start Generating
            </Button>
            <Button
              href="#how-it-works"
              size="lg"
              variant="secondary"
              leftIcon={<PlayCircle className="h-5 w-5" />}
              className="h-14 px-8 text-base border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white backdrop-blur-md"
            >
              See how it works
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-8 text-sm text-slate-400 dark:text-white/40 uppercase tracking-widest font-mono"
          >
            No credit card · Free during beta
          </motion.p>
        </div>

        <div className="mt-20">
          <HeroPreview />
        </div>
      </Container>
    </section>
  );
}
