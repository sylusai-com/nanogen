// src/lib/db/admin.js
// Admin-side queries. Caller must be an admin — RLS gates access via the
// is_admin() function set up in 0001_initial_schema.sql, and the admin
// layout wraps everything in <RouteGuard requireAdmin>.

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

export async function listAllUsers(supabase, options = {}) {
  const { page, pageSize, from, to } = normalizePagination(options);
  const paginated = pageSize != null;
  let query = supabase
    .from("profiles")
    .select("id, name, email, role, plan, avatar_url, created_at", paginated ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false });
  if (paginated) query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  if (!paginated) return data || [];
  const total = count ?? 0;
  return { rows: data || [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// Pulls every banner across the platform with its creator profile embedded.
// Includes html/css/fields/alignment so the admin outputs page can render the
// actual banner thumbnail in an iframe (same approach as user-side BannerThumb).
//
// `lightweight: true` skips the heavy html/css/fields blobs — useful for
// the admin overview's "Recent banners" strip where we only need the
// gradient + title + meta. The admin outputs page (full gallery) keeps
// the heavy columns so iframes can render the real templates.
export async function listAllBanners(supabase, options = {}) {
  const { page, pageSize, limit, from, to } = normalizePagination(options);
  const lightweight = options.lightweight === true;
  const paginated = pageSize != null;
  const cols = lightweight
    ? `
        id,
        user_id,
        title,
        prompt,
        style,
        aspect,
        model_id,
        model_label,
        image_url,
        preview_gradient,
        score,
        favourite,
        created_at,
        profiles ( name, email, avatar_url )
      `
    : `
        id,
        user_id,
        title,
        prompt,
        style,
        aspect,
        model_id,
        model_label,
        image_url,
        preview_gradient,
        score,
        favourite,
        html,
        css,
        fields,
        alignment,
        created_at,
        profiles ( name, email, avatar_url )
      `;
  let query = supabase
    .from("banners")
    .select(cols, paginated ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false });
  if (paginated) query = query.range(from, to);
  else if (limit != null) query = query.limit(limit);
  const { data, error, count } = await query;
  if (error) throw error;
  if (!paginated) return data || [];
  const total = count ?? 0;
  return { rows: data || [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getKpis(supabase) {
  const [usersRes, bannersRes, resultsRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("banners").select("*", { count: "exact", head: true }),
    supabase
      .from("generation_results")
      .select("score, latency_ms")
      .not("score", "is", null),
  ]);

  const users     = usersRes.count ?? 0;
  const banners   = bannersRes.count ?? 0;
  const scores    = (resultsRes.data || []).map((r) => r.score).filter((n) => n != null);
  const latencies = (resultsRes.data || [])
    .map((r) => r.latency_ms)
    .filter((n) => n != null)
    .sort((a, b) => a - b);

  const avgScore = scores.length
    ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10
    : null;
  const p50 = latencies.length
    ? latencies[Math.floor(latencies.length * 0.5)]
    : null;

  return { users, banners, avgScore, p50ms: p50 };
}

// Daily generation counts for the last `days` days.
export async function getDailyActivity(supabase, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("generation_runs")
    .select("created_at")
    .gte("created_at", since.toISOString());
  if (error) throw error;

  const buckets = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of data || []) {
    const day = row.created_at.slice(0, 10);
    if (buckets.has(day)) buckets.set(day, buckets.get(day) + 1);
  }
  return Array.from(buckets.entries()).map(([day, count]) => ({
    date:        day.slice(5),
    generations: count,
  }));
}

export async function getModelShare(supabase) {
  const { data, error } = await supabase
    .from("generation_results")
    .select("model_id, model_label, score, latency_ms");
  if (error) throw error;

  const byModel = new Map();
  for (const r of data || []) {
    const key = r.model_id;
    const cur = byModel.get(key) || {
      id:        r.model_id,
      label:     r.model_label,
      runs:      0,
      scoreSum:  0,
      latencies: [],
    };
    cur.runs++;
    if (r.score      != null) cur.scoreSum += r.score;
    if (r.latency_ms != null) cur.latencies.push(r.latency_ms);
    byModel.set(key, cur);
  }

  const total = (data || []).length || 1;
  return Array.from(byModel.values())
    .map((m) => {
      const lats = m.latencies.sort((a, b) => a - b);
      return {
        id:       m.id,
        label:    m.label,
        runs:     m.runs,
        share:    m.runs / total,
        avgScore: m.runs ? Math.round(m.scoreSum / m.runs) : null,
        p50ms:    lats.length ? lats[Math.floor(lats.length * 0.5)] : null,
      };
    })
    .sort((a, b) => b.runs - a.runs);
}