// src/app/api/admin/connections/route.js
// Admin diagnostics for DB, model, and provider connectivity

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readJson,
  originAllowed,
  rateLimit,
  clientKey,
  ValidationError,
  errorResponse,
  validateAdminRole
} from "@/lib/server/security";
import {
  getEnabledTextModelByRefWithSecrets,
  listEnabledTextModelsWithSecrets,
  listImageModelsWithSecrets,
} from "@/lib/db/models";
import { listAllBgImageProviders, fetchBgImageFromProvider } from "@/lib/db/bgImageProviders";
import { generateBannerBackground } from "@/lib/imageGen";
import { callOpenRouter, extractJson } from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeModel(model) {
  if (!model) return model;
  const cfg = model.config || {};
  return {
    id: model.id,
    slug: model.slug,
    label: model.label,
    kind: model.kind,
    provider: model.provider,
    modelId: model.modelId,
    enabled: model.enabled,
    isDefault: model.isDefault,
    sortOrder: model.sortOrder,
    previewGradient: model.previewGradient,
    hasApiKey: !!(cfg.apiKey || cfg.api_key),
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

function sanitizeProvider(provider) {
  if (!provider) return provider;
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    api_endpoint: provider.api_endpoint,
    enabled: provider.enabled,
    config: provider.config || {},
    hasApiKey: !!provider.api_key,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
  };
}

function summarizeError(error) {
  if (error instanceof ValidationError) {
    return {
      ok: false,
      message: error.message,
    };
  }
  console.error("Connection diagnostics DB/fetch error:", error);
  return {
    ok: false,
    message: "Internal server error",
  };
}

async function testTextModel(model) {
  if (!model) {
    throw new ValidationError("Model not found or not enabled");
  }
  if (!model.config?.apiKey && !model.config?.api_key) {
    throw new ValidationError("Model is missing an API key");
  }

  const apiKey = model.config.apiKey || model.config.api_key;
  const endpoint = model.config.endpoint || model.config.api_endpoint || model.config.baseUrl || model.config.base_url;
  const response = await callOpenRouter({
    apiKey,
    endpoint,
    model: model.modelId,
    messages: [
      {
        role: "user",
        content: "Reply with JSON: {\"ok\":true,\"model\":\"<model>\"}",
      },
    ],
    jsonMode: true,
    maxTokens: 64,
    temperature: 0,
  });

  const parsed = extractJson(response.content) || { raw: response.content };
  return {
    ok: true,
    model: sanitizeModel(model),
    response: parsed,
  };
}

async function testImageModel(model) {
  const result = await generateBannerBackground({
    imageModel: model,
    brief: "Admin connection check for image model diagnostics",
    style: "modern editorial",
    aspect: "16:9",
    referenceContext: null,
    subjectContext: null,
  });

  if (!result?.dataUrl) {
    throw new ValidationError(result?.error || "Image model failed");
  }

  return {
    ok: true,
    model: sanitizeModel(model),
    response: {
      modelLabel: result.modelLabel,
      modelId: result.modelId,
      provider: result.provider,
      dataUrlLength: result.dataUrl.length,
      dataUrlPreview: result.dataUrl.slice(0, 48),
    },
  };
}

async function testBgProvider(adminClient, id) {
  const { data: provider, error } = await adminClient
    .from("bg_image_providers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!provider) throw new ValidationError("Provider not found");

  const result = await fetchBgImageFromProvider(provider, "business", "abstract banner background");
  return {
    ok: true,
    provider: sanitizeProvider(provider),
    image: result,
  };
}

export async function GET(req) {
  try {
    const { user } = await validateAdminRole();

    // Rate Limit on diagnostics GET (max 20 per minute to prevent heavy diagnostic calls overloading system)
    const rateLimitKey = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-connections-get:${rateLimitKey}`, max: 20, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    const adminClient = createAdminClient();

    const [textModels, imageModels, providers] = await Promise.all([
      listEnabledTextModelsWithSecrets(adminClient).catch(() => []),
      listImageModelsWithSecrets(adminClient).catch(() => []),
      listAllBgImageProviders(adminClient).catch(() => []),
    ]);

    return NextResponse.json({
      ok: true,
      database: true,
      models: {
        text: textModels.map(sanitizeModel),
        image: imageModels.map(sanitizeModel),
        enabledText: textModels.length,
        enabledImage: imageModels.length,
      },
      providers: providers.map(sanitizeProvider),
      bgProviders: providers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(summarizeError(error), { status });
  }
}

export async function POST(req) {
  try {
    // 1. CSRF check
    if (!originAllowed(req)) {
      throw new ValidationError("CSRF block: Origin or referer not allowed", 403);
    }

    const { user } = await validateAdminRole();

    // 2. Rate Limit (max 10 heavy diagnostic updates per minute)
    const rateLimitKey = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-connections-post:${rateLimitKey}`, max: 10, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    const adminClient = createAdminClient();

    // 3. Capped JSON parse (max 8 KB for connection diagnostic body)
    const body = await readJson(req, { maxBytes: 8 * 1024 });

    const action = String(body.action || "").toLowerCase();

    if (action === "db") {
      const [{ error: modelError }, { error: providerError }] = await Promise.all([
        adminClient.from("models").select("id", { count: "exact", head: true }),
        adminClient.from("bg_image_providers").select("id", { count: "exact", head: true }),
      ]);
      if (modelError) throw modelError;
      if (providerError) throw providerError;
      return NextResponse.json({ ok: true, action, result: { database: true } });
    }

    if (action === "model") {
      const ref = String(body.modelRef || body.modelId || body.slug || "").trim();
      const kind = String(body.kind || "").trim();
      let model = null;
      if (kind === "image") {
        model = (await listImageModelsWithSecrets(adminClient)).find((item) => item.id === ref || item.slug === ref || item.modelId === ref);
      } else if (kind === "text") {
        model = await getEnabledTextModelByRefWithSecrets(adminClient, ref);
      } else {
        model = await getEnabledTextModelByRefWithSecrets(adminClient, ref);
        if (!model) {
          model = (await listImageModelsWithSecrets(adminClient)).find((item) => item.id === ref || item.slug === ref || item.modelId === ref);
        }
      }
      if (!model) throw new ValidationError("Model not found or not enabled", 404);
      const result = model.kind === "image" ? await testImageModel(model) : await testTextModel(model);
      return NextResponse.json({ ok: true, action, result });
    }

    if (action === "models") {
      const [textModels, imageModels] = await Promise.all([
        listEnabledTextModelsWithSecrets(adminClient).catch(() => []),
        listImageModelsWithSecrets(adminClient).catch(() => []),
      ]);
      const targets = [...textModels, ...imageModels];
      const settled = await Promise.allSettled(
        targets.map((model) => (model.kind === "image" ? testImageModel(model) : testTextModel(model))),
      );
      const results = settled.map((entry, index) => {
        const model = sanitizeModel(targets[index]);
        if (entry.status === "fulfilled") {
          return entry.value;
        }
        return {
          ok: false,
          model,
          error: entry.reason?.message || "Internal diagnostic failure",
        };
      });
      return NextResponse.json({
        ok: true,
        action,
        result: {
          total: results.length,
          passed: results.filter((item) => item.ok).length,
          failed: results.filter((item) => !item.ok).length,
          results,
        },
      });
    }

    if (action === "provider") {
      const id = String(body.providerId || "").trim();
      if (!id) throw new ValidationError("providerId is required");
      const result = await testBgProvider(adminClient, id);
      return NextResponse.json({ ok: true, action, result });
    }

    if (action === "providers") {
      const providers = await listAllBgImageProviders(adminClient).catch(() => []);
      const settled = await Promise.allSettled(providers.map((provider) => testBgProvider(adminClient, provider.id)));
      const results = settled.map((entry, index) => {
        const provider = sanitizeProvider(providers[index]);
        if (entry.status === "fulfilled") {
          return entry.value;
        }
        return {
          ok: false,
          provider,
          error: entry.reason?.message || "Internal diagnostic failure",
        };
      });
      return NextResponse.json({
        ok: true,
        action,
        result: {
          total: results.length,
          passed: results.filter((item) => item.ok).length,
          failed: results.filter((item) => !item.ok).length,
          results,
        },
      });
    }

    if (action === "flow") {
      const [modelsResult, providersResult] = await Promise.all([
        (async () => {
          const [textModels, imageModels] = await Promise.all([
            listEnabledTextModelsWithSecrets(adminClient).catch(() => []),
            listImageModelsWithSecrets(adminClient).catch(() => []),
          ]);
          const targets = [...textModels, ...imageModels];
          const settled = await Promise.allSettled(
            targets.map((model) => (model.kind === "image" ? testImageModel(model) : testTextModel(model))),
          );
          const results = settled.map((entry, index) => {
            const model = sanitizeModel(targets[index]);
            if (entry.status === "fulfilled") return entry.value;
            return { ok: false, model, error: entry.reason?.message || "Internal diagnostic failure" };
          });
          return {
            total: results.length,
            passed: results.filter((item) => item.ok).length,
            failed: results.filter((item) => !item.ok).length,
            results,
          };
        })(),
        (async () => {
          const providers = await listAllBgImageProviders(adminClient).catch(() => []);
          const settled = await Promise.allSettled(providers.map((provider) => testBgProvider(adminClient, provider.id)));
          const results = settled.map((entry, index) => {
            const provider = sanitizeProvider(providers[index]);
            if (entry.status === "fulfilled") return entry.value;
            return { ok: false, provider, error: entry.reason?.message || "Internal diagnostic failure" };
          });
          return {
            total: results.length,
            passed: results.filter((item) => item.ok).length,
            failed: results.filter((item) => !item.ok).length,
            results,
          };
        })(),
      ]);
      return NextResponse.json({ ok: true, action, result: { models: modelsResult, providers: providersResult } });
    }

    throw new ValidationError("Unknown action");
  } catch (error) {
    const status = error.status || 400;
    return NextResponse.json(summarizeError(error), { status });
  }
}
