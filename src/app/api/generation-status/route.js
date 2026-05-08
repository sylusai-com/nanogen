// src/app/api/generation-status/route.js
// List active banner generation jobs for the signed-in user

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobsByUser } from "@/lib/generationQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ jobs: [] }, { status: 401 });
    }

    const jobs = getJobsByUser(user.id)
      .filter((job) => job.status === "pending" || job.status === "processing")
      .map((job) => job.toJSON());

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Failed to list generation jobs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list jobs" },
      { status: 500 },
    );
  }
}
