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
import {
  readJson,
  originAllowed,
  rateLimit,
  clientKey,
  ValidationError,
  errorResponse
} from "@/lib/server/security";

export const runtime = "nodejs";
// Always evaluate per-request — never cached at the edge / by Next.js.
export const dynamic = "force-dynamic";

function normalizePagination(url) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const requestedPageSize = Number(url.searchParams.get("pageSize") || 20);
  const pageSize = Math.min(50, Math.max(1, requestedPageSize));
  return {
    page,
    pageSize,
    from: (page - 1) * pageSize,
    to: (page - 1) * pageSize + pageSize - 1,
  };
}

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
    // Credit-health telemetry (migration 0015). Undefined on projects
    // that haven't applied it yet — coerced to null so the UI is stable.
    creditStatus:    row.credit_status ?? null,
    creditDetail:    row.credit_detail ?? null,
    creditCheckedAt: row.credit_checked_at ?? null,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

export async function GET(req) {
  try {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;

    const url = new URL(req.url);
    const { page, pageSize, from, to } = normalizePagination(url);

    const adminDb = createAdminClient();
    const { data, error, count } = await adminDb
      .from("models")
      .select("*", { count: "exact" })
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .range(from, to);
    if (error) {
      console.error("Admin models GET error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Strip sensitive headers from cache layers.
    const total = count ?? 0;
    const res = NextResponse.json({
      models: (data || []).map(sanitizeModel),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

const ALLOWED_KIND = new Set(["image", "text"]);
const SLUG_RE      = /^[a-z0-9][a-z0-9-]{0,63}$/;
const URL_RE       = /^https?:\/\/[^\s<>"'`]+$/i;

function validateInsert(body) {
  if (typeof body.slug !== "string" || !SLUG_RE.test(body.slug)) throw new ValidationError("Invalid slug");
  if (typeof body.label !== "string" || !body.label.trim() || body.label.length > 120) throw new ValidationError("Invalid label");
  if (!ALLOWED_KIND.has(body.kind)) throw new ValidationError("Invalid kind");
  if (typeof body.provider !== "string" || body.provider.length > 60) throw new ValidationError("Invalid provider");
  if (typeof body.modelId !== "string" || !body.modelId.trim() || body.modelId.length > 200) throw new ValidationError("Invalid modelId");
  if (body.config && (typeof body.config !== "object" || Array.isArray(body.config))) throw new ValidationError("Invalid config");
  if (body.config?.endpoint && !URL_RE.test(body.config.endpoint)) throw new ValidationError("Invalid endpoint URL");
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
  try {
    // 1. CSRF check
    if (!originAllowed(req)) {
      throw new ValidationError("CSRF block: Origin or referer not allowed", 403);
    }

    const gate = await requireAdmin();
    if (gate.error) return gate.error;
    const { user } = gate;

    // 2. Rate Limit (admin config changes capped to 60 requests per minute)
    const key = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-models-post:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    // 3. Capped JSON parse (max 64 KB for models body registry config)
    const body = await readJson(req, { maxBytes: 64 * 1024 });

    let row = validateInsert(body);

    const adminDb = createAdminClient();
    const { data, error } = await adminDb
      .from("models")
      .insert(row)
      .select("*")
      .single();
    if (error) {
      console.error("Admin models POST insert error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ model: sanitizeModel(data) });
  } catch (e) {
    return errorResponse(e);
  }
}
