"use client";

import { motion } from "motion/react";
import { Check, Sparkles, Zap } from "lucide-react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

const tiers = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "Perfect for testing and prototyping",
    badge: null,
    features: [
      "1 requests / day",
      "1 requests / minute",
      "All enabled image models",
      "Quality scoring on every output",
      "Usage dashboard",
      "Community support",
    ],
    cta: "Get free API key",
    ctaHref: "/dashboard/api",
    variant: "secondary",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹2500",
    period: "/month",
    description: "For production apps and teams",
    badge: "Popular",
    features: [
      "25 requests / day",
      "5 requests / minute",
      "Priority model access",
      "Quality scoring + breakdown",
      "Advanced analytics",
      "Priority support",
      "Custom rate limits",
    ],
    cta: "Coming soon",
    ctaHref: null,
    variant: "primary",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For high-volume and custom deployments",
    badge: null,
    features: [
      "Unlimited requests",
      "Custom rate limits",
      "Dedicated model endpoints",
      "SLA guarantee",
      "White-label option",
      "Dedicated support",
      "Custom integrations",
      "On-premise deployment",
    ],
    cta: "Contact us",
    ctaHref: null,
    variant: "secondary",
    highlight: false,
  },
];

export default function ApiPricing() {
  return (
    <Section
      id="api-pricing"
      eyebrow="API Pricing"
      title="Simple, transparent pricing"
      description="Start free, scale as you grow. No hidden fees, no surprises."
      align="center"
    >
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.5,
              delay: i * 0.08,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className={`relative overflow-hidden rounded-3xl border p-6 md:p-8 transition-all duration-500 ${
              tier.highlight
                ? "border-primary/60 bg-[color-mix(in_oklab,var(--primary)_5%,white)] dark:bg-[color-mix(in_oklab,var(--primary)_10%,#0a0a0b)] ring-2 ring-primary/40 scale-[1.05] shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_20%,transparent)] dark:shadow-[0_0_80px_color-mix(in_oklab,var(--primary)_30%,transparent)] z-10"
                : "border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-[#0a0a0b]/60 backdrop-blur-xl hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/50 dark:hover:bg-[#0a0a0b]/80"
            }`}
          >
            {/* Badge */}
            {tier.badge && (
              <div className="absolute right-4 top-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 dark:bg-primary/20 px-3 py-1 text-[11px] font-bold tracking-wide text-primary-700 dark:text-primary-300 shadow-[0_0_15px_var(--primary)]">
                  <Sparkles className="h-3 w-3" />
                  {tier.badge}
                </span>
              </div>
            )}

            {/* Glow for highlighted card */}
            {tier.highlight && (
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/40 blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen animate-pulse" />
            )}

            <div className="relative z-10">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                {tier.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`text-5xl font-extrabold tracking-tighter drop-shadow-sm dark:drop-shadow-lg ${tier.highlight ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-white/90'}`}>
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-sm font-medium text-slate-500 dark:text-white/50">{tier.period}</span>
                )}
              </div>
              <p className="mt-3 text-[15px] text-slate-600 dark:text-white/60">{tier.description}</p>

              <div className="my-8 h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />

              <ul className="space-y-4">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tier.highlight ? 'bg-primary/20 text-primary-700 dark:text-primary-300 shadow-[0_0_10px_var(--primary)]' : 'bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-white/40'}`}>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 dark:text-white/80">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                {tier.ctaHref ? (
                  <Button
                    href={tier.ctaHref}
                    size="lg"
                    className={`w-full h-14 text-base font-semibold ${tier.highlight ? 'shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_50%,transparent)]' : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}
                  >
                    {tier.cta}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className={`w-full h-14 text-base font-semibold ${tier.highlight ? 'shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_50%,transparent)]' : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white'}`}
                    disabled={tier.cta === "Coming soon"}
                  >
                    {tier.cta}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
