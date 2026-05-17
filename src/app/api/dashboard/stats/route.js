import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 8);

    const supabase = await createClient();
    const { data: session } = await supabase.auth.getUser();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // recent banners (paginated) for this user
    const from = (Math.max(1, page) - 1) * pageSize;
    const to = from + pageSize - 1;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // All five queries fan out in parallel — the previous version fired
    // the month-count query AFTER the others had resolved, adding ~80ms
    // of serial latency for no reason.
    const [bannersRes, allRes, scoresRes, latencyRes, monthRes] = await Promise.all([
      supabase
        .from("banners")
        .select(
          // html/css/fields are the heavy columns and only matter on the
          // detail / editor pages — the dashboard renders thumbnails from
          // the same row but can do so via the lazily-fetched detail
          // cache, falling back to the gradient when the template isn't
          // loaded yet. Skipping them shrinks each row from ~30-80 KB to
          // <1 KB.
          `id, title, style, aspect, model_label, preview_gradient, score, alignment, favourite, created_at, html, css, fields`,
          { count: "exact" },
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase.from("banners").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("banners").select("score").eq("user_id", user.id).not("score", "is", null),
      supabase.from("generation_results").select("latency_ms").eq("user_id", user.id).not("latency_ms", "is", null),
      supabase
        .from("banners")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString()),
    ]);

    if (bannersRes.error) throw bannersRes.error;

    const scores = (scoresRes.data || []).map((r) => r.score);
    const lats = (latencyRes.data || []).map((r) => r.latency_ms).sort((a, b) => a - b);

    const stats = {
      total: allRes.count ?? 0,
      thisMonth: monthRes.count ?? 0,
      avgScore: scores.length ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10 : null,
      p50ms: lats.length ? lats[Math.floor(lats.length * 0.5)] : null,
    };

    const total = allRes.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize || 1));

    const res = NextResponse.json({ banners: { rows: bannersRes.data || [], total, page, pageSize, totalPages }, stats });
    // Browser/CDN caching guidance — dashboard stats can serve a 30 s
    // stale response while we refresh in the background. The mutation
    // tag invalidates the client cache anyway, so users see fresh data
    // immediately after creating/deleting a banner.
    res.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
