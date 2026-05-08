// src/app/api/admin/connections/route.js
// Admin diagnostics for DB, model, and provider connectivity

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateAdminRole } from "@/lib/server/security";
import {
  getEnabledTextModelByRefWithSecrets,
  listEnabledTextModelsWithSecrets,
  listImageModelsWithSecrets,
} from "@/lib/db/models";
import { fetchBgImageFromProvider } from "@/lib/db/bgImageProviders";
import { callOpenRouter, extractJson } from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function summarizeError(error) {
  return {
    ok: false,
    message: error?.message || String(error),
    status: error?.status || 500,
  };
}

async function testTextModel(adminClient, ref) {
  const model = await getEnabledTextModelByRefWithSecrets(adminClient, ref);
  if (!model) {
    throw new Error("Model not found or not enabled");
  }
  if (!model.config?.apiKey && !model.config?.api_key) {
    throw new Error("Model is missing an API key");
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
    model: {
      id: model.id,
      slug: model.slug,
      label: model.label,
      provider: model.provider,
      modelId: model.modelId,
    },
    response: parsed,
  };
}

async function testBgProvider(adminClient, id) {
  const { data: provider, error } = await adminClient
    .from("bg_image_providers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!provider) throw new Error("Provider not found");

  const result = await fetchBgImageFromProvider(provider, "business", "abstract banner background");
  return {
    ok: true,
    provider: {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      endpoint: provider.api_endpoint,
    },
    image: result,
  };
}

export async function GET() {
  try {
    await validateAdminRole();
    const adminClient = createAdminClient();

    const [textModels, imageModels, providersRes] = await Promise.all([
      listEnabledTextModelsWithSecrets(adminClient).catch(() => []),
      listImageModelsWithSecrets(adminClient).catch(() => []),
      adminClient
        .from("bg_image_providers")
        .select("id", { count: "exact" })
        .eq("enabled", true),
    ]);

    return NextResponse.json({
      ok: true,
      database: true,
      models: {
        enabledText: textModels.length,
        enabledImage: imageModels.length,
      },
      bgProviders: providersRes?.count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(summarizeError(error), { status });
  }
}

export async function POST(req) {
  try {
    await validateAdminRole();
    const adminClient = createAdminClient();
    const body = await req.json().catch(() => ({}));
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
      if (!ref) throw new Error("modelRef is required");
      const result = await testTextModel(adminClient, ref);
      return NextResponse.json({ ok: true, action, result });
    }

    if (action === "provider") {
      const id = String(body.providerId || "").trim();
      if (!id) throw new Error("providerId is required");
      const result = await testBgProvider(adminClient, id);
      return NextResponse.json({ ok: true, action, result });
    }

    if (action === "flow") {
      const ref = String(body.modelRef || body.modelId || body.slug || "").trim();
      const providerId = String(body.providerId || "").trim();
      if (!ref) throw new Error("modelRef is required");
      const modelResult = await testTextModel(adminClient, ref);
      let providerResult = null;
      if (providerId) {
        providerResult = await testBgProvider(adminClient, providerId);
      }
      return NextResponse.json({ ok: true, action, result: { model: modelResult, provider: providerResult } });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const status = error.status || 400;
    return NextResponse.json(summarizeError(error), { status });
  }
}
