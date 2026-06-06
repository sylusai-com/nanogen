// src/app/api/admin/api-overview/route.js
//
// Admin-only endpoint serving data for the /admin/api page.
// Returns KPIs, usage timeseries, top users, and recent requests.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminApiStats } from "@/lib/db/apiKeys";
import { validateAdminRole, errorResponse } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase } = await validateAdminRole();
    const admin = createAdminClient();
    const stats = await getAdminApiStats(admin);
    return NextResponse.json(stats);
  } catch (e) {
    return errorResponse(e);
  }
}
