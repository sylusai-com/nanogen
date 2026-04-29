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

// Provider-specific quirks live here. The goal: admins can paste the
// modelId in whatever shape they expect (e.g. "openrouter/anthropic/claude-…"
// because that's what they read on the OpenRouter docs landing page) and
// we'll normalise to what the actual upstream API expects before calling.
function normalizeModelId(modelId, url) {
  if (!modelId) return modelId;
  let id = modelId.trim();

  const isOpenRouter = /\bopenrouter\.ai\b/i.test(url);
  if (isOpenRouter) {
    // OpenRouter expects `<vendor>/<model>` with NO leading `openrouter/`.
    // Strip it if the admin pasted it that way — the upstream rejects
    // these with `… is not a valid model ID`.
    id = id.replace(/^openrouter\//i, "");
  }

  const isOpenAI = /\bapi\.openai\.com\b/i.test(url);
  if (isOpenAI) {
    // OpenAI's own API doesn't take the `openai/` vendor prefix —
    // strip it when present so admins can paste either shape.
    id = id.replace(/^openai\//i, "");
  }

  return id;
}

// Pretty-print upstream errors so admins can fix configuration without
// reading the raw provider envelope.
function explainUpstreamError(status, text, url) {
  const isOpenRouter = /\bopenrouter\.ai\b/i.test(url);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  const upstreamMsg = parsed?.error?.message || parsed?.error || text || `HTTP ${status}`;

  // Targeted hints for the most common admin mistakes.
  if (isOpenRouter && /not a valid model id/i.test(upstreamMsg)) {
    return (
      `OpenRouter rejected the model ID. Set "Provider model ID" in ` +
      `Admin → Models to the form "<vendor>/<slug>" (e.g. ` +
      `"anthropic/claude-3.5-sonnet" — without a leading "openrouter/"). ` +
      `Upstream: ${upstreamMsg}`
    );
  }
  if (status === 401) {
    return `Provider returned 401 (auth). Check the API key in Admin → Models. Upstream: ${upstreamMsg}`;
  }
  if (status === 402 || /insufficient.*credit|payment required/i.test(upstreamMsg)) {
    return `Provider account has no credits. Upstream: ${upstreamMsg}`;
  }
  if (status === 429) {
    return `Provider rate limit hit. Try again in a moment. Upstream: ${upstreamMsg}`;
  }
  return `Upstream ${status}: ${upstreamMsg}`;
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

  const url            = endpoint || DEFAULT_ENDPOINT;
  const normalizedModel = normalizeModelId(model, url);

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
      model: normalizedModel,
      messages,
      max_tokens:  maxTokens,
      temperature,
      ...(jsonMode && { response_format: { type: "json_object" } }),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OpenRouterError(
      explainUpstreamError(res.status, text, url),
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