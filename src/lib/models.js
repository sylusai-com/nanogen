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
//
// Every provider goes through the same OpenAI-compatible chat completions
// path (POST {endpoint} with Bearer {apiKey} and {model, messages}). The
// list is just a UX hint — admins can also pick "custom" and supply their
// own provider name, endpoint URL, and API key. Whichever provider is
// enabled (and marked default for text models) is what the banner pipeline
// actually calls; admins can enable / disable / swap them at will.
export const PROVIDERS = [
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "groq",
  "together",
  "mistral",
  "deepseek",
  "perplexity",
  "stability",
  "replicate",
  "fal",
  "custom",
];

// Endpoint hints per provider — used as placeholder text in the admin form
// and as the default URL when an admin leaves the endpoint blank.
export const PROVIDER_ENDPOINTS = {
  openrouter:  "https://openrouter.ai/api/v1/chat/completions",
  openai:      "https://api.openai.com/v1/chat/completions",
  anthropic:   "https://api.anthropic.com/v1/messages",
  google:      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq:        "https://api.groq.com/openai/v1/chat/completions",
  together:    "https://api.together.xyz/v1/chat/completions",
  mistral:     "https://api.mistral.ai/v1/chat/completions",
  deepseek:    "https://api.deepseek.com/v1/chat/completions",
  perplexity:  "https://api.perplexity.ai/chat/completions",
  stability:   "https://api.stability.ai/v2beta/...",
  replicate:   "https://api.replicate.com/v1/predictions",
  fal:         "https://fal.run/...",
  custom:      "https://your-provider.example.com/v1/chat/completions",
};