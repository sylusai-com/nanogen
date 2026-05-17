import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = "banner-images";
const DEFAULT_MAX_DIMENSION = 1800;
const DEFAULT_WEBP_QUALITY = 82;

function sanitizeSegment(value) {
  return String(value || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

function parseDataUrl(dataUrl) {
  const value = String(dataUrl || "").trim();
  const match = value.match(/^data:([^;,]+)?(?:;base64)?,([\s\S]+)$/i);
  if (!match) return null;
  return {
    mimeType: (match[1] || "image/png").toLowerCase(),
    base64: match[2],
  };
}

async function ensureBucket(adminClient, bucketName) {
  const { data, error } = await adminClient.storage.getBucket(bucketName);
  if (data) return data;
  if (error && error.status !== 404) throw error;
  const { data: created, error: createError } = await adminClient.storage.createBucket(bucketName, {
    public: true,
  });
  if (createError) {
    const message = String(createError.message || "");
    if (!/already exists/i.test(message)) throw createError;
  }
  return created || { name: bucketName };
}

async function compressImageBuffer(buffer, mimeType) {
  const pipeline = sharp(buffer).rotate().resize({
    width: DEFAULT_MAX_DIMENSION,
    height: DEFAULT_MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (mimeType === "image/png" || mimeType === "image/webp") {
    return pipeline.jpeg({ quality: DEFAULT_WEBP_QUALITY, mozjpeg: true }).toBuffer();
  }
  return pipeline.jpeg({ quality: DEFAULT_WEBP_QUALITY, mozjpeg: true }).toBuffer();
}

function publicUrlFor(adminClient, bucketName, path) {
  const { data } = adminClient.storage.from(bucketName).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function storeBannerImageAsset({
  dataUrl,
  userId = null,
  bannerId = null,
  jobId = null,
  // Each banner generation uploads up to FOUR distinct assets (reference,
  // subject original, subject cutout, bg image) inside one job. Without a
  // per-asset suffix they all collide on `${userId}/${jobId}.jpg` and the
  // last upload silently overwrites the others — which is why the
  // ReferencePanel ended up showing the same image in both the Reference
  // and Subject cards (whichever finished writing last won the URL).
  kind = "asset",
  bucketName = DEFAULT_BUCKET,
  adminClient = null,
} = {}) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const client = adminClient || createAdminClient();
  await ensureBucket(client, bucketName);

  const rawBuffer = Buffer.from(parsed.base64, "base64");
  const compressed = await compressImageBuffer(rawBuffer, parsed.mimeType);
  const userPart = sanitizeSegment(userId || "user");
  const runPart = sanitizeSegment(bannerId || jobId || Date.now());
  const kindPart = sanitizeSegment(kind);
  const filePath = `banners/${userPart}/${runPart}-${kindPart}.jpg`;

  const contentType = "image/jpeg";
  const { error } = await client.storage.from(bucketName).upload(filePath, compressed, {
    contentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw error;

  return publicUrlFor(client, bucketName, filePath);
}
