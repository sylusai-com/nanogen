// src/app/api/admin/bg-removal-providers/route.js
// Admin endpoints for managing background-removal providers.

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
  listAllBgRemovalProviders,
  createBgRemovalProvider,
} from "@/lib/db/bgRemovalProviders";

const VALID_TYPES = ["removebg", "clipdrop", "photoroom", "custom"];

function sanitize(provider) {
  if (!provider) return provider;
  return { ...provider, hasApiKey: !!provider.api_key, api_key: undefined };
}

export async function GET(req) {
  try {
    const { supabase } = await validateAdminRole();
    const providers = await listAllBgRemovalProviders(supabase);
    return NextResponse.json({ providers: providers.map(sanitize) });
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
    const { ok, retryAfter } = rateLimit({ key: `admin-bg-removal-providers-post:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    // 3. Capped JSON parse (max 32 KB for provider creation body)
    const body = await readJson(req, { maxBytes: 32 * 1024 });

    const name = validateString(body.name, { name: "name", min: 1, max: 255, required: true });
    const type = validateString(body.type, { name: "type", max: 50, required: true });

    if (!VALID_TYPES.includes(type)) {
      throw new ValidationError("Invalid provider type", 400);
    }

    // Custom providers may legitimately have no key (open endpoints) and
    // a self-hosted endpoint URL is required for them. The branded
    // providers (removebg / clipdrop / photoroom) use a default endpoint
    // when none is supplied.
    const apiKey = body.api_key
      ? validateString(body.api_key, { name: "api_key", max: 1000 })
      : null;
    const apiEndpoint = body.api_endpoint
      ? validateString(body.api_endpoint, { name: "api_endpoint", max: 500 })
      : null;

    if (type === "custom" && !apiEndpoint) {
      throw new ValidationError("Custom providers must declare an endpoint", 400);
    }
    if (type !== "custom" && !apiKey) {
      throw new ValidationError("API key is required", 400);
    }

    const provider = await createBgRemovalProvider(supabase, {
      name,
      type,
      api_key: apiKey,
      api_endpoint: apiEndpoint,
      config: body.config || {},
      created_by: user.id,
    });

    return NextResponse.json({ provider: sanitize(provider) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
