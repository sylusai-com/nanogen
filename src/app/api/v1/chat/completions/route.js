// src/app/api/v1/chat/completions/route.js
//
// Public API — OpenAI-compatible chat completions proxy.
// Authenticated via Bearer token (ngn_xxx API key).
//
// Proxies requests to OpenRouter using the platform's OPENROUTER_API_KEY.
// Accepts any model available on OpenRouter — does NOT validate against
// the admin models DB (those are for banner generation only).
//
// Supports both streaming and non-streaming responses.

import { NextResponse } from "next/server";
import { validateApiKey, checkKeyRateLimit, logApiUsage } from "@/lib/db/apiKeys";
import { getDefaultTextModelWithSecrets } from "@/lib/db/models";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req) {
  const start = Date.now();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";

  // ── Auth ──────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  const rawKey = auth.replace(/^Bearer\s+/i, "").trim();

  const keyRow = await validateApiKey(rawKey);
  if (!keyRow) {
    return NextResponse.json(
      {
        error: {
          message: "Invalid or expired API key",
          type: "authentication_error",
          code: "invalid_api_key",
        },
      },
      { status: 401 },
    );
  }

  // ── Rate limit ────────────────────────────────────────────────────
  const rl = await checkKeyRateLimit(keyRow);
  if (!rl.ok) {
    logApiUsage({
      keyId: keyRow.id,
      userId: keyRow.user_id,
      endpoint: "/v1/chat/completions",
      statusCode: 429,
      latencyMs: Date.now() - start,
      ip,
    });

    return NextResponse.json(
      {
        error: {
          message:
            rl.reason === "rate_limit_rpm"
              ? `Rate limit exceeded: ${keyRow.rate_limit_rpm} requests/minute`
              : `Daily limit exceeded: ${keyRow.rate_limit_rpd} requests/day`,
          type: "rate_limit_error",
          code: rl.reason,
        },
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid JSON body",
          type: "invalid_request",
          code: "parse_error",
        },
      },
      { status: 400 },
    );
  }

  // ── Validate required fields ──────────────────────────────────────
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) {
    return NextResponse.json(
      {
        error: {
          message: "model is required",
          type: "invalid_request",
          code: "missing_model",
        },
      },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: "messages is required and must be a non-empty array",
          type: "invalid_request",
          code: "missing_messages",
        },
      },
      { status: 400 },
    );
  }

  // ── Resolve OpenRouter API key ─────────────────────────────────────
  // Priority: env var → default text model's config in the DB
  let openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    try {
      const admin = createAdminClient();
      const defaultModel = await getDefaultTextModelWithSecrets(admin);
      const cfg = defaultModel?.config || {};
      openrouterKey = cfg.apiKey || cfg.api_key || cfg.openrouterApiKey || cfg.openrouter_api_key || null;
    } catch {
      // DB lookup failed — continue to error below
    }
  }
  if (!openrouterKey) {
    console.error("No OpenRouter API key found (checked env and default text model)");
    return NextResponse.json(
      {
        error: {
          message: "Service temporarily unavailable — provider not configured",
          type: "server_error",
          code: "provider_not_configured",
        },
      },
      { status: 503 },
    );
  }

  // ── Build upstream request body ───────────────────────────────────
  const upstreamBody = {
    model,
    messages: body.messages,
  };

  // Forward optional OpenAI-compatible parameters
  if (body.temperature !== undefined) upstreamBody.temperature = body.temperature;
  if (body.max_tokens !== undefined) upstreamBody.max_tokens = body.max_tokens;
  if (body.top_p !== undefined) upstreamBody.top_p = body.top_p;
  if (body.frequency_penalty !== undefined) upstreamBody.frequency_penalty = body.frequency_penalty;
  if (body.presence_penalty !== undefined) upstreamBody.presence_penalty = body.presence_penalty;
  if (body.stop !== undefined) upstreamBody.stop = body.stop;
  if (body.stream !== undefined) upstreamBody.stream = body.stream;
  if (body.response_format !== undefined) upstreamBody.response_format = body.response_format;
  if (body.tools !== undefined) upstreamBody.tools = body.tools;
  if (body.tool_choice !== undefined) upstreamBody.tool_choice = body.tool_choice;

  const isStreaming = body.stream === true;

  try {
    const upstreamRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://nanogen.sylusai.com",
        "X-Title": "Nanogen API",
      },
      body: JSON.stringify(upstreamBody),
    });

    // ── Handle streaming response ─────────────────────────────────
    if (isStreaming && upstreamRes.ok && upstreamRes.body) {
      // Log usage (best-effort) — for streaming we log at start
      logApiUsage({
        keyId: keyRow.id,
        userId: keyRow.user_id,
        modelSlug: model,
        endpoint: "/v1/chat/completions",
        statusCode: 200,
        latencyMs: Date.now() - start,
        ip,
      });

      return new Response(upstreamRes.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-RateLimit-Remaining-RPM": String(rl.remaining?.rpm ?? ""),
          "X-RateLimit-Remaining-RPD": String(rl.remaining?.rpd ?? ""),
        },
      });
    }

    // ── Handle non-streaming response ─────────────────────────────
    const responseText = await upstreamRes.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { error: { message: responseText || `Upstream HTTP ${upstreamRes.status}` } };
    }

    // If upstream returned an error, forward it transparently
    if (!upstreamRes.ok) {
      logApiUsage({
        keyId: keyRow.id,
        userId: keyRow.user_id,
        modelSlug: model,
        endpoint: "/v1/chat/completions",
        statusCode: upstreamRes.status,
        latencyMs: Date.now() - start,
        ip,
      });

      return NextResponse.json(responseJson, {
        status: upstreamRes.status,
        headers: {
          "X-RateLimit-Remaining-RPM": String(rl.remaining?.rpm ?? ""),
          "X-RateLimit-Remaining-RPD": String(rl.remaining?.rpd ?? ""),
        },
      });
    }

    // Success — log and return
    logApiUsage({
      keyId: keyRow.id,
      userId: keyRow.user_id,
      modelSlug: model,
      endpoint: "/v1/chat/completions",
      statusCode: 200,
      latencyMs: Date.now() - start,
      ip,
    });

    return NextResponse.json(responseJson, {
      headers: {
        "X-RateLimit-Remaining-RPM": String(rl.remaining?.rpm ?? ""),
        "X-RateLimit-Remaining-RPD": String(rl.remaining?.rpd ?? ""),
      },
    });
  } catch (e) {
    console.error("API v1/chat/completions error:", e);
    logApiUsage({
      keyId: keyRow.id,
      userId: keyRow.user_id,
      modelSlug: model,
      endpoint: "/v1/chat/completions",
      statusCode: 500,
      latencyMs: Date.now() - start,
      ip,
    });

    return NextResponse.json(
      {
        error: {
          message: "Failed to connect to upstream provider",
          type: "server_error",
          code: "upstream_error",
        },
      },
      { status: 502 },
    );
  }
}
