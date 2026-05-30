// src/app/api/admin/bg-image-providers/[id]/route.js
// Individual background image provider management

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
import { updateBgImageProvider, deleteBgImageProvider } from "@/lib/db/bgImageProviders";

function sanitizeProvider(provider) {
  if (!provider) return provider;
  return {
    ...provider,
    hasApiKey: !!provider.api_key,
    api_key: undefined,
  };
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
    const { ok, retryAfter } = rateLimit({ key: `admin-bg-image-providers-id-patch:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    // Next.js 15+ delivers `params` as a Promise — destructuring it
    // synchronously yields `undefined` for `id` and silently fails the
    // update. Other admin route handlers in this app already await it
    // (models/[id], bg-removal-providers/[id]); this route was the
    // outlier, which is why the disable toggle and delete button on
    // /admin/bg-image-providers stopped working under the new runtime.
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      throw new ValidationError("Provider ID is required", 400);
    }

    // 3. Capped JSON parse (max 32 KB for provider updates body data)
    const body = await readJson(req, { maxBytes: 32 * 1024 });
    const updates = {};

    if (body.name !== undefined) updates.name = validateString(body.name, { name: "name", min: 1, max: 255 });
    if (body.api_key !== undefined) updates.api_key = validateString(body.api_key, { name: "api_key", max: 1000 });
    if (body.api_endpoint !== undefined) updates.api_endpoint = validateString(body.api_endpoint, { name: "api_endpoint", max: 500 });
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
    if (body.config !== undefined) updates.config = body.config;

    updates.updated_at = new Date().toISOString();

    const provider = await updateBgImageProvider(supabase, id, updates);
    return NextResponse.json({ provider: sanitizeProvider(provider) });
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
    const { ok, retryAfter } = rateLimit({ key: `admin-bg-image-providers-id-delete:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      throw new ValidationError("Provider ID is required", 400);
    }

    await deleteBgImageProvider(supabase, id);
    return NextResponse.json({ message: "Provider deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}
