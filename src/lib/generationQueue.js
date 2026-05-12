// src/lib/generationQueue.js
// Centralized banner generation job queue with step-by-step progress tracking
// Sequential workflow: Image validation → Analysis → BG fetch → Parallel models → Scoring → Save

const jobQueue = new Map();

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
  constructor(jobId, userId, payload) {
    this.jobId = jobId;
    this.userId = userId;
    this.payload = payload;
    
    // Status lifecycle: pending → processing → completed or failed
    this.status = "pending";
    this.currentStep = GenerationJobSteps.UPLOAD_IMAGES;
    this.progress = 0;
    
    // Tracking. `stepsCompleted` records every step that actually ran; the
    // UI ticks those. `stepsSkipped` records steps the pipeline decided to
    // skip (e.g. analyze_reference when no reference image was uploaded,
    // fetch_bg_image when no providers returned a result). The UI renders
    // those as a struck-through cross so the user can see WHY the timeline
    // skipped past them rather than wondering if it stalled.
    this.stepsCompleted = [];
    this.stepsSkipped = [];
    this.error = null;
    this.errorDetails = null;
    this.results = {};
    
    // Results
    this.banner = null;
    this.runId = null;
    this.banners = []; // All generated banners
    this.variants = []; // Variant metadata
    
    // Timing
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
  }

  setStatus(status) {
    this.status = status;
    if (status === "processing" && !this.startedAt) {
      this.startedAt = Date.now();
    }
    if (status === "completed" || status === "failed") {
      this.completedAt = Date.now();
    }
  }

  setStep(step) {
    this.currentStep = step;
    this.progress = step.progress;
    this.stepsCompleted.push({
      step: step.name,
      label: step.label,
      completedAt: Date.now(),
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
  }

  setError(error, details = null) {
    this.error = error;
    this.errorDetails = details;
    this.status = "failed";
    this.completedAt = Date.now();
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
      errorDetails: this.errorDetails,
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

export function createJob(userId, payload) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const job = new GenerationJob(jobId, userId, payload);
  jobQueue.set(jobId, job);
  return job;
}

export function getJob(jobId) {
  return jobQueue.get(jobId);
}

export function getAllJobs() {
  return Array.from(jobQueue.values());
}

export function getJobsByUser(userId) {
  return Array.from(jobQueue.values()).filter(job => job.userId === userId);
}

export function getActiveJobs() {
  return Array.from(jobQueue.values()).filter(job => 
    job.status === "pending" || job.status === "processing"
  );
}

export function deleteJob(jobId) {
  return jobQueue.delete(jobId);
}

// Auto-cleanup: Remove completed jobs after 10 minutes (MVP)
// In production, use Redis TTL or Supabase job table
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const JOB_RETENTION_MS = 10 * 60 * 1000; // Keep for 10 minutes

setInterval(() => {
  const now = Date.now();
  const toDelete = [];
  
  for (const [jobId, job] of jobQueue.entries()) {
    if ((job.status === "completed" || job.status === "failed") && 
        now - job.completedAt > JOB_RETENTION_MS) {
      toDelete.push(jobId);
    }
  }
  
  toDelete.forEach(jobId => jobQueue.delete(jobId));
}, CLEANUP_INTERVAL);
