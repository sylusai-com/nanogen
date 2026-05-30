// src/lib/server/security.js
//
// Server-side security utilities for API routes:
//
//   - readJson(req, { maxBytes })
//       Body parser with a hard byte cap. Stops a malicious caller from
//       streaming a multi-MB JSON to exhaust the model's context window
//       (which costs us money) or to OOM the route.
//
//   - validateString(value, { name, max, pattern, required })
//       Strict string validator. Throws ValidationError with a clear
//       message that gets reflected straight back in 400 responses.
//
//   - originAllowed(req)
//       Origin/Referer check for state-changing requests — defends
//       against CSRF when the request is made from a different site.
//
//   - rateLimit({ key, max, windowMs })
//       In-memory sliding-window rate limit keyed on user id or IP.
//       Returns { ok, retryAfter } so callers can surface a 429.
//
// All of these are intentionally dependency-free. Nothing here persists
// across deploys; the rate-limit map is best-effort process-local. For
// production hardening across multiple instances, swap in Redis.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Body parsing — capped JSON read
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_BYTES = 64 * 1024; // 64 KB is plenty for prompts/configs

export async function readJson(req, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) {
    throw new ValidationError(`Body too large (max ${maxBytes} bytes)`, 413);
  }
  // Even if Content-Length lied, cap during the read.
  const reader = req.body?.getReader();
  if (!reader) {
    try { return await req.json(); } catch { throw new ValidationError("Invalid JSON"); }
  }
  let total = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      throw new ValidationError(`Body too large (max ${maxBytes} bytes)`, 413);
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  const text = new TextDecoder("utf-8").decode(buf);
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new ValidationError("Invalid JSON"); }
}

// ─────────────────────────────────────────────────────────────────────
// Field validators
// ─────────────────────────────────────────────────────────────────────

export function validateString(
  value,
  { name = "field", max = 4000, min = 0, pattern, required = false, trim = true } = {},
) {
  if (value == null || value === "") {
    if (required) throw new ValidationError(`${name} is required`);
    return "";
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${name} must be a string`);
  }
  const v = trim ? value.trim() : value;
  if (v.length < min) throw new ValidationError(`${name} too short (min ${min})`);
  if (v.length > max) throw new ValidationError(`${name} too long (max ${max})`);
  if (pattern && !pattern.test(v)) throw new ValidationError(`${name} has invalid format`);
  return v;
}

export function validateEnum(value, allowed, { name = "field", required = false } = {}) {
  if (value == null) {
    if (required) throw new ValidationError(`${name} is required`);
    return null;
  }
  if (!allowed.includes(value)) {
    throw new ValidationError(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

// ─────────────────────────────────────────────────────────────────────
// CSRF defence — origin/referer allow-list
// ─────────────────────────────────────────────────────────────────────

export function originAllowed(req) {
  // Only enforce on state-changing methods.
  const method = req.method?.toUpperCase();
  if (!method || method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const origin  = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host    = req.headers.get("host");

  // Same-origin browsers always send Origin on POST. Servers calling our
  // API directly may not — accept those when they aren't sending an
  // Origin at all (no XSS vector if there's no browser involved).
  if (!origin && !referer) return true;

  const allowed = [];
  if (host) allowed.push(`https://${host}`, `http://${host}`);
  if (process.env.NEXT_PUBLIC_SITE_URL) allowed.push(process.env.NEXT_PUBLIC_SITE_URL);

  const candidate = origin || referer;
  if (!candidate) return false;
  try {
    const u = new URL(candidate);
    return allowed.some((a) => candidate.startsWith(a) || u.host === host);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Rate limiting (in-process, sliding window)
// ─────────────────────────────────────────────────────────────────────

const buckets = new Map();   // key → number[] of request timestamps

export function rateLimit({ key, max = 30, windowMs = 60_000 }) {
  if (!key) return { ok: true, remaining: max, retryAfter: 0 };
  const now    = Date.now();
  const cutoff = now - windowMs;

  let arr = buckets.get(key);
  if (!arr) { arr = []; buckets.set(key, arr); }

  // Drop expired timestamps.
  while (arr.length && arr[0] < cutoff) arr.shift();

  if (arr.length >= max) {
    const retryAfter = Math.ceil((arr[0] + windowMs - now) / 1000);
    return { ok: false, remaining: 0, retryAfter };
  }
  arr.push(now);

  // Garbage-collect once in a while so the map doesn't grow unbounded.
  if (Math.random() < 0.01) {
    for (const [k, v] of buckets) {
      while (v.length && v[0] < cutoff) v.shift();
      if (!v.length) buckets.delete(k);
    }
  }

  return { ok: true, remaining: max - arr.length, retryAfter: 0 };
}

// Lift `req`'s best client identifier — user id when authenticated,
// otherwise the X-Forwarded-For first hop. Use the result as the rate-
// limit key so authenticated abuse is tracked per user, not per IP.
export function clientKey(req, userId = null) {
  if (userId) return `u:${userId}`;
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip  = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  return `ip:${ip}`;
}

// Convenience: turn a thrown ValidationError into a JSON response.
export function errorResponse(e) {
  if (e instanceof ValidationError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("Internal Server Error caught in security helper:", e);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}

// Server-side auth helper for routes that must be signed in.
export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, user };
}

// Server-side admin helper for route handlers.
export async function validateAdminRole(supabase = null) {
  const client = supabase || (await createClient());
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    throw new ValidationError("Unauthorized", 401);
  }

  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new ValidationError(`Failed to verify admin role: ${error.message}`, 500);
  }
  if (profile?.role !== "admin") {
    throw new ValidationError("Forbidden", 403);
  }

  return { user, supabase: client };
}
