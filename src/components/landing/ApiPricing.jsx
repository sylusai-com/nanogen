"use client";

import { motion } from "motion/react";
import { Check, Sparkles, Zap } from "lucide-react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for testing and prototyping",
    badge: null,
    features: [
      "1,000 requests / day",
      "60 requests / minute",
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
    price: "$29",
    period: "/month",
    description: "For production apps and teams",
    badge: "Popular",
    features: [
      "10,000 requests / day",
      "300 requests / minute",
      "Priority model access",
      "Quality scoring + breakdown",
      "Advanced analytics",
      "Webhook notifications",
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
            className={`relative overflow-hidden rounded-2xl border p-6 md:p-8 transition-all ${
              tier.highlight
                ? "border-primary/50 bg-[color-mix(in_oklab,var(--primary)_4%,var(--surface))] ring-1 ring-primary/20 scale-[1.02]"
                : "border-border bg-surface hover:border-border-strong"
            }`}
          >
            {/* Badge */}
            {tier.badge && (
              <div className="absolute right-4 top-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-primary">
                  <Sparkles className="h-3 w-3" />
                  {tier.badge}
                </span>
              </div>
            )}

            {/* Glow for highlighted card */}
            {tier.highlight && (
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            )}

            <div className="relative">
              <h3 className="text-lg font-semibold text-foreground">
                {tier.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-sm text-muted">{tier.period}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted">{tier.description}</p>

              <div className="divider-soft my-6" />

              <ul className="space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        tier.highlight ? "text-primary" : "text-muted"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span className="text-muted-strong">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {tier.ctaHref ? (
                  <Button
                    href={tier.ctaHref}
                    variant={tier.variant}
                    size="lg"
                    className="w-full"
                  >
                    {tier.cta}
                  </Button>
                ) : (
                  <Button
                    variant={tier.variant}
                    size="lg"
                    className="w-full"
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
