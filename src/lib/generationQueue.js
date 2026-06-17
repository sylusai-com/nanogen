// src/lib/generationQueue.js
// Centralized banner generation job queue with step-by-step progress tracking
// Sequential workflow: Image validation → Analysis → BG fetch → Parallel models → Scoring → Save

import { createAdminClient } from "@/lib/supabase/admin";

// Generation workflow steps.
//
// Ids and progress values for the original 7-step ladder (ids 1–7) are
// load-bearing — they were minted before the spec's new stages and many
// dashboards still read those exact progress numbers. Ids 8–9 cover the
// spec additions (intelligent prompt enhancement, post-gen category
// detection). Steps can be marked `skipped` rather than `completed`
// when the pipeline doesn't actually run them on a given request.
export const GenerationJobSteps = {
  UPLOAD_IMAGES:       { id: 1,  name: "upload_images",       label: "Validating reference & subject images", progress: 15 },
  ANALYZE_REFERENCE:   { id: 2,  name: "analyze_reference",   label: "Analyzing reference image",             progress: 30 },
  ANALYZE_SUBJECT:     { id: 3,  name: "analyze_subject",     label: "Analyzing subject image",               progress: 45 },
  FETCH_BG_IMAGE:      { id: 4,  name: "fetch_bg_image",      label: "Finding background image",              progress: 55 },
  PARALLEL_MODELS:     { id: 5,  name: "parallel_models",     label: "Generating from all AI models",         progress: 75 },
  SCORE_BANNERS:       { id: 6,  name: "score_banners",       label: "Scoring & selecting best",              progress: 90 },
  SAVE_BANNER:         { id: 7,  name: "save_banner",         label: "Saving to database",                    progress: 100 },
  ENHANCE_PROMPT:      { id: 8,  name: "enhance_prompt",      label: "Enhancing brief and deciding layout",   progress: 50 },
  DETECT_CATEGORY:     { id: 9,  name: "detect_category",     label: "Classifying category and style",        progress: 80 },
};

export class GenerationJob {
  constructor(jobData, adminClient) {
    this.jobId = jobData.job_id;
    this.userId = jobData.user_id;
    this.payload = jobData.payload;
    
    // Status lifecycle: pending → processing → completed or failed
    this.status = jobData.status || "pending";
    this.currentStep = jobData.current_step || GenerationJobSteps.UPLOAD_IMAGES;
    this.progress = jobData.progress || 0;
    
    this.stepsCompleted = jobData.steps_completed || [];
    this.stepsSkipped = jobData.steps_skipped || [];
    this.error = jobData.error;
    this.errorDetails = jobData.error_details;
    this.results = jobData.results || {};
    
    // Results
    this.banner = jobData.banner;
    this.runId = jobData.run_id;
    this.banners = jobData.banners || [];
    this.variants = jobData.variants || [];
    
    // Timing
    this.createdAt = jobData.created_at ? new Date(jobData.created_at).getTime() : Date.now();
    this.startedAt = jobData.started_at ? new Date(jobData.started_at).getTime() : null;
    this.completedAt = jobData.completed_at ? new Date(jobData.completed_at).getTime() : null;

    this.adminClient = adminClient;
  }

  // Fire-and-forget sync to Supabase so we don't hold up the pipeline
  _sync(updates) {
    if (!this.adminClient) return;
    this.adminClient.from("generation_jobs").update(updates).eq("job_id", this.jobId).then(({ error }) => {
      if (error) console.error(`[Job ${this.jobId}] Sync error:`, error);
    });
  }

  setStatus(status) {
    this.status = status;
    const updates = { status };
    if (status === "processing" && !this.startedAt) {
      this.startedAt = Date.now();
      updates.started_at = new Date(this.startedAt).toISOString();
    }
    if (status === "completed" || status === "failed") {
      this.completedAt = Date.now();
      updates.completed_at = new Date(this.completedAt).toISOString();
    }
    this._sync(updates);
  }

  setStep(step) {
    this.currentStep = step;
    this.progress = step.progress;
    this.stepsCompleted.push({
      step: step.name,
      label: step.label,
      completedAt: Date.now(),
    });
    this._sync({
      current_step: step,
      progress: step.progress,
      steps_completed: this.stepsCompleted
    });
  }

  // Record a step the pipeline chose NOT to run. The step is not marked
  // active or complete — it just shows on the timeline with a cross so the
  // user understands why the bar moved past it.
  markStepSkipped(step, reason = null) {
    this.stepsSkipped.push({
      step: step.name,
      label: step.label,
      reason: reason || null,
      skippedAt: Date.now(),
    });
    this._sync({
      steps_skipped: this.stepsSkipped
    });
  }

  setError(error, details = null) {
    this.error = error;
    this.errorDetails = details;
    this.status = "failed";
    this.completedAt = Date.now();
    this._sync({
      error: error,
      error_details: details,
      status: "failed",
      completed_at: new Date(this.completedAt).toISOString()
    });
  }

  setBanner(banner, runId, banners = [], variants = []) {
    this.banner = banner;
    this.runId = runId;
    this.banners = banners;
    this.variants = variants;
    this.status = "completed";
    this.currentStep = GenerationJobSteps.SAVE_BANNER;
    this.progress = 100;
    this.completedAt = Date.now();
    this._sync({
      banner,
      run_id: runId,
      banners,
      variants,
      status: "completed",
      current_step: GenerationJobSteps.SAVE_BANNER,
      progress: 100,
      completed_at: new Date(this.completedAt).toISOString()
    });
  }

  toJSON() {
    return {
      jobId: this.jobId,
      userId: this.userId,
      status: this.status,
      currentStep: this.currentStep,
      progress: this.progress,
      stepsCompleted: this.stepsCompleted,
      stepsSkipped: this.stepsSkipped,
      error: this.error,
      results: this.results,
      banner: this.banner,
      runId: this.runId,
      banners: this.banners,
      variants: this.variants,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      elapsedMs: this.completedAt ? this.completedAt - this.createdAt : Date.now() - this.createdAt,
    };
  }
}

export async function createJob(userId, payload) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const adminClient = createAdminClient();
  
  const { data, error } = await adminClient
    .from("generation_jobs")
    .insert({
      job_id: jobId,
      user_id: userId,
      payload: payload,
      status: "pending",
      current_step: GenerationJobSteps.UPLOAD_IMAGES,
      progress: 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create generation job: ${error.message}`);
  }

  return new GenerationJob(data, adminClient);
}

export async function getJob(jobId) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("generation_jobs")
    .select()
    .eq("job_id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  return new GenerationJob(data, adminClient);
}

export async function getAllJobs() {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.from("generation_jobs").select();
  if (error || !data) return [];
  return data.map(d => new GenerationJob(d, adminClient));
}

export async function getJobsByUser(userId) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("generation_jobs")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
    
  if (error || !data) return [];
  return data.map(d => new GenerationJob(d, adminClient));
}

export async function getActiveJobs() {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("generation_jobs")
    .select()
    .in("status", ["pending", "processing"]);
    
  if (error || !data) return [];
  return data.map(d => new GenerationJob(d, adminClient));
}

export async function deleteJob(jobId) {
  const adminClient = createAdminClient();
  await adminClient.from("generation_jobs").delete().eq("job_id", jobId);
}
