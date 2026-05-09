// src/lib/bgRemoval.js
// Background removal pipeline. Three layers, tried in order:
//
//   1. Configured admin providers (bg_removal_providers table) — tried
//      in DB order until one succeeds. Covers remove.bg, ClipDrop,
//      Photoroom, and arbitrary custom endpoints.
//   2. Sharp-based "uniform background" cutout. Works only when the
//      photo's edges are nearly the same color (studio portraits, white
//      product shots). Cheap, runs in-process, no external calls.
//   3. Pass-through. The original image is returned unchanged so the
//      banner generation never blocks waiting for a perfect cutout.
//
// The function shape is { dataUrl, source } on success, null otherwise,
// matching imageGen.js.

import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listBgRemovalProviders,
  fetchSubjectCutout,
} from "@/lib/db/bgRemovalProviders";

function decodeDataUri(dataUri) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const isBase64 = !!m[2];
  const payload = m[3] || "";
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { mime, bytes };
}

async function fetchBytes(imageUrlOrDataUri) {
  if (imageUrlOrDataUri.startsWith("data:")) {
    const d = decodeDataUri(imageUrlOrDataUri);
    return d?.bytes || null;
  }
  if (/^https?:\/\//i.test(imageUrlOrDataUri)) {
    const res = await fetch(imageUrlOrDataUri);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  return null;
}

// Heuristic local cutout for studio shots. Samples the four corners
// plus mid-edge pixels — if they cluster around a single color (low
// variance, brightness near 0 or 1), every pixel within a tolerance of
// that color is made transparent. For complex backgrounds the variance
// is too high and we abort, returning null so the caller can pass the
// original image through unchanged.
async function localUniformBackgroundCutout(buffer) {
  try {
    const img = sharp(buffer).ensureAlpha().rotate();
    const meta = await img.metadata();
    const { width, height } = meta;
    if (!width || !height) return null;

    const raw = await img.raw().toBuffer();
    const channels = 4;
    const get = (x, y) => {
      const i = (y * width + x) * channels;
      return [raw[i], raw[i + 1], raw[i + 2]];
    };

    // Sample 8 edge pixels.
    const samples = [
      get(0, 0),
      get(width - 1, 0),
      get(0, height - 1),
      get(width - 1, height - 1),
      get(Math.floor(width / 2), 0),
      get(Math.floor(width / 2), height - 1),
      get(0, Math.floor(height / 2)),
      get(width - 1, Math.floor(height / 2)),
    ];

    const mean = [0, 0, 0];
    for (const s of samples) for (let c = 0; c < 3; c++) mean[c] += s[c];
    for (let c = 0; c < 3; c++) mean[c] /= samples.length;

    let varSum = 0;
    for (const s of samples) {
      for (let c = 0; c < 3; c++) {
        const d = s[c] - mean[c];
        varSum += d * d;
      }
    }
    const variance = varSum / (samples.length * 3);

    // Bail out when corners disagree (likely a complex bg). Threshold
    // chosen empirically: tighter than 1500 misses textured backdrops,
    // looser than 1500 starts false-positive on busy scenes.
    if (variance > 1500) return null;

    // Tolerance scales with variance — tighter cluster → stricter mask.
    const tol = Math.max(28, Math.min(64, Math.sqrt(variance) * 2.5));
    const out = Buffer.alloc(raw.length);
    raw.copy(out);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        const dr = raw[i] - mean[0];
        const dg = raw[i + 1] - mean[1];
        const db = raw[i + 2] - mean[2];
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < tol) {
          out[i + 3] = 0; // alpha → transparent
        } else if (dist < tol * 1.5) {
          // Soft edge: scale alpha so the cutout blends rather than
          // showing a hard halo around the subject.
          const t = (dist - tol) / (tol * 0.5);
          out[i + 3] = Math.round(255 * t);
        }
      }
    }

    const png = await sharp(out, {
      raw: { width, height, channels },
    })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// Public entry point. `adminClient` is optional — when omitted we build
// our own service-role client so the pipeline can call this from
// background workers that don't pass auth context.
export async function removeSubjectBackground(imageUrlOrDataUri, { adminClient } = {}) {
  if (!imageUrlOrDataUri) return null;
  const client = adminClient || createAdminClient();

  // 1. Provider chain — first enabled provider wins.
  try {
    const providers = await listBgRemovalProviders(client);
    for (const provider of providers || []) {
      const dataUrl = await fetchSubjectCutout(provider, imageUrlOrDataUri);
      if (dataUrl) {
        return { dataUrl, source: provider.name || provider.type };
      }
    }
  } catch (e) {
    // Provider table missing or RLS-denied → fall through to local.
    console.warn("[bgRemoval] provider list failed:", e?.message || e);
  }

  // 2. Local Sharp fallback. Only useful for studio shots.
  const bytes = await fetchBytes(imageUrlOrDataUri);
  if (bytes) {
    const local = await localUniformBackgroundCutout(bytes);
    if (local) {
      return { dataUrl: local, source: "local-uniform" };
    }
  }

  // 3. Pass-through (no removal happened).
  return null;
}
