// src/app/api/v1/models/route.js
//
// Public API — list available image models.
// Authenticated via Bearer token (ngn_xxx API key).
// Returns enabled image models without any secrets.

import { NextResponse } from "next/server";
import { validateApiKey, logApiUsage } from "@/lib/db/apiKeys";
import { listEnabledModels } from "@/lib/db/models";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const start = Date.now();
  const auth = req.headers.get("authorization") || "";
  const rawKey = auth.replace(/^Bearer\s+/i, "").trim();

  const keyRow = await validateApiKey(rawKey);
  if (!keyRow) {
    return NextResponse.json(
      { error: "Invalid or expired API key" },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    const models = await listEnabledModels(admin);

    // If the key has scopes, filter to only those models
    let filtered = models;
    if (keyRow.scopes && keyRow.scopes.length > 0) {
      filtered = models.filter((m) => keyRow.scopes.includes(m.slug));
    }

    const result = filtered.map((m) => ({
      slug: m.slug,
      label: m.label,
      kind: m.kind,
      provider: m.provider,
      modelId: m.modelId,
    }));

    // Log usage (best-effort)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    logApiUsage({
      keyId: keyRow.id,
      userId: keyRow.user_id,
      endpoint: "/v1/models",
      statusCode: 200,
      latencyMs: Date.now() - start,
      ip,
    });

    return NextResponse.json({ models: result });
  } catch (e) {
    console.error("API v1/models error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
