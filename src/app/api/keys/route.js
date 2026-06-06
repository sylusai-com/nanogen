// src/app/api/keys/route.js
//
// REST endpoint for API key management (auth required).
//   GET  → list the user's API keys
//   POST → create a new key (returns plaintext once)
//   DELETE → revoke or delete a key

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey } from "@/lib/db/apiKeys";
import {
  errorResponse,
  originAllowed,
  readJson,
  validateString,
  ValidationError,
} from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────
// GET — list user's API keys
// ─────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await listApiKeys(supabase, user.id);
    return NextResponse.json({ keys });
  } catch (e) {
    return errorResponse(e);
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST — create a new API key
// ─────────────────────────────────────────────────────────────────────
export async function POST(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try { body = await readJson(req, { maxBytes: 4096 }); }
    catch (e) { return errorResponse(e); }

    const name = validateString(body.name, { name: "name", max: 60 }) || "Untitled key";

    // Validate scopes — must be an array of strings (model slugs)
    let scopes = [];
    if (Array.isArray(body.scopes)) {
      scopes = body.scopes
        .filter((s) => typeof s === "string" && s.length <= 64)
        .slice(0, 20);
    }

    // Limit to 10 active keys per user
    const existing = await listApiKeys(supabase, user.id);
    const activeCount = existing.filter((k) => k.is_active).length;
    if (activeCount >= 10) {
      return NextResponse.json(
        { error: "Maximum 10 active API keys allowed" },
        { status: 400 },
      );
    }

    const result = await createApiKey(supabase, user.id, { name, scopes });
    return NextResponse.json({ key: result }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

// ─────────────────────────────────────────────────────────────────────
// DELETE — revoke or permanently delete a key
// ─────────────────────────────────────────────────────────────────────
export async function DELETE(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try { body = await readJson(req, { maxBytes: 1024 }); }
    catch (e) { return errorResponse(e); }

    const keyId = validateString(body.keyId, { name: "keyId", required: true, max: 60 });
    const permanent = body.permanent === true;

    if (permanent) {
      await deleteApiKey(supabase, user.id, keyId);
    } else {
      await revokeApiKey(supabase, user.id, keyId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
