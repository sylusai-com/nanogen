// src/app/api/admin/bg-image-providers/route.js
// Admin endpoints for managing background image providers

import { NextResponse } from "next/server";
import {
  validateAdminRole,
  validateString,
  readJson,
  originAllowed,
  rateLimit,
  clientKey,
  ValidationError,
  errorResponse
} from "@/lib/server/security";
import {
  listAllBgImageProviders,
  createBgImageProvider,
} from "@/lib/db/bgImageProviders";

function sanitizeProvider(provider) {
  if (!provider) return provider;
  return {
    ...provider,
    hasApiKey: !!provider.api_key,
    api_key: undefined,
  };
}

export async function GET(req) {
  try {
    const { supabase } = await validateAdminRole();

    const providers = await listAllBgImageProviders(supabase);
    return NextResponse.json({ providers: providers.map(sanitizeProvider) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req) {
  try {
    // 1. CSRF check
    if (!originAllowed(req)) {
      throw new ValidationError("CSRF block: Origin or referer not allowed", 403);
    }

    const { supabase, user } = await validateAdminRole();

    // 2. Rate Limit (60 requests per minute)
    const key = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-bg-image-providers-post:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    // 3. Capped JSON parse (max 32 KB for provider body data)
    const body = await readJson(req, { maxBytes: 32 * 1024 });

    const name = validateString(body.name, { name: "name", min: 1, max: 255, required: true });
    const type = validateString(body.type, { name: "type", max: 50, required: true });
    const apiKey = validateString(body.api_key, { name: "api_key", max: 1000, required: true });
    const apiEndpoint = validateString(body.api_endpoint, { name: "api_endpoint", max: 500, required: true });

    if (!["unsplash", "pexels", "pixabay", "custom"].includes(type)) {
      throw new ValidationError("Invalid provider type", 400);
    }

    const provider = await createBgImageProvider(supabase, {
      name,
      type,
      api_key: apiKey,
      api_endpoint: apiEndpoint,
      config: body.config || {},
      created_by: user.id,
    });

    return NextResponse.json({ provider: sanitizeProvider(provider) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
