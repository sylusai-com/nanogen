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
    const [bannersRes, allRes, scoresRes, latencyRes] = await Promise.all([
      supabase
        .from("banners")
        .select(
          `id, title, style, aspect, model_label, preview_gradient, score, html, css, fields, alignment, favourite, created_at`,
          { count: "exact" },
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase.from("banners").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("banners").select("score").eq("user_id", user.id).not("score", "is", null),
      supabase.from("generation_results").select("latency_ms").eq("user_id", user.id).not("latency_ms", "is", null),
    ]);

    if (bannersRes.error) throw bannersRes.error;

    const scores = (scoresRes.data || []).map((r) => r.score);
    const lats = (latencyRes.data || []).map((r) => r.latency_ms).sort((a, b) => a - b);

    const stats = {
      total: allRes.count ?? 0,
      thisMonth: 0, // compute below
      avgScore: scores.length ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10 : null,
      p50ms: lats.length ? lats[Math.floor(lats.length * 0.5)] : null,
    };

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthRes = await supabase
      .from("banners")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString());
    stats.thisMonth = monthRes.count ?? 0;

    const total = allRes.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize || 1));

    return NextResponse.json({ banners: { rows: bannersRes.data || [], total, page, pageSize, totalPages }, stats });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
