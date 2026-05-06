// src/app/api/admin/prompt/route.js
//
// Admin-only endpoint for every LLM prompt the app sends.
//
//   GET    — returns the full prompt overview (current value, default,
//            customization metadata) for every key exposed by
//            src/lib/prompts.js. The admin UI renders itself from this
//            payload, so adding a new prompt only requires editing
//            prompts.js — no route changes needed.
//
//   PUT    — saves an override. Body: { key: string, value: string|object }.
//            `key` is the in-code key (e.g. "bannerSystem"); `value` is a
//            string for "string" prompts and any JSON-serializable shape
//            for "json" prompts. The route validates against PROMPTS so
//            unknown keys are rejected.
//
//   DELETE — removes the override and reverts to the in-code default.
//            Body or query: { key: string } — same key-space as PUT.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PROMPTS,
  deletePromptOverride,
  getAdminPromptOverview,
  isValidPromptKey,
  savePromptOverride,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROMPT_BYTES = 64 * 1024; // generous; the largest default is ~3KB

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

function validateValueShape(meta, value) {
  if (meta.kind === "string") {
    if (typeof value !== "string" || !value.trim()) {
      return "value must be a non-empty string";
    }
    if (Buffer.byteLength(value, "utf8") > MAX_PROMPT_BYTES) {
      return "value is too large";
    }
    return null;
  }
  if (meta.kind === "json") {
    if (value == null || typeof value !== "object") {
      return "value must be a JSON object";
    }
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, "utf8") > MAX_PROMPT_BYTES) {
      return "value is too large";
    }
    return null;
  }
  return `unsupported prompt kind: ${meta.kind}`;
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const adminDb  = createAdminClient();
  const overview = await getAdminPromptOverview(adminDb);

  const res = NextResponse.json({
    keys: Object.fromEntries(
      Object.entries(PROMPTS).map(([k, v]) => [k, v.dbKey]),
    ),
    prompts: overview,
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function PUT(req) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const key = body?.key;
  if (typeof key !== "string" || !isValidPromptKey(key)) {
    return NextResponse.json({ error: `Unknown prompt key: ${key}` }, { status: 400 });
  }

  const meta = PROMPTS[key];
  const reason = validateValueShape(meta, body.value);
  if (reason) {
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  try {
    const row = await savePromptOverride(createAdminClient(), {
      key,
      value:     body.value,
      updatedBy: gate.user.id,
    });
    return NextResponse.json({
      key,
      dbKey:        row.key,
      value:        body.value,
      isCustomized: true,
      updatedAt:    row.updated_at,
      updatedBy:    row.updated_by,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Failed to save prompt" }, { status: 500 });
  }
}

export async function DELETE(req) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  // Accept the key from either the JSON body or the query string. The
  // browser fetch wrapper sends DELETE with a body; curl users prefer
  // a query param.
  let key = null;
  try {
    const body = await req.clone().json().catch(() => null);
    key = body?.key || null;
  } catch { /* ignore */ }
  if (!key) {
    key = new URL(req.url).searchParams.get("key");
  }
  if (typeof key !== "string" || !isValidPromptKey(key)) {
    return NextResponse.json({ error: `Unknown prompt key: ${key}` }, { status: 400 });
  }

  try {
    const defaultValue = await deletePromptOverride(createAdminClient(), key);
    return NextResponse.json({
      key,
      value:        defaultValue,
      isCustomized: false,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Failed to revert prompt" }, { status: 500 });
  }
}
