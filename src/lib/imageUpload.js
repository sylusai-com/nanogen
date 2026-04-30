// Client-side image helpers for the banner studio. We don't have Supabase
// Storage wired up yet, so uploaded images are inlined as data URLs and
// stored in the banner's `fields` column (or passed alongside a generation
// request). To keep payloads sane we resize + JPEG-compress before encoding.

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.78;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB raw file ceiling

export function isImageFile(file) {
  return !!file && typeof file.type === "string" && file.type.startsWith("image/");
}

// Read a File into an HTMLImageElement so we can draw it to a canvas.
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Resize the given image so its longest edge is <= maxDimension, then
// encode as JPEG at the given quality. Returns a data URL.
export async function compressImage(file, {
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
  mimeType,
} = {}) {
  if (!isImageFile(file)) throw new Error("Not an image file");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image is too large (max 8MB)");
  }

  // SVGs and tiny images: keep as-is — re-encoding would lose vectors and
  // is pointless for already-small files.
  if (file.type === "image/svg+xml" || file.size < 64 * 1024) {
    return await readAsDataUrl(file);
  }

  const img = await fileToImage(file);
  const { width: w, height: h } = img;
  const longest = Math.max(w, h);
  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return await readAsDataUrl(file);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // JPEG is the smallest universal format. Force it unless the caller
  // asked for something specific (e.g. PNG to keep transparency).
  const outType = mimeType || (/png|webp/i.test(file.type) ? file.type : "image/jpeg");
  return canvas.toDataURL(outType, quality);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export function approximateDataUrlBytes(dataUrl) {
  if (!dataUrl) return 0;
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}
