import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKpis, getDailyActivity, getModelShare, listAllBanners } from "@/lib/db/admin";
import {
  validateAdminRole,
  rateLimit,
  clientKey,
  errorResponse
} from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { user } = await validateAdminRole();

    // Rate Limit (max 30 requests per minute on overview GET)
    const key = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-overview-get:${key}`, max: 30, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const requestedPageSize = Number(url.searchParams.get("pageSize") || 5);
    const pageSize = Math.min(50, Math.max(1, requestedPageSize));

    const admin = createAdminClient();

    const [kpis, activity, share, recent] = await Promise.all([
      getKpis(admin),
      getDailyActivity(admin, 14),
      getModelShare(admin),
      // Admin overview's recent strip only renders metadata, not full
      // template iframes — skip the html/css/fields blobs (often 10-80
      // KB each) to keep the response sub-second on bigger workspaces.
      listAllBanners(admin, { page, pageSize, lightweight: true }),
    ]);

    const res = NextResponse.json({ kpis, activity, share, recent });
    // Lets the browser HTTP cache serve a stale copy while we refresh in
    // the background. Mutation tags on the client cache still invalidate
    // immediately, so the admin sees fresh numbers right after a change.
    res.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
