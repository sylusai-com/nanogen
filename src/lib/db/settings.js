// src/lib/db/settings.js
//
// Generic key/value access for the `app_settings` table. RLS restricts
// reads to admins, so this module is meant to be used with the admin
// (service-role) client.
//
// Prompt-specific reads/writes live in src/lib/prompts.js — that module
// is the single source of truth for which keys exist, how they're
// serialized, and what the in-code defaults are. Don't reintroduce
// hard-coded prompt logic here.

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
