// src/lib/models.js
// Small constants used by both the API and the admin pages.
// API keys are NOT here — they live per-model in `models.config.apiKey`,
// configured by admin in /admin/models. Static catalog data also lives in
// the DB (models, aspect_ratios, banner_styles).

// Score threshold below which an output is filtered out of the gallery.
export const SCORE_THRESHOLD = 80;

// Fallback gradient for image-model thumbnails that don't have one set.
export const DEFAULT_PREVIEW_GRADIENT = "from-violet-500/30 to-cyan-400/30";

// Providers admins can pick from when creating a model.
// (Which ones are actually wired up is a separate concern — see
//  bannerTemplate.js for the HTML path; image providers will be wired up
//  inside /api/generate.)
export const PROVIDERS = [
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "stability",
  "replicate",
  "fal",
];