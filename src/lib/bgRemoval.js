// src/lib/bgRemoval.js
// Best-effort subject background removal.
//
// When REMOVE_BG_API_KEY is set, the helper POSTs the subject image to
// remove.bg and returns a transparent-PNG data URI. Failures are
// swallowed — the caller falls back to the original image so a missing
// key or a transient API error never blocks banner generation.
//
// The integration is intentionally provider-agnostic at the function
// boundary: callers receive `{ dataUrl, source }` regardless of which
// upstream produced the cutout. To plug in a different vendor (Replicate
// rembg, Photoroom, ClipDrop, a self-hosted U^2-Net, etc.), branch on a
// new env var below and emit the same shape.

const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const buf = blob.arrayBuffer
      ? blob.arrayBuffer()
      : Promise.resolve(blob);
    Promise.resolve(buf)
      .then((arr) => {
        const bytes = arr instanceof ArrayBuffer ? arr : arr;
        const b64 = Buffer.from(bytes).toString("base64");
        const type = blob.type || "image/png";
        resolve(`data:${type};base64,${b64}`);
      })
      .catch(reject);
  });
}

// Pull the raw bytes out of a data: URI so we can re-upload them as a
// multipart form field to remove.bg. Plain http(s) URLs are passed
// through as `image_url` instead.
function decodeDataUri(dataUri) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const isBase64 = !!m[2];
  const payload = m[3] || "";
  if (isBase64) {
    return { mime, bytes: Buffer.from(payload, "base64") };
  }
  return { mime, bytes: Buffer.from(decodeURIComponent(payload), "utf8") };
}

// Returns { dataUrl, source } on success or null when removal isn't
// configured / failed. The shape mirrors imageGen.js for consistency.
export async function removeSubjectBackground(imageUrlOrDataUri) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return null;
  if (!imageUrlOrDataUri) return null;

  try {
    const form = new FormData();
    form.append("size", "auto");
    form.append("format", "png");

    if (imageUrlOrDataUri.startsWith("data:")) {
      const decoded = decodeDataUri(imageUrlOrDataUri);
      if (!decoded) return null;
      const blob = new Blob([decoded.bytes], { type: decoded.mime });
      form.append("image_file", blob, "subject.png");
    } else if (/^https?:\/\//i.test(imageUrlOrDataUri)) {
      form.append("image_url", imageUrlOrDataUri);
    } else {
      return null;
    }

    const res = await fetch(REMOVE_BG_ENDPOINT, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[bgRemoval] remove.bg ${res.status}: ${text.slice(0, 240)}`);
      return null;
    }

    const blob = await res.blob();
    const dataUrl = await blobToDataUri(blob);
    return { dataUrl, source: "remove.bg" };
  } catch (e) {
    console.warn("[bgRemoval] failed:", e?.message || e);
    return null;
  }
}
