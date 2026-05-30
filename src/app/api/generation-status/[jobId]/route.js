// src/app/api/generation-status/[jobId]/route.js
// Check status of a banner generation job

import { createClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/generationQueue";

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = resolvedParams;
    const job = getJob(jobId);

    if (!job) {
      return Response.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.userId !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role !== "admin") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return Response.json(job.toJSON());
  } catch (error) {
    console.error("Error checking job status:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
