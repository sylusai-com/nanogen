// src/app/api/admin/bg-removal-providers/route.js
// Admin endpoints for managing background-removal providers.

import { NextResponse } from "next/server";
import { validateAdminRole, validateString } from "@/lib/server/security";
import {
  listAllBgRemovalProviders,
  createBgRemovalProvider,
} from "@/lib/db/bgRemovalProviders";

const VALID_TYPES = ["removebg", "clipdrop", "photoroom", "custom"];

function sanitize(provider) {
  if (!provider) return provider;
  return { ...provider, hasApiKey: !!provider.api_key, api_key: undefined };
}

export async function GET() {
  try {
    const { supabase } = await validateAdminRole();
    const providers = await listAllBgRemovalProviders(supabase);
    return NextResponse.json({ providers: providers.map(sanitize) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(req) {
  try {
    const { supabase, user } = await validateAdminRole();

    const body = await req.json();
    const name = validateString(body.name, { name: "name", min: 1, max: 255, required: true });
    const type = validateString(body.type, { name: "type", max: 50, required: true });

    if (!VALID_TYPES.includes(type)) {
      return Response.json({ error: "Invalid provider type" }, { status: 400 });
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
      return Response.json({ error: "Custom providers must declare an endpoint" }, { status: 400 });
    }
    if (type !== "custom" && !apiKey) {
      return Response.json({ error: "API key is required" }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: error.status || 400 });
  }
}
