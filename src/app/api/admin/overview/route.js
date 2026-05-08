import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKpis, getDailyActivity, getModelShare, listAllBanners } from "@/lib/db/admin";
import { validateAdminRole } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await validateAdminRole();

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 5);

    const admin = createAdminClient();

    const [kpis, activity, share, recent] = await Promise.all([
      getKpis(admin),
      getDailyActivity(admin, 14),
      getModelShare(admin),
      listAllBanners(admin, { page, pageSize }),
    ]);

    return NextResponse.json({ kpis, activity, share, recent });
  } catch (e) {
    const status = e.status || 500;
    return NextResponse.json({ error: e.message || String(e) }, { status });
  }
}
