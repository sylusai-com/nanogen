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
  referenceImageUrl:reference_image_url,
  referenceContext:reference_context,
  subjectImageUrl:subject_image_url,
  subjectContext:subject_context,
  feedbackRating:feedback_rating,
  feedbackText:feedback_text,
  createdAt:created_at,
  updatedAt:updated_at
`;

function normalizePagination({ page = 1, pageSize = null, limit = null } = {}) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePageSize = pageSize == null ? null : Math.max(1, Math.floor(Number(pageSize) || 1));
  const safeLimit = limit == null ? null : Math.max(1, Math.floor(Number(limit) || 1));
  return {
    page: safePage,
    pageSize: safePageSize,
    limit: safeLimit,
    from: safePageSize ? (safePage - 1) * safePageSize : 0,
    to: safePageSize ? (safePage - 1) * safePageSize + safePageSize - 1 : 0,
  };
}

// Lightweight column set for list/grid views. Excludes the heavy
// html/css/fields/canvas blobs (often 10-100 KB each) — those are only
// needed on the detail / editor page, and the thumbnail render reuses
// the cached full row when navigating into a banner. Saved bytes on
// the wire dominate the dashboard load time.
const LIST_COLUMNS = `
  id,
  runId:run_id,
  title,
  style,
  aspect,
  modelId:model_id,
  modelLabel:model_label,
  imageUrl:image_url,
  gradient:preview_gradient,
  score,
  alignment,
  favourite,
  html,
  css,
  fields,
  feedbackRating:feedback_rating,
  feedbackText:feedback_text,
  createdAt:created_at
`;

// Resolve uid once at the call site. Callers receive `user.id` from
// `useAuth()` already — passing it in saves a `supabase.auth.getUser()`
// round trip per query (every banner-list refresh used to do at least
// one of these, often 2-3 stacked across the page).
function requireUid(uid) {
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

export async function listBanners(supabase, userId, options = {}) {
  const { page, pageSize, limit, from, to } = normalizePagination(options);
  if (!userId) return pageSize != null
    ? { rows: [], total: 0, page, pageSize, totalPages: 1 }
    : [];
  const paginated = pageSize != null;
  let query = supabase
    .from("banners")
    .select(LIST_COLUMNS, paginated ? { count: "exact" } : undefined)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (paginated) query = query.range(from, to);
  else if (limit != null) query = query.limit(limit);
  const { data, error, count } = await query;
  if (error) throw error;
  if (!paginated) return data || [];
  const total = count ?? 0;
  return {
    rows: data || [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getBanner(supabase, userId, id) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("banners")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateBanner(supabase, userId, id, patch) {
  const uid = requireUid(userId);
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

export async function deleteBanner(supabase, userId, id) {
  const uid = requireUid(userId);
  const { error } = await supabase
    .from("banners")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);
  if (error) throw error;
  invalidateTags(["banners", `banners:${uid}`, `banner:${id}`]);
}

export async function toggleFavourite(supabase, userId, id, favourite) {
  return updateBanner(supabase, userId, id, { favourite });
}

// Personal stats for the dashboard. Always scoped to the caller's rows.
export async function userStats(supabase, userId) {
  const uid = userId;
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