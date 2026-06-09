"use client";

import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const text = "Modern SaaS product launch banner, bold headline, dark futuristic aesthetic";

export default function HeroPreview() {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i));
      i++;
      if (i > text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98], delay: 0.2 }}
      className="relative mx-auto mt-16 max-w-3xl"
    >
      <div className="relative overflow-hidden rounded-full border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#0a0a0b]/80 p-2 pl-6 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          
          <div className="flex-1 font-mono text-sm md:text-base text-slate-700 dark:text-white/80 h-6 flex items-center overflow-hidden whitespace-nowrap">
            {displayedText}
            {isTyping && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-2 h-5 bg-primary ml-1"
              />
            )}
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isTyping ? 0 : 1, scale: isTyping ? 0.8 : 1 }}
            transition={{ duration: 0.4 }}
            className="shrink-0"
          >
            <div className="flex items-center justify-center h-10 w-10 md:h-12 md:w-12 rounded-full bg-primary text-primary-fg shadow-[0_0_20px_var(--primary)]">
              <ArrowRight className="h-4 w-4 md:h-5 md:w-5" strokeWidth={3} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-[80%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_20%,transparent),transparent)] blur-2xl" />
    </motion.div>
  );
}
