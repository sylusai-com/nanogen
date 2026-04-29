// src/app/api/admin/models/route.js
//
// Admin-only model registry endpoint.
//
// GET — returns the full list of models WITH their config blob, except
//   the `apiKey` is replaced by a `hasApiKey` boolean. The browser never
//   sees raw API keys — but admins can still pre-populate the endpoint
//   and free-form extras when editing a row.
//
// Auth model: this route uses the cookie-bound server client to identify
// the caller, then independently verifies the admin role from `profiles`
// before answering. RLS would block writes either way, but column-level
// secrecy isn't enforceable through Supabase select alone — so the gate
// lives here.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Always evaluate per-request — never cached at the edge / by Next.js.
export const dynamic = "force-dynamic";

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

function sanitizeModel(row) {
  const cfg = row.config || {};
  const hasApiKey = !!(cfg.apiKey || cfg.api_key);
  const safeConfig = { ...cfg };
  delete safeConfig.apiKey;
  delete safeConfig.api_key;
  delete safeConfig.openrouterApiKey;
  delete safeConfig.openrouter_api_key;
  return {
    id:              row.id,
    slug:            row.slug,
    label:           row.label,
    kind:            row.kind,
    provider:        row.provider,
    modelId:         row.model_id,
    enabled:         row.enabled,
    isDefault:       row.is_default,
    sortOrder:       row.sort_order,
    previewGradient: row.preview_gradient,
    config:          safeConfig,
    hasApiKey,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const adminDb = createAdminClient();
  const { data, error } = await adminDb
    .from("models")
    .select("*")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Strip sensitive headers from cache layers.
  const res = NextResponse.json({ models: (data || []).map(sanitizeModel) });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const ALLOWED_KIND = new Set(["image", "text"]);
const SLUG_RE      = /^[a-z0-9][a-z0-9-]{0,63}$/;
const URL_RE       = /^https?:\/\/[^\s<>"'`]+$/i;

function validateInsert(body) {
  if (typeof body.slug !== "string" || !SLUG_RE.test(body.slug)) throw new Error("Invalid slug");
  if (typeof body.label !== "string" || !body.label.trim() || body.label.length > 120) throw new Error("Invalid label");
  if (!ALLOWED_KIND.has(body.kind)) throw new Error("Invalid kind");
  if (typeof body.provider !== "string" || body.provider.length > 60) throw new Error("Invalid provider");
  if (typeof body.modelId !== "string" || !body.modelId.trim() || body.modelId.length > 200) throw new Error("Invalid modelId");
  if (body.config && (typeof body.config !== "object" || Array.isArray(body.config))) throw new Error("Invalid config");
  if (body.config?.endpoint && !URL_RE.test(body.config.endpoint)) throw new Error("Invalid endpoint URL");
  return {
    slug:      body.slug,
    label:     body.label.trim(),
    kind:      body.kind,
    provider:  body.provider.trim(),
    model_id:  body.modelId.trim(),
    enabled:   body.enabled !== false,
    is_default: body.kind === "text" ? !!body.isDefault : false,
    sort_order: Number.isFinite(Number(body.sortOrder)) ? Math.round(Number(body.sortOrder)) : 0,
    preview_gradient: body.kind === "image" ? (body.previewGradient || null) : null,
    config:    body.config || {},
  };
}

export async function POST(req) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  let row;
  try { row = validateInsert(body); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }

  const adminDb = createAdminClient();
  const { data, error } = await adminDb
    .from("models")
    .insert(row)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ model: sanitizeModel(data) });
}
