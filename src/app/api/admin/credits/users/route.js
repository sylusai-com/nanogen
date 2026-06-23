import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateAdminRole, errorResponse, readJson } from "@/lib/server/security";
import { setUserPlan, adjustCredits } from "@/lib/db/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req) {
  try {
    await validateAdminRole();
    const adminClient = createAdminClient();
    const body = await readJson(req);
    
    const { userId, action, planId, amount, reason } = body;
    
    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    if (action === "set_plan") {
        if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });
        await setUserPlan(adminClient, userId, planId);
        return NextResponse.json({ success: true });
    } 
    else if (action === "adjust") {
        if (amount === undefined) return NextResponse.json({ error: "Missing amount" }, { status: 400 });
        await adjustCredits(adminClient, userId, amount, reason || "admin_adjustment");
        return NextResponse.json({ success: true });
    }
    else if (action === "toggle_api") {
        if (body.allowed === undefined) return NextResponse.json({ error: "Missing allowed state" }, { status: 400 });
        const { error } = await adminClient
          .from("profiles")
          .update({ api_access_allowed: body.allowed })
          .eq("id", userId);
        if (error) throw error;
        return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
