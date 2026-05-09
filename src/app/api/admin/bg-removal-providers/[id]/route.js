// src/app/api/admin/bg-removal-providers/[id]/route.js

import { NextResponse } from "next/server";
import { validateAdminRole, validateString } from "@/lib/server/security";
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
    const { supabase } = await validateAdminRole();
    const { id } = await params;
    const body = await req.json();
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
    return NextResponse.json({ error: error.message }, { status: error.status || 400 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { supabase } = await validateAdminRole();
    const { id } = await params;
    await deleteBgRemovalProvider(supabase, id);
    return NextResponse.json({ message: "Provider deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 400 });
  }
}
