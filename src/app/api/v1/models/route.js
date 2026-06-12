// src/app/api/v1/models/route.js
//
// Public API — list available models from OpenRouter.
// Authenticated via Bearer token (ngn_xxx API key).
// Returns all OpenRouter models in an OpenAI-compatible format.
//
// This endpoint fetches from OpenRouter's model listing and caches
// the result for 5 minutes to avoid excessive upstream calls.

import { NextResponse } from "next/server";
import { validateApiKey, logApiUsage } from "@/lib/db/apiKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── In-memory cache for OpenRouter models ──────────────────────────
let cachedModels = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchOpenRouterModels() {
  const now = Date.now();
  if (cachedModels && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedModels;
  }

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`OpenRouter models API returned ${res.status}`);
  }

  const json = await res.json();
  cachedModels = json.data || [];
  cacheTimestamp = now;
  return cachedModels;
}

export async function GET(req) {
  const start = Date.now();
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

  try {
    const models = await fetchOpenRouterModels();

    // Transform to OpenAI-compatible format
    const result = models.map((m) => ({
      id: m.id,
      object: "model",
      created: m.created || Math.floor(Date.now() / 1000),
      owned_by: m.id?.split("/")[0] || "openrouter",
      name: m.name || m.id,
      description: m.description || null,
      context_length: m.context_length || null,
      pricing: m.pricing || null,
      top_provider: m.top_provider || null,
      architecture: m.architecture || null,
    }));

    // Log usage (best-effort)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    logApiUsage({
      keyId: keyRow.id,
      userId: keyRow.user_id,
      endpoint: "/v1/models",
      statusCode: 200,
      latencyMs: Date.now() - start,
      ip,
    });

    return NextResponse.json({
      object: "list",
      data: result,
    });
  } catch (e) {
    console.error("API v1/models error:", e);
    return NextResponse.json(
      {
        error: {
          message: "Failed to fetch models from provider",
          type: "server_error",
          code: "upstream_error",
        },
      },
      { status: 502 },
    );
  }
}
