// src/lib/db/models.js
// Models table queries. RLS allows everyone (incl. anon) to read enabled
// rows; only admins can write. Two column selectors:
//
//   PUBLIC_COLUMNS — safe to send to the browser. Excludes `config`,
//                    which contains the API key.
//   ADMIN_COLUMNS  — includes `config`. Server-side-only (admin pages
//                    use the secret-key client; banner-generation API
//                    routes use this when they need the apiKey).
//
// IMPORTANT: never call the `*Admin` variants from a "use client" file.
// Doing so would ship API keys to the user's browser.

const PUBLIC_COLUMNS = `
  id,
  slug,
  label,
  kind,
  provider,
  modelId:model_id,
  enabled,
  isDefault:is_default,
  sortOrder:sort_order,
  previewGradient:preview_gradient,
  hasApiKey:config,
  createdAt:created_at,
  updatedAt:updated_at
`;

const ADMIN_COLUMNS = `
  id,
  slug,
  label,
  kind,
  provider,
  modelId:model_id,
  enabled,
  isDefault:is_default,
  sortOrder:sort_order,
  previewGradient:preview_gradient,
  config,
  createdAt:created_at,
  updatedAt:updated_at
`;

// Removes the raw config blob from a public-shape row, leaving only a
// boolean `hasApiKey` flag derived from it. This makes admin UIs that
// run client-side (e.g. /admin/models) able to show "key configured?"
// without ever pulling the secret value down to the browser.
function publicShape(row) {
  if (!row) return row;
  const cfg = row.hasApiKey || {};
  const hasApiKey = !!(cfg.apiKey || cfg.api_key);
  return { ...row, hasApiKey, config: undefined };
}
function publicShapeMany(rows) {
  return (rows || []).map(publicShape);
}

// ─────────────────────────────────────────────────────────────────────
// PUBLIC reads — safe for browser code.
// ─────────────────────────────────────────────────────────────────────

export async function listImageModels(supabase) {
  const { data, error } = await supabase
    .from("models")
    .select(PUBLIC_COLUMNS)
    .eq("kind", "image")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return publicShapeMany(data);
}

export async function listAllModels(supabase) {
  const { data, error } = await supabase
    .from("models")
    .select(PUBLIC_COLUMNS)
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return publicShapeMany(data);
}

// Public list of every enabled text model — used by the dashboard's model
// picker so users can pick which LLM generates their banner. Returns the
// default model first, then the rest in sort order. Browser-safe: no
// secrets are returned.
export async function listEnabledTextModels(supabase) {
  const { data, error } = await supabase
    .from("models")
    .select(PUBLIC_COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return publicShapeMany(data);
}

// Generic enabled-model helper for server code that wants to list all
// enabled models of a given kind, or every enabled model when kind is null.
export async function listEnabledModels(supabase, { kind = null } = {}) {
  let query = supabase
    .from("models")
    .select(PUBLIC_COLUMNS)
    .eq("enabled", true)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true });

  if (kind) {
    query = query.eq("kind", kind);
  }

  const { data, error } = await query;
  if (error) throw error;
  return publicShapeMany(data);
}

// Public lookup — used by browser code (PromptForm, editor) to show
// which model is currently default. The browser does NOT need the API
// key — server routes resolve it via getDefaultTextModelWithSecrets.
export async function getDefaultTextModel(supabase) {
  const { data } = await supabase
    .from("models")
    .select(PUBLIC_COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .eq("is_default", true)
    .maybeSingle();
  if (data) return publicShape(data);
  const { data: any } = await supabase
    .from("models")
    .select(PUBLIC_COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return any ? publicShape(any) : null;
}

// ─────────────────────────────────────────────────────────────────────
// PRIVILEGED reads — server-only. The caller MUST pass either the
// admin (secret-key) client OR a server-side cookie-bound client whose
// user is verified as admin (RLS still applies — but RLS does not gate
// columns, so don't expose this from a public route).
// ─────────────────────────────────────────────────────────────────────

export async function getDefaultTextModelWithSecrets(adminClient) {
  const { data } = await adminClient
    .from("models")
    .select(ADMIN_COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .eq("is_default", true)
    .maybeSingle();
  if (data) return data;
  const { data: any } = await adminClient
    .from("models")
    .select(ADMIN_COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return any || null;
}

// Returns every enabled text model with its secret config blob — used by
// the multi-model fan-out path in /api/banners. Default model first, then
// the rest in sort_order. Server-only.
export async function listEnabledTextModelsWithSecrets(adminClient) {
  const { data, error } = await adminClient
    .from("models")
    .select(ADMIN_COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Server-only lookup of a single enabled text model (with secrets) by id
// or slug — used by /api/banners to resolve the model the user picked
// from the dashboard dropdown. Returns null when no enabled text row
// matches, so the caller can fall back to the multi-model fan-out.
export async function getEnabledTextModelByRefWithSecrets(adminClient, ref) {
  const value = String(ref || "").trim();
  if (!value) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const column = isUuid ? "id" : "slug";

  const { data, error } = await adminClient
    .from("models")
    .select(ADMIN_COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function listImageModelsWithSecrets(adminClient, slugs) {
  let q = adminClient
    .from("models")
    .select(ADMIN_COLUMNS)
    .eq("kind", "image")
    .eq("enabled", true);
  if (Array.isArray(slugs) && slugs.length) q = q.in("slug", slugs);
  const { data, error } = await q.order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────
// Mutations — admin-only via RLS. The form is rendered in the admin app
// (so the request is authenticated) and the API does the write via the
// signed-in user's client. The DB enforces the admin role.
// ─────────────────────────────────────────────────────────────────────

export async function createModel(supabase, model) {
  const { data, error } = await supabase
    .from("models")
    .insert(toRow(model))
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) throw error;
  return publicShape(data);
}

export async function updateModel(supabase, id, patch) {
  const { data, error } = await supabase
    .from("models")
    .update(toRow(patch))
    .eq("id", id)
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) throw error;
  return publicShape(data);
}

export async function deleteModel(supabase, id) {
  const { error } = await supabase.from("models").delete().eq("id", id);
  if (error) throw error;
}

// Map camelCase field names back to snake_case for inserts/updates.
function toRow(m) {
  const out = {};
  if (m.slug !== undefined) out.slug = m.slug;
  if (m.label !== undefined) out.label = m.label;
  if (m.kind !== undefined) out.kind = m.kind;
  if (m.provider !== undefined) out.provider = m.provider;
  if (m.modelId !== undefined) out.model_id = m.modelId;
  if (m.enabled !== undefined) out.enabled = m.enabled;
  if (m.isDefault !== undefined) out.is_default = m.isDefault;
  if (m.sortOrder !== undefined) out.sort_order = m.sortOrder;
  if (m.previewGradient !== undefined) out.preview_gradient = m.previewGradient;
  if (m.config !== undefined) out.config = m.config;
  return out;
}
