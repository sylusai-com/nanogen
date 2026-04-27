// src/lib/openrouter.js
// OpenRouter chat completions client. Used by /api/banners/html to drive
// the AI HTML banner generator with whichever text model the admin marked
// as default in the `models` table.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.body = body;
  }
}

export function isOpenRouterConfigured() {
  return !!process.env.OPENROUTER_API_KEY;
}

export async function callOpenRouter({
  model,
  messages,
  jsonMode = false,
  maxTokens = 4096,
  temperature = 0.7,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError(
      "OPENROUTER_API_KEY is not configured. Add it to .env.local.",
      { status: 500 },
    );
  }
  if (!model) throw new OpenRouterError("Model is required", { status: 400 });
  if (!Array.isArray(messages) || !messages.length) {
    throw new OpenRouterError("Messages are required", { status: 400 });
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter recommends these for traffic attribution:
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "Nanogen",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(jsonMode && { response_format: { type: "json_object" } }),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OpenRouterError(`OpenRouter ${res.status}: ${text}`, {
      status: res.status,
      body: text,
    });
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return { content, raw: data };
}

// Strips ```json ... ``` fences and trailing prose so JSON.parse succeeds.
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  // Find the first { and the last } so we ignore any pre/post commentary.
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}
