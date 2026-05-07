// src/app/api/admin/bg-image-providers/route.js
// Admin endpoints for managing background image providers

import { createClient } from "@/lib/supabase/server";
import { validateAdminRole, validateString } from "@/lib/server/security";
import {
  listBgImageProviders,
  createBgImageProvider,
  updateBgImageProvider,
  deleteBgImageProvider,
} from "@/lib/db/bgImageProviders";

export async function GET(req) {
  try {
    const supabase = createClient();
    await validateAdminRole(supabase);

    const providers = await listBgImageProviders(supabase);
    return Response.json({ providers });
  } catch (error) {
    const status = error.message.includes("not authorized") ? 403 : 500;
    return Response.json({ error: error.message }, { status });
  }
}

export async function POST(req) {
  try {
    const supabase = createClient();
    await validateAdminRole(supabase);

    const body = await req.json();
    const name = validateString(body.name, { name: "name", min: 1, max: 255 });
    const type = validateString(body.type, { name: "type", max: 50 });
    const apiKey = validateString(body.api_key, { name: "api_key", max: 1000 });
    const apiEndpoint = validateString(body.api_endpoint, { name: "api_endpoint", max: 500 });

    if (!["unsplash", "pexels", "pixabay", "custom"].includes(type)) {
      return Response.json({ error: "Invalid provider type" }, { status: 400 });
    }

    const { user } = await supabase.auth.getUser();
    const provider = await createBgImageProvider(supabase, {
      name,
      type,
      api_key: apiKey,
      api_endpoint: apiEndpoint,
      config: body.config || {},
      created_by: user.id,
    });

    return Response.json({ provider }, { status: 201 });
  } catch (error) {
    const status = error.message.includes("not authorized") ? 403 : 400;
    return Response.json({ error: error.message }, { status });
  }
}
