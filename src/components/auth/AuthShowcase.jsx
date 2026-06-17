"use client";

import { motion } from "motion/react";
import { Code2, Image as ImageIcon, Sparkles, Zap } from "lucide-react";

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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium tracking-wide text-foreground">Next-Gen API Platform</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm mb-4">
            Banners generated at the <span className="text-primary-gradient">speed of thought.</span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md font-light">
            Connect our API, define your brand, and watch multi-model AI craft the perfect visual assets in milliseconds.
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
            className="relative rounded-2xl border border-white/10 bg-slate-900/80 dark:bg-black/60 shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <span className="ml-2 text-xs font-mono text-slate-400">generate.ts</span>
            </div>
            <div className="p-6 font-mono text-sm">
              <div className="text-slate-400 mb-2">{"// Initialize Nanozen client"}</div>
              <div className="text-blue-400">import <span className="text-slate-300">Nanozen</span> from <span className="text-green-400">&apos;@nanozen/sdk&apos;</span>;</div>
              <div className="mt-4 text-blue-400">const <span className="text-slate-300">banner</span> = <span className="text-primary">await</span> <span className="text-slate-300">nano.generate</span>{"({"}</div>
              <div className="ml-4 text-slate-300">model: <span className="text-green-400">&apos;flux-pro&apos;</span>,</div>
              <div className="ml-4 text-slate-300">prompt: <span className="text-green-400">&apos;cyberpunk developer setup&apos;</span>,</div>
              <div className="ml-4 text-slate-300">format: <span className="text-green-400">&apos;1200x630&apos;</span></div>
              <div className="text-slate-300">{"});"}</div>
            </div>
          </motion.div>

          {/* Floating Image Mock */}
          <motion.div
            initial={{ opacity: 0, x: 40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", bounce: 0.4 }}
            className="absolute -right-8 -bottom-12 w-64 rounded-xl border border-white/10 bg-slate-800/90 dark:bg-black/80 shadow-2xl backdrop-blur-xl p-2 z-20"
          >
            <div className="aspect-[1.91/1] rounded-lg bg-gradient-to-br from-primary/40 to-blue-600/40 border border-white/5 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-ambient opacity-50" />
              <ImageIcon className="w-8 h-8 text-white/50" />
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" /> Generated
              </span>
              <span className="text-[10px] font-mono text-slate-500">120ms</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Stats / Trust markers */}
      <div className="relative z-10 flex items-center gap-8 border-t border-white/10 pt-8">
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">99.9%</div>
          <div className="text-sm text-slate-500 mt-1">Uptime SLA</div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">~450ms</div>
          <div className="text-sm text-slate-500 mt-1">Avg. Latency</div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-1">
             Multi <Code2 className="w-5 h-5 text-primary" />
          </div>
          <div className="text-sm text-slate-500 mt-1">Model Routing</div>
        </div>
      </div>
    </div>
  );
}
