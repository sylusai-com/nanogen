// Browser-side banner queries. Each takes a supabase client (from useAuth()).
// RLS guarantees the caller can only read/write their own rows.
//
// Column names are aliased to camelCase in the SELECT so UI components can
// consume the rows directly (`banner.modelLabel`, `banner.gradient`, etc).

const COLUMNS = `
  id,
  user_id,
  title,
  prompt,
  style,
  aspect,
  modelId:model_id,
  modelLabel:model_label,
  imageUrl:image_url,
  gradient:preview_gradient,
  score,
  html,
  css,
  fields,
  alignment,
  favourite,
  createdAt:created_at,
  updatedAt:updated_at
`;

export async function listBanners(supabase, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from("banners")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getBanner(supabase, id) {
  const { data, error } = await supabase
    .from("banners")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateBanner(supabase, id, patch) {
  const { data, error } = await supabase
    .from("banners")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteBanner(supabase, id) {
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFavourite(supabase, id, favourite) {
  return updateBanner(supabase, id, { favourite });
}

export async function userStats(supabase) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [allRes, monthRes, scoresRes, latencyRes] = await Promise.all([
    supabase.from("banners").select("*", { count: "exact", head: true }),
    supabase
      .from("banners")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString()),
    supabase.from("banners").select("score").not("score", "is", null),
    supabase
      .from("generation_results")
      .select("latency_ms")
      .not("latency_ms", "is", null),
  ]);

  const scores = (scoresRes.data || []).map((r) => r.score);
  const lats = (latencyRes.data || [])
    .map((r) => r.latency_ms)
    .sort((a, b) => a - b);

  return {
    total: allRes.count ?? 0,
    thisMonth: monthRes.count ?? 0,
    avgScore: scores.length
      ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10
      : null,
    p50ms: lats.length ? lats[Math.floor(lats.length * 0.5)] : null,
  };
}
