// src/app/api/admin/models/[id]/route.js
//
// Admin-only single-model endpoint. PUT merges the request body into the
// existing model row — including config — server-side so the apiKey can
// be preserved across edits without ever leaving the server.
//
// DELETE removes the model. POST is not used; create goes through the
// /api/admin/models collection endpoint.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
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

const ALLOWED_KIND     = new Set(["image", "text"]);
const SLUG_RE          = /^[a-z0-9][a-z0-9-]{0,63}$/;
const URL_RE           = /^https?:\/\/[^\s<>"'`]+$/i;

// Strict per-field validation for the patch body. Anything outside this
// set is dropped — defends against schema drift via crafted requests.
function validatePatch(body) {
  const out = {};
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string" || !SLUG_RE.test(body.slug)) throw new Error("Invalid slug");
    out.slug = body.slug;
  }
  if (body.label !== undefined) {
    if (typeof body.label !== "string" || body.label.length > 120) throw new Error("Invalid label");
    out.label = body.label.trim();
  }
  if (body.kind !== undefined) {
    if (!ALLOWED_KIND.has(body.kind)) throw new Error("Invalid kind");
    out.kind = body.kind;
  }
  if (body.provider !== undefined) {
    if (typeof body.provider !== "string" || body.provider.length > 60) throw new Error("Invalid provider");
    out.provider = body.provider.trim();
  }
  if (body.modelId !== undefined) {
    if (typeof body.modelId !== "string" || body.modelId.length > 200) throw new Error("Invalid modelId");
    out.model_id = body.modelId.trim();
  }
  if (body.enabled   !== undefined) out.enabled    = !!body.enabled;
  if (body.isDefault !== undefined) out.is_default = !!body.isDefault;
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) throw new Error("Invalid sortOrder");
    out.sort_order = Math.round(n);
  }
  if (body.previewGradient !== undefined) {
    if (body.previewGradient !== null && typeof body.previewGradient !== "string") {
      throw new Error("Invalid previewGradient");
    }
    out.preview_gradient = body.previewGradient || null;
  }
  if (body.config !== undefined) {
    if (typeof body.config !== "object" || Array.isArray(body.config)) {
      throw new Error("Invalid config");
    }
    if (body.config.endpoint && !URL_RE.test(body.config.endpoint)) {
      throw new Error("Invalid endpoint URL");
    }
    if (body.config.apiKey && typeof body.config.apiKey !== "string") {
      throw new Error("Invalid apiKey");
    }
    out._config = body.config;
  }
  return out;
}

export async function PUT(req, { params }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  let patch;
  try { patch = validatePatch(body); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }

  const adminDb = createAdminClient();

  // Merge config: pull existing row first so we can preserve apiKey
  // when the form sends the __preserveApiKey sentinel (i.e. the admin
  // didn't retype it).
  if (patch._config) {
    const { data: existing } = await adminDb
      .from("models")
      .select("config")
      .eq("id", id)
      .maybeSingle();
    const existingCfg = existing?.config || {};
    const incoming    = { ...patch._config };
    const preserve    = !!incoming.__preserveApiKey;
    delete incoming.__preserveApiKey;

    const merged = { ...incoming };
    if (preserve && existingCfg.apiKey) merged.apiKey = existingCfg.apiKey;
    if (preserve && existingCfg.api_key && !merged.apiKey) merged.apiKey = existingCfg.api_key;

    patch.config = merged;
    delete patch._config;
  }

  const { error } = await adminDb.from("models").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_req, { params }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const adminDb = createAdminClient();
  const { data, error } = await adminDb
    .from("models")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sanitize config: remove any API key fields before returning to the browser.
  const cfg = data.config || {};
  const hasApiKey = !!(cfg.apiKey || cfg.api_key || cfg.openrouterApiKey || cfg.openrouter_api_key);
  const safeConfig = { ...cfg };
  delete safeConfig.apiKey;
  delete safeConfig.api_key;
  delete safeConfig.openrouterApiKey;
  delete safeConfig.openrouter_api_key;

  const out = {
    id:              data.id,
    slug:            data.slug,
    label:           data.label,
    kind:            data.kind,
    provider:        data.provider,
    modelId:         data.model_id,
    enabled:         data.enabled,
    isDefault:       data.is_default,
    sortOrder:       data.sort_order,
    previewGradient: data.preview_gradient,
    config:          safeConfig,
    hasApiKey,
    createdAt:       data.created_at,
    updatedAt:       data.updated_at,
  };

  const res = NextResponse.json({ model: out });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function DELETE(_req, { params }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const adminDb = createAdminClient();
  const { error } = await adminDb.from("models").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
