import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserCredits } from "@/lib/db/credits";
import { errorResponse } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credits = await getUserCredits(supabase, user.id);
    
    // Admin check for unlimited
    let is_admin = false;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role === "admin") {
      is_admin = true;
    }

    if (!credits && !is_admin) {
        return NextResponse.json({ 
            remaining: 0, 
            used: 0, 
            total: 0, 
            planName: "Free",
            is_admin: false 
        });
    }

    return NextResponse.json({
        ...credits,
        is_admin
    });

  } catch (error) {
    return errorResponse(error);
  }
}
