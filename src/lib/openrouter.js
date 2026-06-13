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

// OpenAI's `response_format: { type: "json_object" }` is NOT universally
// supported. Anthropic / Claude models in particular do not accept it —
// sending it makes the upstream (or OpenRouter, on Claude's behalf)
// reject the request. That is exactly why Claude banners silently fell
// back to the static template while Gemini / OpenAI ones generated fine:
// the banner call sets jsonMode, and json_object mode is invalid for
// Claude. For those models we omit the parameter and rely on the prompt
// ("Output ONLY JSON, no prose, no markdown fences") plus extractJson(),
// which already strips the markdown fences Claude occasionally adds.
function supportsJsonResponseFormat(modelId) {
  return !/claude|anthropic/i.test(modelId || "");
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
      "X-Title": "Nanozen",
    },
    body: JSON.stringify({
      model: normalizedModel,
      messages,
      max_tokens:  maxTokens,
      temperature,
      // Only attach response_format for models that actually support
      // json_object mode — sending it to Claude breaks the request.
      ...(jsonMode && supportsJsonResponseFormat(normalizedModel) && {
        response_format: { type: "json_object" },
      }),
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
  // `finish_reason` tells callers WHY generation stopped. "length" means
  // the model hit max_tokens mid-output — the response is truncated and
  // any JSON in it is incomplete. Callers use this to escalate the token
  // budget on a retry instead of blindly treating it as malformed.
  const finishReason = data?.choices?.[0]?.finish_reason || null;
  return { content, finishReason, raw: data };
}

// Strips ```json ... ``` fences and trailing prose so JSON.parse succeeds.
// Then runs the result through a series of forgiving repairs for the most
// common malformations real-world LLMs emit even with jsonMode enabled:
//   - line comments (`// note`) — Gemini frequently adds these
//   - block comments (`/* … */`)
//   - trailing commas before } or ]
//   - literal newlines / tabs inside string values (CSS blocks tend to)
// Each repair only kicks in after the strict parse has already failed, so
// well-formed JSON pays no robustness tax.
export function extractJson(text) {
  if (!text) return null;
  const fenced    = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const first = candidate.indexOf("{");
  const last  = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  const sliced = candidate.slice(first, last + 1);

  const attempts = [
    sliced,
    () => stripComments(sliced),
    () => stripTrailingCommas(stripComments(sliced)),
    () => escapeRawNewlinesInStrings(stripTrailingCommas(stripComments(sliced))),
  ];
  for (const a of attempts) {
    const src = typeof a === "function" ? a() : a;
    try { return JSON.parse(src); } catch { /* try next repair */ }
  }
  return null;
}

function stripComments(src) {
  // Remove block comments and line comments — but only when they appear
  // OUTSIDE string literals so we don't eat `// ` inside a URL or a CSS
  // value. The state machine tracks whether we're inside a "…" string.
  let out = "";
  let i = 0;
  let inString = false;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < src.length) { out += src[i + 1]; i += 2; continue; }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') { inString = true; out += c; i++; continue; }
    if (c === "/" && n === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function stripTrailingCommas(src) {
  // Skip commas that sit inside string literals; only remove the syntactic
  // trailing commas before } or ].
  let out = "";
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < src.length) { out += src[i + 1]; i++; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === ",") {
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === "}" || src[j] === "]") continue;
    }
    out += c;
  }
  return out;
}

function escapeRawNewlinesInStrings(src) {
  // Models sometimes emit multi-line CSS blocks as a single string value
  // without escaping the newlines, which makes JSON.parse choke on the
  // raw \n. Replace raw control characters (newline, carriage return,
  // tab) inside string literals with their escaped form.
  let out = "";
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === "\\" && i + 1 < src.length) { out += c + src[i + 1]; i++; continue; }
      if (c === '"') { inString = false; out += c; continue; }
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
      out += c;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    out += c;
  }
  return out;
}