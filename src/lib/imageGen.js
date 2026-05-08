// src/lib/imageGen.js
//
// Server-side image-generation helper used by /api/banners. When an admin
// has configured an image model (kind = "image" in the models table),
// /api/banners calls this module to produce a banner background image
// from the user's brief + reference/subject context. The resulting data
// URI is then injected as the bg_image value on every text-model variant
// in the run, so the user sees a real photographic-style background
// instead of the text-model's CSS-only output.
//
// When NO image model is configured, callers fall back to the text-only
// path (text models emit a CSS-only background, optionally with an inline
// SVG data URI in bg_image — same flow used for the reference image).
//
// Provider support: OpenAI-compatible /v1/images/generations is the
// reference implementation (covers OpenAI, Azure OpenAI, and many proxies
// such as OpenRouter that expose a compatible image endpoint). The
// `provider` field on the model row picks the call style — additional
// providers (Replicate, Stability, etc.) can be added below by branching
// on `provider` and matching whatever API surface that provider exposes.

import { pickApiKey, pickEndpoint } from "@/lib/bannerTemplate";

const DEFAULT_OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";

// Map our 4 supported aspects to the closest size each common provider
// supports natively. Square + 9:16 are first-class on most providers;
// 16:9 / 4:5 are usually approximated by 1792x1024 / 1024x1280.
const SIZE_FOR_ASPECT = {
  "1:1":  "1024x1024",
  "16:9": "1792x1024",
  "4:5":  "1024x1280",
  "9:16": "1024x1792",
};

// Convert a fetch Response carrying an image body to a data: URI so the
// rest of the pipeline (which already speaks data URIs from compressed
// uploads + inline SVGs) can consume it without further plumbing.
async function blobToDataUri(blob) {
  const buf = await blob.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");
  const type = blob.type || "image/png";
  return `data:${type};base64,${b64}`;
}

// Convert a remote image URL to a base64-encoded data URI.
export async function urlToBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (HTTP ${res.status})`);
  const blob = await res.blob();
  return blobToDataUri(blob);
}

// Build the user-facing image prompt from the brief + extracted contexts.
// The text-model path uses long structured prompts; image models perform
// better with a short scene-style description, so we synthesise one.
export function composeImagePrompt({
  brief,
  style,
  aspect,
  referenceContext,
  subjectContext,
}) {
  const lines = [];
  lines.push(
    `Marketing banner background for: ${String(brief || "").slice(0, 600)}`,
  );
  if (style) lines.push(`Visual style: ${style}.`);
  if (aspect) lines.push(`Aspect: ${aspect}.`);

  if (referenceContext) {
    if (referenceContext.mood?.length) {
      lines.push(`Mood: ${referenceContext.mood.join(", ")}.`);
    }
    if (referenceContext.palette?.length) {
      lines.push(`Color palette: ${referenceContext.palette.join(", ")}.`);
    }
    if (referenceContext.composition) {
      lines.push(`Composition: ${referenceContext.composition}`);
    }
    if (referenceContext.subjectsToFeature?.length) {
      lines.push(
        `Subtle motifs to include: ${referenceContext.subjectsToFeature.join(", ")}.`,
      );
    }
  }

  if (subjectContext) {
    // The subject image is composited separately by the text model — we
    // do NOT want the image model to invent a photographic person /
    // product itself, so we ask for an environment that complements the
    // subject's placement.
    if (subjectContext.placement) {
      lines.push(
        `Leave clean negative space on the ${subjectContext.placement.replace(/-/g, " ")} side; the brand subject is composited on top there.`,
      );
    }
    if (subjectContext.dominantColors?.length) {
      lines.push(
        `Harmonize with the subject's colors: ${subjectContext.dominantColors.join(", ")}.`,
      );
    }
  }

  lines.push(
    "Banner-quality background art only — no text, no logos, no watermarks, no people unless the brief explicitly asks for them.",
  );

  return lines.join(" ");
}

// Main entry. Returns { dataUrl, modelLabel, modelId, provider } on
// success, or null if no image model is enabled / configured.
//
// Failure modes are swallowed and logged via the returned `error` field
// so the caller can decide whether to surface them to the user. Image
// generation is best-effort — if it fails, /api/banners falls through to
// the text-only path and the user still gets a banner.
export async function generateBannerBackground({
  imageModel,
  brief,
  style,
  aspect,
  referenceContext,
  subjectContext,
}) {
  if (!imageModel) return null;

  const apiKey   = pickApiKey(imageModel);
  const endpoint = pickEndpoint(imageModel);
  if (!apiKey) {
    return {
      dataUrl: null,
      error: `Image model "${imageModel.label}" has no API key. Set it in Admin → Models.`,
    };
  }

  const prompt = composeImagePrompt({
    brief, style, aspect, referenceContext, subjectContext,
  });
  const size = SIZE_FOR_ASPECT[aspect] || SIZE_FOR_ASPECT["16:9"];

  // Provider routing. Default = OpenAI-compatible /v1/images/generations.
  // Add new providers by branching here.
  try {
    if (imageModel.provider === "openai" || !imageModel.provider) {
      return await runOpenAI({ imageModel, apiKey, endpoint, prompt, size });
    }
    if (imageModel.provider === "openrouter") {
      // OpenRouter currently mirrors OpenAI's image API on its own host —
      // same payload shape works.
      return await runOpenAI({ imageModel, apiKey, endpoint, prompt, size });
    }
    return {
      dataUrl: null,
      error: `Unsupported image provider "${imageModel.provider}". Pick "openai" or extend src/lib/imageGen.js.`,
    };
  } catch (e) {
    return {
      dataUrl: null,
      error: `Image model "${imageModel.label}": ${e?.message || "request failed"}`,
    };
  }
}

async function runOpenAI({ imageModel, apiKey, endpoint, prompt, size }) {
  const url = endpoint || DEFAULT_OPENAI_IMAGE_ENDPOINT;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: imageModel.modelId,
      prompt,
      size,
      n: 1,
      // Always request base64 so we can convert to a data URI without
      // re-fetching a temporary URL on the server.
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let upstreamMsg = text;
    try { upstreamMsg = JSON.parse(text)?.error?.message || text; } catch {}
    return {
      dataUrl: null,
      error: `Image API ${res.status}: ${upstreamMsg || "unknown"}`,
    };
  }

  const data   = await res.json();
  const first  = data?.data?.[0];
  const b64    = first?.b64_json;
  const remote = first?.url;

  if (b64) {
    return {
      dataUrl: `data:image/png;base64,${b64}`,
      modelLabel: imageModel.label,
      modelId: imageModel.modelId,
      provider: imageModel.provider || "openai",
    };
  }
  if (remote) {
    // Provider returned a URL instead of base64 — fetch + inline so we
    // never depend on the URL still being live by the time the user
    // opens the editor.
    const img = await fetch(remote);
    if (!img.ok) {
      return {
        dataUrl: null,
        error: `Failed to download generated image (HTTP ${img.status})`,
      };
    }
    const blob = await img.blob();
    return {
      dataUrl: await blobToDataUri(blob),
      modelLabel: imageModel.label,
      modelId: imageModel.modelId,
      provider: imageModel.provider || "openai",
    };
  }

  return {
    dataUrl: null,
    error: "Image API returned no image data.",
  };
}
