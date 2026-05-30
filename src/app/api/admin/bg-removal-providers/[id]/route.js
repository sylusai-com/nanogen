// src/app/api/admin/bg-removal-providers/[id]/route.js

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
  updateBgRemovalProvider,
  deleteBgRemovalProvider,
} from "@/lib/db/bgRemovalProviders";

function sanitize(provider) {
  if (!provider) return provider;
  return { ...provider, hasApiKey: !!provider.api_key, api_key: undefined };
}

export async function PATCH(req, { params }) {
  try {
    // 1. CSRF check
    if (!originAllowed(req)) {
      throw new ValidationError("CSRF block: Origin or referer not allowed", 403);
    }

    const { supabase, user } = await validateAdminRole();

    // 2. Rate Limit (60 requests per minute)
    const key = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-bg-removal-providers-id-patch:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      throw new ValidationError("Provider ID is required", 400);
    }

    // 3. Capped JSON parse (max 32 KB for provider updates body data)
    const body = await readJson(req, { maxBytes: 32 * 1024 });
    const updates = {};

    if (body.name !== undefined) updates.name = validateString(body.name, { name: "name", min: 1, max: 255 });
    if (body.api_key !== undefined && body.api_key !== "") {
      updates.api_key = validateString(body.api_key, { name: "api_key", max: 1000 });
    }
    if (body.api_endpoint !== undefined) {
      updates.api_endpoint = body.api_endpoint
        ? validateString(body.api_endpoint, { name: "api_endpoint", max: 500 })
        : null;
    }
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
    if (body.config !== undefined) updates.config = body.config;
    updates.updated_at = new Date().toISOString();

    const provider = await updateBgRemovalProvider(supabase, id, updates);
    return NextResponse.json({ provider: sanitize(provider) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req, { params }) {
  try {
    // 1. CSRF check
    if (!originAllowed(req)) {
      throw new ValidationError("CSRF block: Origin or referer not allowed", 403);
    }

    const { supabase, user } = await validateAdminRole();

    // 2. Rate Limit (60 requests per minute)
    const key = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-bg-removal-providers-id-delete:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      throw new ValidationError("Provider ID is required", 400);
    }

    await deleteBgRemovalProvider(supabase, id);
    return NextResponse.json({ message: "Provider deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}
