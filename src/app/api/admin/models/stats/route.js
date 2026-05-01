import { NextResponse } from "next/server";
import { getModelShare } from "@/lib/db/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const admin = createAdminClient();
    
    // Get aggregated model stats from generation_results
    const share = await getModelShare(admin);
    
    // Transform into a map keyed by model slug for easy lookup in the UI
    const statsMap = {};
    for (const model of share) {
      statsMap[model.id] = {
        runs: model.runs,
        share: model.share,
        avgScore: model.avgScore,
        p50ms: model.p50ms,
      };
    }
    
    return NextResponse.json({ stats: statsMap });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
