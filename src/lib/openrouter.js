// src/lib/openrouter.js
// Generic OpenAI-compatible chat completions client.
//
// Despite the name, this works with any provider that exposes an OpenAI-style
// /v1/chat/completions endpoint — OpenRouter, vLLM, Together, Groq, OpenAI
// itself, an internal proxy, etc. The endpoint and API key are passed in
// from the caller (which reads them from the model row in the DB).

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name   = "OpenRouterError";
    this.status = status;
    this.body   = body;
  }
}

export async function callOpenRouter({
  apiKey,
  endpoint,
  model,
  messages,
  jsonMode    = false,
  maxTokens   = 4096,
  temperature = 0.7,
}) {
  if (!apiKey) {
    throw new OpenRouterError(
      "Missing API key for this model. Set it in Admin → Models.",
      { status: 401 },
    );
  }
  if (!model) throw new OpenRouterError("Model is required", { status: 400 });
  if (!Array.isArray(messages) || !messages.length) {
    throw new OpenRouterError("Messages are required", { status: 400 });
  }

  const url = endpoint || DEFAULT_ENDPOINT;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter recommends these for traffic attribution; harmless for
      // other OpenAI-compatible providers.
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "Nanogen",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens:  maxTokens,
      temperature,
      ...(jsonMode && { response_format: { type: "json_object" } }),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OpenRouterError(
      `Upstream ${res.status} from ${url}: ${text}`,
      { status: res.status, body: text },
    );
  }

  const data    = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return { content, raw: data };
}

// Strips ```json ... ``` fences and trailing prose so JSON.parse succeeds.
export function extractJson(text) {
  if (!text) return null;
  const fenced    = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  // Find the first { and the last } so we ignore any pre/post commentary.
  const first = candidate.indexOf("{");
  const last  = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}