// Catalog of image-generation models the multi-model pipeline can fan out to.
// Phase 1 ships placeholders; wire up real providers (Replicate, Fal, OpenAI, etc.)
// in /src/app/api/generate/route.js.
export const MODELS = [
  {
    id: "sdxl",
    label: "Stable Diffusion XL",
    provider: "Stability AI",
    enabled: true,
    previewGradient: "from-violet-500/40 via-fuchsia-500/20 to-indigo-700/40",
  },
  {
    id: "imagen",
    label: "Imagen 3",
    provider: "Google",
    enabled: true,
    previewGradient: "from-cyan-400/30 via-violet-500/20 to-indigo-800/40",
  },
  {
    id: "flux",
    label: "Flux Pro",
    provider: "Black Forest Labs",
    enabled: true,
    previewGradient: "from-amber-300/20 via-pink-500/30 to-rose-700/40",
  },
  {
    id: "dalle",
    label: "DALL·E 3",
    provider: "OpenAI",
    enabled: false,
    previewGradient: "from-emerald-400/30 via-cyan-400/20 to-teal-700/40",
  },
];

export const ASPECT_RATIOS = [
  { id: "16:9", label: "Landscape · 16:9" },
  { id: "1:1", label: "Square · 1:1" },
  { id: "4:5", label: "Portrait · 4:5" },
  { id: "9:16", label: "Story · 9:16" },
];

export const STYLES = [
  "Modern",
  "Minimal",
  "Cyberpunk",
  "Editorial",
  "Playful",
  "Corporate",
];

// Score threshold below which an output is filtered out of the gallery.
export const SCORE_THRESHOLD = 80;
