// src/lib/db/banners.js
// Browser-side banner queries. Each takes a supabase client (from useAuth()).
// RLS guarantees a user can only read their own rows — BUT admins have
// is_admin() bypass on banners, which means an admin logged into /dashboard
// would see everyone else's banners on their personal dashboard. To prevent
// that, we filter by auth.uid() defensively here. The admin "see all
// banners" view lives in /admin/outputs and uses src/lib/db/admin.js.
//
// Mutations invalidate the "banners" cache tag so dashboards stay in sync.
// Column names are aliased to camelCase in the SELECT so UI components can
// consume the rows directly (`banner.modelLabel`, `banner.gradient`, etc).
import { invalidateTags } from "@/lib/cache";

const COLUMNS = `
  id,
  runId:run_id,
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
  canvas,
  favourite,
  createdAt:created_at,
  updatedAt:updated_at
`;

// Pull the current user's id from the auth session so we can scope queries
// to their rows even when the caller has admin role (RLS bypass).
async function currentUserId(supabase) {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function listBanners(supabase, { limit = 100 } = {}) {
  const uid = await currentUserId(supabase);
  if (!uid) return [];
  const { data, error } = await supabase
    .from("banners")
    .select(COLUMNS)
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getBanner(supabase, id) {
  const uid = await currentUserId(supabase);
  if (!uid) return null;
  const { data, error } = await supabase
    .from("banners")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateBanner(supabase, id, patch) {
  const uid = await currentUserId(supabase);
  if (!uid) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("banners")
    .update(patch)
    .eq("id", id)
    .eq("user_id", uid)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  invalidateTags(["banners", `banners:${uid}`, `banner:${id}`]);
  return data;
}

export async function deleteBanner(supabase, id) {
  const uid = await currentUserId(supabase);
  if (!uid) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("banners")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);
  if (error) throw error;
  invalidateTags(["banners", `banners:${uid}`, `banner:${id}`]);
}

export async function toggleFavourite(supabase, id, favourite) {
  return updateBanner(supabase, id, { favourite });
}

// Personal stats for the dashboard. Always scoped to the caller's rows.
export async function userStats(supabase) {
  const uid = await currentUserId(supabase);
  if (!uid) {
    return { total: 0, thisMonth: 0, avgScore: null, p50ms: null };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [allRes, monthRes, scoresRes, latencyRes] = await Promise.all([
    supabase
      .from("banners")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid),
    supabase
      .from("banners")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("created_at", startOfMonth.toISOString()),
    supabase
      .from("banners")
      .select("score")
      .eq("user_id", uid)
      .not("score", "is", null),
    supabase
      .from("generation_results")
      .select("latency_ms")
      .eq("user_id", uid)
      .not("latency_ms", "is", null),
  ]);

  const scores = (scoresRes.data || []).map((r) => r.score);
  const lats   = (latencyRes.data || [])
    .map((r) => r.latency_ms)
    .sort((a, b) => a - b);

  return {
    total:     allRes.count   ?? 0,
    thisMonth: monthRes.count ?? 0,
    avgScore: scores.length
      ? Math.round(
          (scores.reduce((s, n) => s + n, 0) / scores.length) * 10
        ) / 10
      : null,
    p50ms: lats.length ? lats[Math.floor(lats.length * 0.5)] : null,
  };
}