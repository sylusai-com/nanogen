// src/lib/db/settings.js
// app_settings table queries. RLS restricts reads to admins, so the public
// (cookie-bound) supabase client is fine for /admin pages but NOT for the
// banner generation server flow — that path runs as a regular user. The
// admin (service-role) client bypasses RLS and is the right choice from
// /api/banners.

export const SYSTEM_PROMPT_KEY = "banner_system_prompt";

// Returns the active system prompt text, or null when no row is set.
// Caller is expected to fall back to the in-code DEFAULT_SYSTEM_PROMPT.
export async function getActiveSystemPrompt(adminClient) {
  const { data, error } = await adminClient
    .from("app_settings")
    .select("value")
    .eq("key", SYSTEM_PROMPT_KEY)
    .maybeSingle();
  if (error) throw error;
  return data?.value || null;
}

export async function getSetting(adminClient, key) {
  const { data, error } = await adminClient
    .from("app_settings")
    .select("key, value, description, updated_at, updated_by")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Upsert a setting and stamp the editor's user id (when provided).
export async function upsertSetting(adminClient, { key, value, description, updatedBy }) {
  const row = {
    key,
    value,
    ...(description !== undefined ? { description } : {}),
    ...(updatedBy ? { updated_by: updatedBy } : {}),
  };
  const { data, error } = await adminClient
    .from("app_settings")
    .upsert(row, { onConflict: "key" })
    .select("key, value, description, updated_at, updated_by")
    .single();
  if (error) throw error;
  return data;
}
