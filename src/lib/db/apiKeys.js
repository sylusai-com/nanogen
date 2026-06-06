// src/lib/db/apiKeys.js
//
// CRUD + validation helpers for the api_keys and api_usage_logs tables.
// Key generation uses a "ngn_" prefix + 40 random hex chars. We store
// only the SHA-256 hash — the plaintext is shown to the user exactly once
// at creation time.

import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────
// Key generation
// ─────────────────────────────────────────────────────────────────────

function generateRawKey() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `ngn_${hex}`;
}

async function hashKey(raw) {
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// ─────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a new API key for a user.
 * Returns { key, ...row } — `key` is the plaintext shown once.
 */
export async function createApiKey(supabase, userId, { name = "Untitled key", scopes = [] } = {}) {
  const raw = generateRawKey();
  const keyHash = await hashKey(raw);
  const keyPrefix = raw.slice(0, 8);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
    })
    .select("id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, is_active, created_at, expires_at")
    .single();

  if (error) throw error;
  return { ...data, key: raw };
}

/**
 * List all API keys for a user (no secrets — only prefix shown).
 */
export async function listApiKeys(supabase, userId) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, is_active, last_used_at, created_at, expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Revoke an API key (soft-delete — sets is_active = false).
 */
export async function revokeApiKey(supabase, userId, keyId) {
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Delete an API key permanently.
 */
export async function deleteApiKey(supabase, userId, keyId) {
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Validation (server-side — called from public API routes)
// ─────────────────────────────────────────────────────────────────────

/**
 * Validate a raw API key. Returns the key row if valid, or null.
 * Uses the admin client to bypass RLS (API routes don't have a session).
 */
export async function validateApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string" || !rawKey.startsWith("ngn_")) {
    return null;
  }

  const keyHash = await hashKey(rawKey);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("api_keys")
    .select("id, user_id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, is_active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update last_used_at (best-effort, don't block)
  admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return data;
}

// ─────────────────────────────────────────────────────────────────────
// Rate-limit checks against the key's RPM/RPD
// ─────────────────────────────────────────────────────────────────────

/**
 * Check whether the key has exceeded its rate limits.
 * Returns { ok, retryAfter, remaining } or { ok: false, reason }.
 */
export async function checkKeyRateLimit(keyRow) {
  const admin = createAdminClient();
  const now = new Date();

  // RPM check — count requests in the last 60 seconds
  const oneMinAgo = new Date(now.getTime() - 60_000).toISOString();
  const { count: rpmCount, error: rpmErr } = await admin
    .from("api_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyRow.id)
    .gte("created_at", oneMinAgo);

  if (rpmErr) return { ok: true }; // fail open
  if (rpmCount >= keyRow.rate_limit_rpm) {
    return { ok: false, reason: "rate_limit_rpm", retryAfter: 60 };
  }

  // RPD check — count requests since midnight UTC
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: rpdCount, error: rpdErr } = await admin
    .from("api_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyRow.id)
    .gte("created_at", todayStart.toISOString());

  if (rpdErr) return { ok: true }; // fail open
  if (rpdCount >= keyRow.rate_limit_rpd) {
    return { ok: false, reason: "rate_limit_rpd", retryAfter: 3600 };
  }

  return {
    ok: true,
    remaining: {
      rpm: keyRow.rate_limit_rpm - rpmCount,
      rpd: keyRow.rate_limit_rpd - rpdCount,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Usage logging
// ─────────────────────────────────────────────────────────────────────

/**
 * Log an API request. Best-effort — never throws.
 */
export async function logApiUsage({
  keyId,
  userId,
  modelSlug = null,
  endpoint = "/v1/generate",
  statusCode = 200,
  latencyMs = null,
  ip = null,
}) {
  try {
    const admin = createAdminClient();
    await admin.from("api_usage_logs").insert({
      api_key_id: keyId,
      user_id: userId,
      model_slug: modelSlug,
      endpoint,
      status_code: statusCode,
      latency_ms: latencyMs,
      ip_address: ip,
    });
  } catch {
    // telemetry only — don't break the request
  }
}

// ─────────────────────────────────────────────────────────────────────
// Usage stats (for dashboards)
// ─────────────────────────────────────────────────────────────────────

/**
 * Get usage stats for a specific user's keys.
 */
export async function getUserApiStats(supabase, userId) {
  // Total requests today
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count: todayCount } = await supabase
    .from("api_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString());

  // Total requests all time
  const { count: totalCount } = await supabase
    .from("api_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Active keys count
  const { count: activeKeys } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);

  // Daily usage for last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data: recentLogs } = await supabase
    .from("api_usage_logs")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", fourteenDaysAgo)
    .order("created_at", { ascending: true });

  const daily = aggregateDaily(recentLogs || [], 14);

  return {
    todayRequests: todayCount || 0,
    totalRequests: totalCount || 0,
    activeKeys: activeKeys || 0,
    daily,
  };
}

/**
 * Get platform-wide API stats (admin only).
 */
export async function getAdminApiStats(adminClient) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    { count: totalKeys },
    { count: activeKeys },
    { count: todayRequests },
    { count: totalRequests },
  ] = await Promise.all([
    adminClient.from("api_keys").select("id", { count: "exact", head: true }),
    adminClient.from("api_keys").select("id", { count: "exact", head: true }).eq("is_active", true),
    adminClient.from("api_usage_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
    adminClient.from("api_usage_logs").select("id", { count: "exact", head: true }),
  ]);

  // Daily usage for last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data: recentLogs } = await adminClient
    .from("api_usage_logs")
    .select("created_at")
    .gte("created_at", fourteenDaysAgo)
    .order("created_at", { ascending: true });

  const daily = aggregateDaily(recentLogs || [], 14);

  // Top users by request count
  const { data: topUsersRaw } = await adminClient
    .from("api_usage_logs")
    .select("user_id, profiles(name, email)")
    .gte("created_at", fourteenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(500);

  const userMap = new Map();
  for (const row of topUsersRaw || []) {
    const cur = userMap.get(row.user_id) || {
      userId: row.user_id,
      name: row.profiles?.name || "",
      email: row.profiles?.email || "",
      requests: 0,
    };
    cur.requests += 1;
    userMap.set(row.user_id, cur);
  }
  const topUsers = [...userMap.values()]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);

  // Recent requests
  const { data: recentRequests } = await adminClient
    .from("api_usage_logs")
    .select("id, api_key_id, user_id, model_slug, endpoint, status_code, latency_ms, ip_address, created_at, profiles(name, email)")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    totalKeys: totalKeys || 0,
    activeKeys: activeKeys || 0,
    todayRequests: todayRequests || 0,
    totalRequests: totalRequests || 0,
    daily,
    topUsers,
    recentRequests: recentRequests || [],
  };
}

// Bucket log rows into per-day counts for the last N days.
function aggregateDaily(rows, days) {
  const buckets = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  for (const r of rows) {
    const key = r.created_at?.slice(0, 10);
    if (key && key in buckets) buckets[key] += 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, requests]) => ({ date, requests }));
}
