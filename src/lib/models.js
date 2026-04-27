// Static config that doesn't belong in the DB. Everything else (model
// catalog, aspect ratios, banner styles) is managed by admins via SQL tables.
//
// Use the helpers under src/lib/db/ to fetch:
//   - listImageModels / getDefaultTextModel  → src/lib/db/models.js
//   - listAspectRatios                        → src/lib/db/aspects.js
//   - listBannerStyles / getStyleBySlug       → src/lib/db/styles.js

// Score threshold below which an output is filtered out of the gallery.
export const SCORE_THRESHOLD = 80;

// Fallback gradient for image-model thumbnails that don't have one set.
export const DEFAULT_PREVIEW_GRADIENT = "from-violet-500/30 to-cyan-400/30";

// Provider → env var name. Used server-side to look up the API key when
// invoking a model. Adding a new provider = add an entry here + handle it
// in /api/generate (or the OpenRouter adapter).
export const PROVIDER_KEY_ENV = {
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  stability: "STABILITY_API_KEY",
  replicate: "REPLICATE_API_TOKEN",
  fal: "FAL_KEY",
  google: "GOOGLE_API_KEY",
};
