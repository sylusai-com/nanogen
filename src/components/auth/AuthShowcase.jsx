"use client";

import { motion } from "motion/react";
import { Code2, Image as ImageIcon, Sparkles, Zap } from "lucide-react";
import Image from "next/image";

export default function AuthShowcase() {
  return (
    <div className="relative hidden lg:flex flex-1 flex-col justify-between overflow-hidden bg-surface-2 dark:bg-[#0a0a0b] p-12 text-foreground">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-ambient pointer-events-none opacity-60" />
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
      
      {/* Glow Orbs */}
      <div className="absolute -top-[20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />

      {/* Top Branding / Tagline */}
      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 px-3 py-1 backdrop-blur-md mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium tracking-wide text-foreground">AI Banner Generation Platform</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm mb-4">
            Banners generated at the <span className="text-primary-gradient">speed of thought.</span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md font-light">
            Describe your vision, pick a style, and let AI generate stunning, production-ready banners in seconds.
          </p>
        </motion.div>
      </div>

      {/* Animated Centerpiece */}
      <div className="relative z-10 flex-1 flex items-center justify-center mt-12 mb-12">
        <div className="relative w-full max-w-lg perspective-1000">
          
          {/* Main IDE / API snippet mock */}
          <motion.div
            initial={{ opacity: 0, rotateX: 20, y: 40 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, type: "spring", bounce: 0.4 }}
            className="relative rounded-2xl border border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-black/60 shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-slate-200/50 dark:border-white/10 bg-slate-100/50 dark:bg-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <span className="ml-2 text-xs font-mono text-slate-600 dark:text-slate-400">generate.ts</span>
            </div>
            <div className="p-6 font-mono text-sm">
              <div className="text-slate-500 dark:text-slate-400 mb-2">{"// Initialize Nanozen client"}</div>
              <div className="text-blue-600 dark:text-blue-400">import <span className="text-slate-700 dark:text-slate-300">Nanozen</span> from <span className="text-green-600 dark:text-green-400">&apos;@nanozen/sdk&apos;</span>;</div>
              <div className="mt-4 text-blue-600 dark:text-blue-400">const <span className="text-slate-700 dark:text-slate-300">banner</span> = <span className="text-primary">await</span> <span className="text-slate-700 dark:text-slate-300">nano.generate</span>{"({"}</div>
              <div className="ml-4 text-slate-700 dark:text-slate-300">model: <span className="text-green-600 dark:text-green-400">&apos;flux-pro&apos;</span>,</div>
              <div className="ml-4 text-slate-700 dark:text-slate-300">prompt: <span className="text-green-600 dark:text-green-400">&apos;cyberpunk developer setup&apos;</span>,</div>
              <div className="ml-4 text-slate-700 dark:text-slate-300">format: <span className="text-green-600 dark:text-green-400">&apos;1200x630&apos;</span></div>
              <div className="text-slate-700 dark:text-slate-300">{"});"}</div>
            </div>
          </motion.div>

          {/* Floating Image Mock */}
          <motion.div
            initial={{ opacity: 0, x: 40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.5,
              type: "spring",
              bounce: 0.4,
            }}
            className="absolute -right-8 -bottom-12 w-64 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/90 dark:bg-black/80 shadow-2xl backdrop-blur-xl p-2 z-20"
          >
            <div className="aspect-[1.91/1] rounded-lg border border-slate-200/50 dark:border-white/5 relative overflow-hidden">
              <Image
                src="/banners/generated-banner.png"
                alt="AI Generated Banner"
                fill
                className="object-cover"
                priority
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>

            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" />
                Generated
              </span>

              <span className="text-[10px] font-mono text-slate-500">
                120ms
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Stats / Trust markers */}
      <div className="relative z-10 flex items-center gap-8 border-t border-slate-200/50 dark:border-white/10 pt-8">
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">2k+</div>
          <div className="text-sm text-slate-500 mt-1">Banners Generated</div>
        </div>
        <div className="w-px h-10 bg-slate-200 dark:bg-white/10" />
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">~30s</div>
          <div className="text-sm text-slate-500 mt-1">Avg. Generation</div>
        </div>
        <div className="w-px h-10 bg-slate-200 dark:bg-white/10" />
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-1">
             Multi <Code2 className="w-5 h-5 text-primary" />
          </div>
          <div className="text-sm text-slate-500 mt-1">AI Models</div>
        </div>
      </div>
    </div>
  );
}
