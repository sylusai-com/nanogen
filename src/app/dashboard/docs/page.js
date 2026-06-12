// src/app/dashboard/docs/page.js
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  BookOpen,
  Copy,
  Check,
  ChevronRight,
  Key,
  Zap,
  List,
  MessageSquare,
  Image,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Terminal,
  Code2,
} from "lucide-react";
import Link from "next/link";
import TopBar from "@/components/dashboard/TopBar";
import Button from "@/components/ui/Button";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nanogen.sylusai.com";

// ── Code snippets ──────────────────────────────────────────────────

const curlModels = `curl ${siteUrl}/api/v1/models \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

const curlChat = `curl ${siteUrl}/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "google/gemini-2.0-flash-001",
    "messages": [
      { "role": "user", "content": "Hello, how are you?" }
    ]
  }'`;

const curlChatStream = `curl ${siteUrl}/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "google/gemini-2.0-flash-001",
    "messages": [
      { "role": "user", "content": "Write a haiku about coding" }
    ],
    "stream": true
  }'`;

const curlGenerate = `curl -X POST ${siteUrl}/api/v1/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Modern tech startup banner",
    "model": "MODEL_SLUG",
    "aspect": "16:9",
    "style": "Modern"
  }'`;

const pythonChat = `import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "${siteUrl}/api/v1"

response = requests.post(
    f"{BASE_URL}/chat/completions",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "model": "google/gemini-2.0-flash-001",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Explain quantum computing in simple terms"},
        ],
        "temperature": 0.7,
        "max_tokens": 1024,
    },
)

data = response.json()
print(data["choices"][0]["message"]["content"])`;

const pythonModels = `import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "${siteUrl}/api/v1"

response = requests.get(
    f"{BASE_URL}/models",
    headers={"Authorization": f"Bearer {API_KEY}"},
)

models = response.json()["data"]
for model in models[:10]:
    print(f"{model['id']} — {model['name']}")`;

const jsChat = `const API_KEY = "YOUR_API_KEY";
const BASE_URL = "${siteUrl}/api/v1";

const response = await fetch(\`\${BASE_URL}/chat/completions\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.0-flash-001",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is the meaning of life?" },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`;

const jsStream = `const API_KEY = "YOUR_API_KEY";
const BASE_URL = "${siteUrl}/api/v1";

const response = await fetch(\`\${BASE_URL}/chat/completions\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.0-flash-001",
    messages: [
      { role: "user", content: "Tell me a story" },
    ],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\\n").filter(l => l.startsWith("data: "));

  for (const line of lines) {
    const data = line.slice(6);
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data);
      const content = parsed.choices?.[0]?.delta?.content || "";
      process.stdout.write(content);
    } catch {}
  }
}`;

const openaiCompatible = `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="${siteUrl}/api/v1",
)

response = client.chat.completions.create(
    model="google/gemini-2.0-flash-001",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Write a poem about AI"},
    ],
    temperature=0.7,
    max_tokens=1024,
)

print(response.choices[0].message.content)`;

// ── Component helpers ──────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, language = "bash", title }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-[var(--surface)]">
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-[11px] font-medium text-muted">{title}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!title && (
        <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed text-muted-strong font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ method, path, description, children }) {
  const methodColors = {
    GET: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    POST: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    DELETE: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
  };

  return (
    <div className="rounded-xl border border-border bg-[var(--surface)] overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <span
          className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${methodColors[method] || ""}`}
        >
          {method}
        </span>
        <div className="min-w-0">
          <code className="text-sm font-semibold text-foreground">{path}</code>
          <p className="mt-1 text-xs text-muted">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function ParamTable({ params }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-[var(--surface-2)]">
            <th className="px-3 py-2 text-left font-semibold text-muted-strong">Parameter</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-strong">Type</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-strong">Required</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-strong">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-mono text-[11px] text-foreground">{p.name}</td>
              <td className="px-3 py-2 text-muted">{p.type}</td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-amber-600 dark:text-amber-400">Yes</span>
                ) : (
                  <span className="text-muted">No</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeading({ id, icon: Icon, children }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground scroll-mt-24"
    >
      {Icon && <Icon className="h-5 w-5 text-[var(--primary)]" />}
      {children}
    </h2>
  );
}

// ── Sidebar nav items ──────────────────────────────────────────────

const NAV = [
  { id: "getting-started", label: "Getting Started", icon: Zap },
  { id: "authentication", label: "Authentication", icon: Key },
  { id: "models", label: "List Models", icon: List },
  { id: "chat-completions", label: "Chat Completions", icon: MessageSquare },
  { id: "image-generation", label: "Image Generation", icon: Image },
  { id: "openai-sdk", label: "OpenAI SDK", icon: Code2 },
  { id: "errors", label: "Error Handling", icon: AlertCircle },
  { id: "rate-limits", label: "Rate Limits", icon: Zap },
];

// ── Main page ──────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <TopBar
        title="API Documentation"
        action={
          <Button
            href="/dashboard/api"
            size="sm"
            variant="secondary"
            leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            Back to API
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-5 py-8 md:px-8 md:py-10">
        {/* Sidebar navigation */}
        <nav className="hidden lg:block shrink-0 w-52 sticky top-24 self-start">
          <div className="space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                    activeSection === item.id
                      ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                      : "text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </a>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-[var(--surface)] p-4">
            <h4 className="text-[11px] font-semibold text-muted-strong uppercase tracking-wider">
              Base URL
            </h4>
            <code className="mt-1.5 block text-[11px] text-[var(--primary)] font-mono break-all">
              {siteUrl}/api/v1
            </code>
          </div>
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1 space-y-12">
          {/* ── Getting Started ──────────────────────────────────── */}
          <section id="getting-started" className="space-y-4">
            <SectionHeading icon={Zap} id="getting-started-heading">
              Getting Started
            </SectionHeading>
            <p className="text-sm text-muted leading-relaxed">
              The Nanogen API provides OpenAI-compatible endpoints for accessing hundreds of AI models
              through a single API key. You can use it for chat completions, text generation, and
              image generation — all via the same interface you already know from OpenAI.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Create an API Key",
                  desc: "Go to the API dashboard and create a new key.",
                  href: "/dashboard/api",
                },
                {
                  step: "2",
                  title: "Choose a Model",
                  desc: "Browse 200+ models from OpenRouter.",
                },
                {
                  step: "3",
                  title: "Make a Request",
                  desc: "Send OpenAI-compatible requests.",
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="rounded-xl border border-border bg-[var(--surface)] p-4 space-y-2"
                >
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] text-xs font-bold">
                    {s.step}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                  <p className="text-xs text-muted">{s.desc}</p>
                  {s.href && (
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--primary)] hover:underline"
                    >
                      Go to API dashboard <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Authentication ───────────────────────────────────── */}
          <section id="authentication" className="space-y-4">
            <SectionHeading icon={Key} id="authentication-heading">
              Authentication
            </SectionHeading>
            <p className="text-sm text-muted leading-relaxed">
              All API requests require a Bearer token in the <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-foreground">Authorization</code> header.
              Create your API key from the{" "}
              <Link href="/dashboard/api" className="text-[var(--primary)] hover:underline">
                API dashboard
              </Link>.
            </p>

            <div className="rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900 dark:text-amber-200/80">
                  <strong className="text-amber-800 dark:text-amber-300">Security:</strong> Your API key is shown only once at creation.
                  Store it securely. Never expose it in client-side code or commit it to version control.
                </div>
              </div>
            </div>

            <CodeBlock
              code={`Authorization: Bearer ngn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
              title="Header format"
            />
          </section>

          {/* ── List Models ──────────────────────────────────────── */}
          <section id="models" className="space-y-4">
            <SectionHeading icon={List} id="models-heading">
              List Models
            </SectionHeading>

            <EndpointCard
              method="GET"
              path="/v1/models"
              description="Returns a list of all available models from OpenRouter. Use the model `id` field when making chat completions requests."
            >
              <h4 className="text-xs font-semibold text-foreground">Response fields</h4>
              <ParamTable
                params={[
                  { name: "id", type: "string", required: false, description: "Model identifier (e.g. \"google/gemini-2.0-flash-001\")" },
                  { name: "name", type: "string", required: false, description: "Human-readable model name" },
                  { name: "context_length", type: "integer", required: false, description: "Maximum context window in tokens" },
                  { name: "pricing", type: "object", required: false, description: "Pricing per token (prompt/completion)" },
                  { name: "architecture", type: "object", required: false, description: "Model architecture details" },
                ]}
              />

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Example</h4>
                <CodeBlock code={curlModels} title="cURL" />
                <CodeBlock code={pythonModels} title="Python" />
              </div>
            </EndpointCard>
          </section>

          {/* ── Chat Completions ─────────────────────────────────── */}
          <section id="chat-completions" className="space-y-4">
            <SectionHeading icon={MessageSquare} id="chat-completions-heading">
              Chat Completions
            </SectionHeading>

            <EndpointCard
              method="POST"
              path="/v1/chat/completions"
              description="Creates a chat completion. This endpoint is fully OpenAI-compatible — you can use any OpenAI SDK by changing the base URL."
            >
              <h4 className="text-xs font-semibold text-foreground">Request body</h4>
              <ParamTable
                params={[
                  { name: "model", type: "string", required: true, description: "Model ID from /v1/models (e.g. \"google/gemini-2.0-flash-001\")" },
                  { name: "messages", type: "array", required: true, description: "Array of message objects with role and content" },
                  { name: "temperature", type: "number", required: false, description: "Sampling temperature (0-2). Default: 1" },
                  { name: "max_tokens", type: "integer", required: false, description: "Maximum tokens to generate" },
                  { name: "top_p", type: "number", required: false, description: "Nucleus sampling parameter (0-1)" },
                  { name: "stream", type: "boolean", required: false, description: "Enable streaming responses (SSE)" },
                  { name: "stop", type: "string|array", required: false, description: "Stop sequences" },
                  { name: "frequency_penalty", type: "number", required: false, description: "Frequency penalty (-2 to 2)" },
                  { name: "presence_penalty", type: "number", required: false, description: "Presence penalty (-2 to 2)" },
                  { name: "response_format", type: "object", required: false, description: "Response format (e.g. { type: \"json_object\" })" },
                  { name: "tools", type: "array", required: false, description: "Function calling / tools definition" },
                  { name: "tool_choice", type: "string|object", required: false, description: "Tool choice control" },
                ]}
              />

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Examples</h4>
                <CodeBlock code={curlChat} title="cURL" />
                <CodeBlock code={pythonChat} title="Python" />
                <CodeBlock code={jsChat} title="JavaScript / Node.js" />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">Response format</h4>
                <CodeBlock
                  title="JSON Response"
                  code={`{
  "id": "gen-xxxxxxxxxxxx",
  "object": "chat.completion",
  "created": 1718190000,
  "model": "google/gemini-2.0-flash-001",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well. How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 15,
    "total_tokens": 27
  }
}`}
                />
              </div>

              <div className="rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5 p-4">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-900 dark:text-blue-200/80">
                    <strong className="text-blue-800 dark:text-blue-300">Tip:</strong> Use the{" "}
                    <code className="rounded bg-blue-100 dark:bg-blue-900/30 px-1 text-[11px]">model</code> field from{" "}
                    <code className="rounded bg-blue-100 dark:bg-blue-900/30 px-1 text-[11px]">/v1/models</code>{" "}
                    to find the correct model identifier. Popular models include{" "}
                    <code className="rounded bg-blue-100 dark:bg-blue-900/30 px-1 text-[11px]">google/gemini-2.0-flash-001</code>,{" "}
                    <code className="rounded bg-blue-100 dark:bg-blue-900/30 px-1 text-[11px]">anthropic/claude-sonnet-4</code>, and{" "}
                    <code className="rounded bg-blue-100 dark:bg-blue-900/30 px-1 text-[11px]">openai/gpt-4o</code>.
                  </div>
                </div>
              </div>
            </EndpointCard>
          </section>

          {/* ── Image Generation ─────────────────────────────────── */}
          <section id="image-generation" className="space-y-4">
            <SectionHeading icon={Image} id="image-generation-heading">
              Image Generation
            </SectionHeading>

            <EndpointCard
              method="POST"
              path="/v1/generate"
              description="Generate a banner image using a Nanogen image model. Model slugs are admin-configured — this endpoint is separate from chat completions."
            >
              <h4 className="text-xs font-semibold text-foreground">Request body</h4>
              <ParamTable
                params={[
                  { name: "prompt", type: "string", required: true, description: "Image generation prompt (3-4000 chars)" },
                  { name: "model", type: "string", required: true, description: "Model slug from the Nanogen image models" },
                  { name: "aspect", type: "string", required: false, description: "Aspect ratio: \"1:1\", \"4:5\", \"9:16\", \"16:9\" (default)" },
                  { name: "style", type: "string", required: false, description: "Style hint (max 60 chars). Default: \"Modern\"" },
                ]}
              />

              <CodeBlock code={curlGenerate} title="cURL" />
            </EndpointCard>
          </section>

          {/* ── OpenAI SDK ───────────────────────────────────────── */}
          <section id="openai-sdk" className="space-y-4">
            <SectionHeading icon={Code2} id="openai-sdk-heading">
              OpenAI SDK Compatible
            </SectionHeading>
            <p className="text-sm text-muted leading-relaxed">
              The Nanogen API is fully compatible with the OpenAI SDK. Simply change the{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-foreground">base_url</code>{" "}
              and <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-foreground">api_key</code>{" "}
              to use any OpenAI SDK with Nanogen.
            </p>

            <CodeBlock code={openaiCompatible} title="Python (OpenAI SDK)" />

            <div className="rounded-xl border border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5 p-4">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200/80">
                  <strong className="text-emerald-800 dark:text-emerald-300">Works with:</strong> OpenAI Python SDK, OpenAI Node.js SDK,
                  LangChain, LlamaIndex, Vercel AI SDK, and any other library that supports custom base URLs.
                </div>
              </div>
            </div>
          </section>



          {/* ── Error Handling ────────────────────────────────────── */}
          <section id="errors" className="space-y-4">
            <SectionHeading icon={AlertCircle} id="errors-heading">
              Error Handling
            </SectionHeading>
            <p className="text-sm text-muted leading-relaxed">
              The API uses standard HTTP status codes and returns errors in a consistent JSON format.
            </p>

            <CodeBlock
              title="Error response format"
              code={`{
  "error": {
    "message": "Human-readable error description",
    "type": "error_category",
    "code": "machine_readable_code"
  }
}`}
            />

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-[var(--surface-2)]">
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-strong">Status</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-strong">Code</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-strong">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { status: "400", code: "parse_error / missing_*", desc: "Invalid request body or missing required fields" },
                    { status: "401", code: "invalid_api_key", desc: "Missing, invalid, or expired API key" },
                    { status: "403", code: "scope_denied", desc: "API key does not have access to this model" },
                    { status: "429", code: "rate_limit_rpm / rate_limit_rpd", desc: "Rate limit exceeded (per-minute or per-day)" },
                    { status: "502", code: "upstream_error", desc: "Failed to connect to the upstream model provider" },
                    { status: "503", code: "provider_not_configured", desc: "Service temporarily unavailable" },
                  ].map((e, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                          e.status.startsWith("4") ? "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400" : "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-400"
                        }`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-strong">{e.code}</td>
                      <td className="px-4 py-2.5 text-muted">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Rate Limits ───────────────────────────────────────── */}
          <section id="rate-limits" className="space-y-4">
            <SectionHeading icon={Zap} id="rate-limits-heading">
              Rate Limits
            </SectionHeading>
            <p className="text-sm text-muted leading-relaxed">
              Each API key has rate limits to ensure fair usage. Rate limit information is included
              in response headers.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
                <div className="text-2xl font-bold text-foreground">60</div>
                <div className="mt-1 text-xs text-muted">Requests per minute (RPM)</div>
              </div>
              <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
                <div className="text-2xl font-bold text-foreground">1,000</div>
                <div className="mt-1 text-xs text-muted">Requests per day (RPD)</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-[var(--surface-2)]">
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-strong">Header</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-strong">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-foreground">X-RateLimit-Remaining-RPM</td>
                    <td className="px-4 py-2.5 text-muted">Remaining requests this minute</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-foreground">X-RateLimit-Remaining-RPD</td>
                    <td className="px-4 py-2.5 text-muted">Remaining requests today</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-foreground">Retry-After</td>
                    <td className="px-4 py-2.5 text-muted">Seconds to wait before retrying (on 429)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Footer ───────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-6 text-center">
            <p className="text-sm text-muted">
              Need help?{" "}
              <Link
                href="/dashboard/api"
                className="text-[var(--primary)] hover:underline"
              >
                Manage your API keys
              </Link>{" "}
              or reach out to the team for support.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
