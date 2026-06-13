"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check, Terminal, Code2, Zap, Shield, BarChart3, Webhook } from "lucide-react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nanozen.app";

const curlSnippet = `curl -X POST ${siteUrl}/api/v1/generate \\
  -H "Authorization: Bearer ngn_a1b2c3d4..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Modern SaaS product launch banner",
    "model": "flux-1-schnell",
    "aspect": "16:9",
    "style": "Modern"
  }'`;

const responseSnippet = `{
  "id": "gen_1717680000_x8k2m9",
  "model": "flux-1-schnell",
  "prompt": "Modern SaaS product launch banner",
  "aspect": "16:9",
  "imageUrl": "${siteUrl}/gen/...",
  "score": 92,
  "latencyMs": 1840,
  "usage": {
    "rpm_remaining": 58,
    "rpd_remaining": 994
  }
}`;

const pythonSnippet = `import requests

response = requests.post(
    "${siteUrl}/api/v1/generate",
    headers={"Authorization": "Bearer ngn_a1b2c3d4..."},
    json={
        "prompt": "Modern SaaS product launch banner",
        "model": "flux-1-schnell",
        "aspect": "16:9"
    }
)

data = response.json()
print(f"Score: {data['score']} | URL: {data['imageUrl']}")`;

const jsSnippet = `const res = await fetch("${siteUrl}/api/v1/generate", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ngn_a1b2c3d4...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "Modern SaaS product launch banner",
    model: "flux-1-schnell",
    aspect: "16:9",
  }),
});

const { imageUrl, score } = await res.json();`;

const tabs = [
  { label: "cURL", icon: Terminal, code: curlSnippet, lang: "bash" },
  { label: "Python", icon: Code2, code: pythonSnippet, lang: "python" },
  { label: "JavaScript", icon: Code2, code: jsSnippet, lang: "javascript" },
];

const features = [
  {
    icon: <Zap className="h-4 w-4" />,
    title: "Multi-model access",
    body: "Single API, multiple image models. Switch between SDXL, Flux, Imagen & more with just a model slug.",
  },
  {
    icon: <Shield className="h-4 w-4" />,
    title: "Bearer token auth",
    body: "Simple API keys with per-key rate limits. No complex OAuth flows — just add your token and go.",
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Usage tracking",
    body: "Real-time usage dashboard with per-key analytics. Know exactly how your integration performs.",
  },
  {
    icon: <Webhook className="h-4 w-4" />,
    title: "Async Webhooks",
    body: "Receive instant HTTP callbacks when your generation tasks complete. No continuous polling required.",
  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}

export default function ApiShowcase() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Section
      id="api"
      eyebrow="Developer API"
      title="Image generation via API"
      description="Integrate Nanozen's banner generation into your product. One endpoint, multiple models to choose from, quality-scored outputs — all through a simple REST API."
    >
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Code panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0c14] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
        >
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-4">
            <div className="flex">
              {tabs.map((t, i) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setActiveTab(i)}
                    className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors ${
                      i === activeTab
                        ? "border-primary text-white"
                        : "border-transparent text-white/40 hover:text-white/70"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <CopyButton text={tabs[activeTab].code} />
          </div>

          {/* Code content */}
          <div className="relative">
            <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-white/80 font-mono">
              <code>{tabs[activeTab].code}</code>
            </pre>
          </div>

          {/* Response preview */}
          <div className="border-t border-white/10">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Response
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                200 OK
              </span>
            </div>
            <pre className="overflow-x-auto px-5 pb-5 text-[12px] leading-relaxed text-emerald-300/70 font-mono">
              <code>{responseSnippet}</code>
            </pre>
          </div>
        </motion.div>

        {/* Features + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col gap-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
            >
              <Card elevated className="p-5">
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
                    {f.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {f.title}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {f.body}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}

          <div className="mt-auto flex flex-col gap-3 sm:flex-row">
            <Button href="/dashboard/api" size="lg">
              Get API key
            </Button>
            <Button href="#api-pricing" size="lg" variant="secondary">
              View pricing
            </Button>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
