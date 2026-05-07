// src/lib/db/bgImageProviders.js
// Database operations for background image provider management

import { createAdminClient } from "@/lib/supabase/admin";

export async function listBgImageProviders(supabase) {
  const { data, error } = await supabase
    .from("bg_image_providers")
    .select("*")
    .eq("enabled", true);

  if (error) throw new Error(`Failed to fetch bg image providers: ${error.message}`);
  return data || [];
}

export async function getBgImageProvider(supabase, id) {
  const { data, error } = await supabase
    .from("bg_image_providers")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function createBgImageProvider(supabase, provider) {
  const { data, error } = await supabase
    .from("bg_image_providers")
    .insert([provider])
    .select()
    .single();

  if (error) throw new Error(`Failed to create provider: ${error.message}`);
  return data;
}

export async function updateBgImageProvider(supabase, id, updates) {
  const { data, error } = await supabase
    .from("bg_image_providers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update provider: ${error.message}`);
  return data;
}

export async function deleteBgImageProvider(supabase, id) {
  const { error } = await supabase
    .from("bg_image_providers")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete provider: ${error.message}`);
}

// Fetch background image from configured provider
export async function fetchBgImageFromProvider(provider, category, query) {
  if (!provider || !provider.api_key) {
    throw new Error("Provider not configured or missing API key");
  }

  try {
    if (provider.type === "unsplash") {
      return await fetchFromUnsplash(provider, category, query);
    } else if (provider.type === "pexels") {
      return await fetchFromPexels(provider, category, query);
    } else if (provider.type === "pixabay") {
      return await fetchFromPixabay(provider, category, query);
    } else {
      throw new Error(`Unknown provider type: ${provider.type}`);
    }
  } catch (error) {
    throw new Error(`Failed to fetch image from ${provider.name}: ${error.message}`);
  }
}

async function fetchFromUnsplash(provider, category, query) {
  const searchQuery = query || category || "banner background";
  const params = new URLSearchParams({
    query: searchQuery,
    per_page: 1,
    orientation: "landscape",
    ...provider.config,
  });

  const res = await fetch(`${provider.api_endpoint}?${params}`, {
    headers: {
      Authorization: `Client-ID ${provider.api_key}`,
    },
  });

  if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("No images found");
  }

  const photo = data.results[0];
  return {
    url: photo.urls.regular,
    credit: `Photo by ${photo.user.name} on Unsplash`,
    source: "unsplash",
  };
}

async function fetchFromPexels(provider, category, query) {
  const searchQuery = query || category || "banner background";
  const params = new URLSearchParams({
    query: searchQuery,
    per_page: 1,
    orientation: "landscape",
    ...provider.config,
  });

  const res = await fetch(`${provider.api_endpoint}?${params}`, {
    headers: {
      Authorization: provider.api_key,
    },
  });

  if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
  const data = await res.json();
  if (!data.photos || data.photos.length === 0) {
    throw new Error("No images found");
  }

  const photo = data.photos[0];
  return {
    url: photo.src.landscape,
    credit: `Photo by ${photo.photographer} on Pexels`,
    source: "pexels",
  };
}

async function fetchFromPixabay(provider, category, query) {
  const searchQuery = query || category || "banner background";
  const params = new URLSearchParams({
    key: provider.api_key,
    q: searchQuery,
    per_page: 1,
    orientation: "horizontal",
    image_type: "photo",
    ...provider.config,
  });

  const res = await fetch(`${provider.api_endpoint}?${params}`);
  if (!res.ok) throw new Error(`Pixabay API error: ${res.status}`);
  const data = await res.json();
  if (!data.hits || data.hits.length === 0) {
    throw new Error("No images found");
  }

  const photo = data.hits[0];
  return {
    url: photo.largeImageURL,
    credit: `Image from Pixabay`,
    source: "pixabay",
  };
}
