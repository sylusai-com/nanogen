// src/lib/db/styles.js
// Banner styles — admin-managed. Drives the prompt-form Style chip group
// AND the color preset that the HTML banner generator applies.

const COLUMNS = `
  id, slug, label, bg, fg, accent, gradient, enabled,
  sortOrder:sort_order,
  createdAt:created_at,
  updatedAt:updated_at
`;

export async function listBannerStyles(supabase) {
  const { data, error } = await supabase
    .from("banner_styles")
    .select(COLUMNS)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listAllBannerStyles(supabase) {
  const { data, error } = await supabase
    .from("banner_styles")
    .select(COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Look up a style row by either slug or label (case-insensitive on label),
// since the AI prompt receives the human-friendly label as input.
export async function getStyleByName(supabase, name) {
  if (!name) return null;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const { data: bySlug } = await supabase
    .from("banner_styles")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (bySlug) return bySlug;
  const { data: byLabel } = await supabase
    .from("banner_styles")
    .select(COLUMNS)
    .ilike("label", name)
    .maybeSingle();
  return byLabel || null;
}

export async function createBannerStyle(supabase, row) {
  const { data, error } = await supabase
    .from("banner_styles")
    .insert(toRow(row))
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBannerStyle(supabase, id, patch) {
  const { data, error } = await supabase
    .from("banner_styles")
    .update(toRow(patch))
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBannerStyle(supabase, id) {
  const { error } = await supabase.from("banner_styles").delete().eq("id", id);
  if (error) throw error;
}

function toRow(s) {
  const out = {};
  if (s.slug !== undefined) out.slug = s.slug;
  if (s.label !== undefined) out.label = s.label;
  if (s.bg !== undefined) out.bg = s.bg;
  if (s.fg !== undefined) out.fg = s.fg;
  if (s.accent !== undefined) out.accent = s.accent;
  if (s.gradient !== undefined) out.gradient = s.gradient;
  if (s.enabled !== undefined) out.enabled = s.enabled;
  if (s.sortOrder !== undefined) out.sort_order = s.sortOrder;
  return out;
}
