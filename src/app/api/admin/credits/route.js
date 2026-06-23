import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateAdminRole, errorResponse, readJson } from "@/lib/server/security";
import { listPlans, createPlan, updatePlan, deletePlan } from "@/lib/db/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { supabase } = await validateAdminRole();
    const plans = await listPlans(supabase);
    return NextResponse.json(plans);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req) {
  try {
    await validateAdminRole();
    const adminClient = createAdminClient();
    const body = await readJson(req);
    
    let plan;
    if (body.id) {
        plan = await updatePlan(adminClient, body.id, {
            name: body.name,
            slug: body.slug,
            credits: body.credits,
            description: body.description,
            is_default: body.is_default
        });
    } else {
        plan = await createPlan(adminClient, {
            name: body.name,
            slug: body.slug,
            credits: body.credits,
            description: body.description,
            is_default: body.is_default
        });
    }
    
    return NextResponse.json(plan);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req) {
    try {
        await validateAdminRole();
        const adminClient = createAdminClient();
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) throw new Error("Missing plan ID");
        
        await deletePlan(adminClient, id);
        return NextResponse.json({ success: true });
    } catch (e) {
        return errorResponse(e);
    }
}
