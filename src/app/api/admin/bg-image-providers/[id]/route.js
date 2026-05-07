// src/app/api/admin/bg-image-providers/[id]/route.js
// Individual background image provider management

import { createClient } from "@/lib/supabase/server";
import { validateAdminRole, validateString } from "@/lib/server/security";
import { updateBgImageProvider, deleteBgImageProvider } from "@/lib/db/bgImageProviders";

export async function PATCH(req, { params }) {
  try {
    const supabase = createClient();
    await validateAdminRole(supabase);

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
    return Response.json({ provider });
  } catch (error) {
    const status = error.message.includes("not authorized") ? 403 : 400;
    return Response.json({ error: error.message }, { status });
  }
}

export async function DELETE(req, { params }) {
  try {
    const supabase = createClient();
    await validateAdminRole(supabase);

    const { id } = params;
    await deleteBgImageProvider(supabase, id);
    return Response.json({ message: "Provider deleted" });
  } catch (error) {
    const status = error.message.includes("not authorized") ? 403 : 400;
    return Response.json({ error: error.message }, { status });
  }
}
