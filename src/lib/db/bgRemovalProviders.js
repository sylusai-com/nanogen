// src/lib/db/bgRemovalProviders.js
// CRUD + provider call dispatch for the bg-removal admin registry.
//
// Each row points at a vendor (remove.bg, ClipDrop, Photoroom) or a
// custom endpoint that accepts an image and returns a transparent PNG.
// fetchSubjectCutout(provider, imageUrlOrDataUri) is the single dispatch
// path — the route never branches on provider type itself.

export async function listBgRemovalProviders(supabase) {
  const { data, error } = await supabase
    .from("bg_removal_providers")
    .select("*")
    .eq("enabled", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to fetch bg removal providers: ${error.message}`);
  return data || [];
}

export async function listAllBgRemovalProviders(supabase) {
  const { data, error } = await supabase
    .from("bg_removal_providers")
    .select("*")
    .order("enabled", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to fetch bg removal providers: ${error.message}`);
  return data || [];
}

export async function createBgRemovalProvider(supabase, provider) {
  const { data, error } = await supabase
    .from("bg_removal_providers")
    .insert([provider])
    .select()
    .single();
  if (error) throw new Error(`Failed to create provider: ${error.message}`);
  return data;
}

export async function updateBgRemovalProvider(supabase, id, updates) {
  const { data, error } = await supabase
    .from("bg_removal_providers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update provider: ${error.message}`);
  return data;
}

export async function deleteBgRemovalProvider(supabase, id) {
  const { error } = await supabase
    .from("bg_removal_providers")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete provider: ${error.message}`);
}

const DEFAULT_ENDPOINTS = {
  removebg: "https://api.remove.bg/v1.0/removebg",
  clipdrop: "https://clipdrop-api.co/remove-background/v1",
  photoroom: "https://image-api.photoroom.com/v2/edit",
};

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

async function fetchAsBlob(imageUrlOrDataUri) {
  if (imageUrlOrDataUri.startsWith("data:")) {
    const decoded = decodeDataUri(imageUrlOrDataUri);
    if (!decoded) return null;
    return new Blob([decoded.bytes], { type: decoded.mime });
  }
  const res = await fetch(imageUrlOrDataUri);
  if (!res.ok) return null;
  return await res.blob();
}

async function blobToDataUri(blob) {
  const buf = await blob.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");
  const type = blob.type || "image/png";
  return `data:${type};base64,${b64}`;
}

// Provider-specific call. Returns a transparent PNG data URI on success,
// or null on any failure (auth, rate limit, malformed response). The
// caller owns "try the next provider, then fall back to local".
export async function fetchSubjectCutout(provider, imageUrlOrDataUri) {
  if (!provider || !imageUrlOrDataUri) return null;
  const apiKey = provider.api_key;
  const endpoint = provider.api_endpoint || DEFAULT_ENDPOINTS[provider.type];
  if (!endpoint) return null;
  if (!apiKey && provider.type !== "custom") return null;

  try {
    if (provider.type === "removebg") {
      const blob = await fetchAsBlob(imageUrlOrDataUri);
      if (!blob) return null;
      const form = new FormData();
      form.append("size", "auto");
      form.append("format", "png");
      form.append("image_file", blob, "subject.png");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: form,
      });
      if (!res.ok) return null;
      return await blobToDataUri(await res.blob());
    }

    if (provider.type === "clipdrop") {
      const blob = await fetchAsBlob(imageUrlOrDataUri);
      if (!blob) return null;
      const form = new FormData();
      form.append("image_file", blob, "subject.png");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: form,
      });
      if (!res.ok) return null;
      return await blobToDataUri(await res.blob());
    }

    if (provider.type === "photoroom") {
      const blob = await fetchAsBlob(imageUrlOrDataUri);
      if (!blob) return null;
      const form = new FormData();
      form.append("imageFile", blob, "subject.png");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "x-api-key": apiKey, Accept: "image/png" },
        body: form,
      });
      if (!res.ok) return null;
      return await blobToDataUri(await res.blob());
    }

    // Generic / custom: POST the bytes as multipart `image_file` and
    // expect a binary image response. Custom provider rows can declare
    // a different field name via config.field_name.
    const blob = await fetchAsBlob(imageUrlOrDataUri);
    if (!blob) return null;
    const fieldName = provider.config?.field_name || "image_file";
    const form = new FormData();
    form.append(fieldName, blob, "subject.png");
    const headers = {};
    if (apiKey) {
      const headerName = provider.config?.auth_header || "Authorization";
      const headerValue = provider.config?.auth_scheme
        ? `${provider.config.auth_scheme} ${apiKey}`
        : apiKey;
      headers[headerName] = headerValue;
    }
    const res = await fetch(endpoint, { method: "POST", headers, body: form });
    if (!res.ok) return null;
    return await blobToDataUri(await res.blob());
  } catch {
    return null;
  }
}
