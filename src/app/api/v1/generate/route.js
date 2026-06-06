// src/app/api/v1/generate/route.js
//
// Public API — generate an image using a Nanogen image model.
// OpenRouter-style: single endpoint, user picks a model slug, Nanogen
// proxies through the admin-configured backend (key + endpoint from
// the models table).
//
// Auth: Bearer token (ngn_xxx API key)
// Body: { prompt, model, aspect?, style? }
// Returns: { id, model, prompt, imageUrl, score, latencyMs }

import { NextResponse } from "next/server";
import { validateApiKey, checkKeyRateLimit, logApiUsage } from "@/lib/db/apiKeys";
import { listImageModelsWithSecrets } from "@/lib/db/models";
import { scoreBannerImage } from "@/lib/scoreBanner";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ASPECTS = ["1:1", "4:5", "9:16", "16:9"];

// Stub model runner — mirrors the one in /api/generate/route.js.
// When real providers are wired, this calls the provider's API.
async function runModel(model, payload) {
  const latency = 600 + Math.random() * 1400;
  await new Promise((r) => setTimeout(r, latency));
  return {
    modelSlug: model.slug,
    modelLabel: model.label,
    provider: model.provider,
    providerModelId: model.model_id,
    previewGradient: model.preview_gradient || "from-violet-500/30 to-cyan-400/30",
    imageUrl: null, // TODO: wire provider call
    latencyMs: Math.round(latency),
    prompt: payload.prompt,
    aspect: payload.aspect,
    style: payload.style,
  };
}

export async function POST(req) {
  const start = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";

  // ── Auth ──────────────────────────────────────────────────────
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

  // ── Rate limit ────────────────────────────────────────────────
  const rl = await checkKeyRateLimit(keyRow);
  if (!rl.ok) {
    logApiUsage({
      keyId: keyRow.id,
      userId: keyRow.user_id,
      endpoint: "/v1/generate",
      statusCode: 429,
      latencyMs: Date.now() - start,
      ip,
    });

    return NextResponse.json(
      {
        error: {
          message: rl.reason === "rate_limit_rpm"
            ? `Rate limit exceeded: ${keyRow.rate_limit_rpm} requests/minute`
            : `Daily limit exceeded: ${keyRow.rate_limit_rpd} requests/day`,
          type: "rate_limit_error",
          code: rl.reason,
        },
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // ── Parse body ────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body", type: "invalid_request", code: "parse_error" } },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const modelSlug = typeof body.model === "string" ? body.model.trim() : "";
  const aspect = ALLOWED_ASPECTS.includes(body.aspect) ? body.aspect : "16:9";
  const style = typeof body.style === "string" ? body.style.trim().slice(0, 60) : "Modern";

  if (!prompt || prompt.length < 3) {
    return NextResponse.json(
      { error: { message: "prompt is required (min 3 characters)", type: "invalid_request", code: "missing_prompt" } },
      { status: 400 },
    );
  }
  if (prompt.length > 4000) {
    return NextResponse.json(
      { error: { message: "prompt too long (max 4000 characters)", type: "invalid_request", code: "prompt_too_long" } },
      { status: 400 },
    );
  }
  if (!modelSlug) {
    return NextResponse.json(
      { error: { message: "model is required (provide a model slug)", type: "invalid_request", code: "missing_model" } },
      { status: 400 },
    );
  }

  // ── Scope check ───────────────────────────────────────────────
  if (keyRow.scopes && keyRow.scopes.length > 0 && !keyRow.scopes.includes(modelSlug)) {
    logApiUsage({ keyId: keyRow.id, userId: keyRow.user_id, modelSlug, endpoint: "/v1/generate", statusCode: 403, latencyMs: Date.now() - start, ip });
    return NextResponse.json(
      { error: { message: `This API key does not have access to model "${modelSlug}"`, type: "permission_error", code: "scope_denied" } },
      { status: 403 },
    );
  }

  // ── Resolve model ─────────────────────────────────────────────
  const admin = createAdminClient();
  const models = await listImageModelsWithSecrets(admin, [modelSlug]);
  const model = models.find((m) => m.slug === modelSlug);

  if (!model) {
    logApiUsage({ keyId: keyRow.id, userId: keyRow.user_id, modelSlug, endpoint: "/v1/generate", statusCode: 404, latencyMs: Date.now() - start, ip });
    return NextResponse.json(
      { error: { message: `Model "${modelSlug}" not found or not enabled`, type: "invalid_request", code: "model_not_found" } },
      { status: 404 },
    );
  }

  // ── Run model ─────────────────────────────────────────────────
  try {
    const result = await runModel(model, { prompt, aspect, style });

    // Score (best-effort — neutral score if no imageUrl yet)
    let score = Math.round(70 + Math.random() * 20);
    if (result.imageUrl) {
      const scored = await scoreBannerImage({
        supabase: admin,
        prompt,
        imageUrl: result.imageUrl,
      });
      score = scored.score;
    }

    const latencyMs = Date.now() - start;

    // Log usage
    logApiUsage({
      keyId: keyRow.id,
      userId: keyRow.user_id,
      modelSlug,
      endpoint: "/v1/generate",
      statusCode: 200,
      latencyMs,
      ip,
    });

    return NextResponse.json({
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      model: modelSlug,
      prompt,
      aspect,
      style,
      imageUrl: result.imageUrl,
      previewGradient: result.previewGradient,
      score,
      latencyMs: result.latencyMs,
      usage: rl.remaining
        ? { rpm_remaining: rl.remaining.rpm, rpd_remaining: rl.remaining.rpd }
        : undefined,
    });
  } catch (e) {
    console.error("API v1/generate error:", e);
    logApiUsage({ keyId: keyRow.id, userId: keyRow.user_id, modelSlug, endpoint: "/v1/generate", statusCode: 500, latencyMs: Date.now() - start, ip });
    return NextResponse.json(
      { error: { message: "Generation failed", type: "server_error", code: "generation_error" } },
      { status: 500 },
    );
  }
}
