// src/lib/db/models.js
// Models table queries. RLS allows everyone (incl. anon) to read enabled
// rows; only admins can write. Admin pages can pass an admin-scoped client
// (or use the secret-key client server-side) to see disabled rows too.

const COLUMNS = `
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

export async function listImageModels(supabase) {
  const { data, error } = await supabase
    .from("models")
    .select(COLUMNS)
    .eq("kind", "image")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listAllModels(supabase) {
  const { data, error } = await supabase
    .from("models")
    .select(COLUMNS)
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getDefaultTextModel(supabase) {
  const { data } = await supabase
    .from("models")
    .select(COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .eq("is_default", true)
    .maybeSingle();
  if (data) return data;
  // Fallback: first enabled text model.
  const { data: any } = await supabase
    .from("models")
    .select(COLUMNS)
    .eq("kind", "text")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return any || null;
}

export async function createModel(supabase, model) {
  const { data, error } = await supabase
    .from("models")
    .insert(toRow(model))
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateModel(supabase, id, patch) {
  const { data, error } = await supabase
    .from("models")
    .update(toRow(patch))
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
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
