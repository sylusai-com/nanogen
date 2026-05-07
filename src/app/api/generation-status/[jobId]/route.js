// src/app/api/generation-status/[jobId]/route.js
// Check status of a banner generation job

import { createClient } from "@/lib/supabase/server";

// In-memory job store (for MVP - in production, use Redis or Supabase)
const jobStore = new Map();

export async function GET(req, { params }) {
  try {
    const { jobId } = params;
    const job = jobStore.get(jobId);

    if (!job) {
      return Response.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return Response.json({
      status: job.status,
      currentStep: job.currentStep,
      banner: job.banner,
      error: job.error,
    });
  } catch (error) {
    console.error("Error checking job status:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Export jobStore for use by banner generation API
export { jobStore };
