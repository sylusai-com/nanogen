// src/app/api/admin/bg-image-providers/[id]/route.js
// Individual background image provider management

import { NextResponse } from "next/server";
import { validateAdminRole, validateString } from "@/lib/server/security";
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
    const { supabase } = await validateAdminRole();

    const { id } = params;
    const body = await req.json();
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
    const status = error.status || 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { supabase } = await validateAdminRole();

    const { id } = params;
    await deleteBgImageProvider(supabase, id);
    return NextResponse.json({ message: "Provider deleted" });
  } catch (error) {
    const status = error.status || 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
