// src/app/api/admin/prompt/route.js
//
// Admin-only endpoint for the banner-generation system prompt.
//
//   GET  — returns the current active system prompt (and a copy of the
//          built-in default for reference).
//   PUT  — overwrites the active system prompt. Body: { value: string }.
//          Caller must be an admin; we re-verify against the profiles
//          table even though RLS already gates the table.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SYSTEM_PROMPT_KEY,
  getSetting,
  upsertSetting,
} from "@/lib/db/settings";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/bannerTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const MAX_PROMPT_BYTES = 64 * 1024; // 64KB — generous; the default is ~3KB.

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const adminDb = createAdminClient();
  const row = await getSetting(adminDb, SYSTEM_PROMPT_KEY);

  const res = NextResponse.json({
    key:          SYSTEM_PROMPT_KEY,
    value:        row?.value || DEFAULT_SYSTEM_PROMPT,
    description:  row?.description || null,
    isCustomized: !!row?.value && row.value !== DEFAULT_SYSTEM_PROMPT,
    updatedAt:    row?.updated_at || null,
    updatedBy:    row?.updated_by || null,
    defaultValue: DEFAULT_SYSTEM_PROMPT,
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

  const value = body?.value;
  if (typeof value !== "string" || !value.trim()) {
    return NextResponse.json({ error: "value must be a non-empty string" }, { status: 400 });
  }
  if (Buffer.byteLength(value, "utf8") > MAX_PROMPT_BYTES) {
    return NextResponse.json({ error: "Prompt is too large" }, { status: 413 });
  }

  const adminDb = createAdminClient();
  try {
    const row = await upsertSetting(adminDb, {
      key:         SYSTEM_PROMPT_KEY,
      value,
      description: typeof body.description === "string" ? body.description : undefined,
      updatedBy:   gate.user.id,
    });
    return NextResponse.json({
      key:         row.key,
      value:       row.value,
      description: row.description,
      updatedAt:   row.updated_at,
      updatedBy:   row.updated_by,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Failed to save prompt" }, { status: 500 });
  }
}

// DELETE — revert to the in-code default by removing the row.
export async function DELETE() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("app_settings")
    .delete()
    .eq("key", SYSTEM_PROMPT_KEY);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: DEFAULT_SYSTEM_PROMPT });
}
