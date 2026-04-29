// src/lib/cache.js
// Tiny dependency-free client cache with TTL, tag-based invalidation, and
// stale-while-revalidate semantics. The shape is small on purpose — it lets
// us memoize Supabase queries (catalogs, models, banner lists) across page
// transitions without dragging in React Query / SWR.
//
// Usage from a component:
//
//   const banners = useCachedQuery(
//     ["banners", userId],
//     () => listBanners(supabase),
//     { ttlMs: 60_000, tags: ["banners"] },
//   );
//
// Usage from anywhere (no React):
//
//   const styles = await cachedQuery(
//     ["styles"],
//     () => listBannerStyles(supabase),
//     { ttlMs: 5 * 60_000, tags: ["styles"] },
//   );
//   invalidateTags(["styles"]); // after a mutation

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Module-level cache. Lives for the lifetime of the page (cleared on full
// reload, but persists across client-side navigations). We deliberately
// don't use sessionStorage so we don't leak per-user data on shared
// machines — this is a memory-only cache.
// ─────────────────────────────────────────────────────────────────────────

const cache    = new Map();    // key → { value, expiresAt, tags, inflight }
const watchers = new Map();    // key → Set<() => void>
const pending  = new Map();    // key → Promise (request coalescing)

// Bumped every time something invalidates so we can drive a global tick
// listener (used by useCachedQuery to refresh stale data without polling).
let globalTick = 0;
const globalListeners = new Set();
function notifyGlobal() {
  globalTick++;
  for (const l of globalListeners) l();
}

// ─────────────────────────────────────────────────────────────────────────
// Key normalization
// ─────────────────────────────────────────────────────────────────────────

function keyOf(key) {
  if (typeof key === "string") return key;
  if (Array.isArray(key)) return key.map(stringify).join("|");
  return stringify(key);
}
function stringify(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

// ─────────────────────────────────────────────────────────────────────────
// Core API
// ─────────────────────────────────────────────────────────────────────────

export function getCached(key) {
  const k     = keyOf(key);
  const entry = cache.get(k);
  if (!entry) return undefined;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    // Mark stale but keep value around — useful for SWR.
    return { value: entry.value, stale: true };
  }
  return { value: entry.value, stale: false };
}

export function setCached(key, value, { ttlMs = 60_000, tags = [] } = {}) {
  const k = keyOf(key);
  cache.set(k, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    tags: new Set(tags),
  });
  for (const fn of watchers.get(k) || []) fn();
  notifyGlobal();
}

export function invalidate(key) {
  const k = keyOf(key);
  cache.delete(k);
  pending.delete(k);
  for (const fn of watchers.get(k) || []) fn();
  notifyGlobal();
}

export function invalidateTags(tags) {
  if (!Array.isArray(tags)) tags = [tags];
  const tagSet = new Set(tags);
  for (const [k, entry] of cache) {
    if (entry.tags && [...entry.tags].some((t) => tagSet.has(t))) {
      cache.delete(k);
      pending.delete(k);
      for (const fn of watchers.get(k) || []) fn();
    }
  }
  notifyGlobal();
}

export function clearCache() {
  cache.clear();
  pending.clear();
  for (const set of watchers.values()) for (const fn of set) fn();
  notifyGlobal();
}

// Promise-coalescing fetch wrapper. Two concurrent callers asking for the
// same key get the same in-flight promise.
export async function cachedQuery(
  key,
  fetcher,
  { ttlMs = 60_000, tags = [], force = false } = {},
) {
  const k    = keyOf(key);
  const hit  = cache.get(k);

  if (!force && hit && (!hit.expiresAt || hit.expiresAt >= Date.now())) {
    return hit.value;
  }

  if (pending.has(k)) return pending.get(k);

  const p = (async () => {
    try {
      const value = await fetcher();
      setCached(k, value, { ttlMs, tags });
      return value;
    } finally {
      pending.delete(k);
    }
  })();
  pending.set(k, p);
  return p;
}

// ─────────────────────────────────────────────────────────────────────────
// React bindings
// ─────────────────────────────────────────────────────────────────────────

function subscribeKey(k, fn) {
  let set = watchers.get(k);
  if (!set) { set = new Set(); watchers.set(k, set); }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (!set.size) watchers.delete(k);
  };
}

// Subscribe to global cache ticks — lets components participate in SWR
// without each one wiring its own subscription. Using
// useSyncExternalStore avoids tearing on concurrent renders.
function useCacheTick() {
  return useSyncExternalStore(
    (cb) => {
      globalListeners.add(cb);
      return () => globalListeners.delete(cb);
    },
    () => globalTick,
    () => 0,
  );
}

// React hook with stale-while-revalidate semantics.
//
// Returns { data, error, isLoading, isValidating, refresh }.
// Uses the cached value (even if stale) for the first render, and triggers
// a background revalidation when the entry is stale or missing.
export function useCachedQuery(key, fetcher, options = {}) {
  const { ttlMs = 60_000, tags = [], enabled = true } = options;
  const k       = keyOf(key);
  const tagsKey = tags.join("|");

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Re-render when this specific key updates OR when the global tick fires
  // (covers tag-based invalidation + clearCache).
  useCacheTick();
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    return subscribeKey(k, () => force((n) => n + 1));
  }, [k, enabled]);

  const hit = cache.get(k);
  const fresh = !!hit && (!hit.expiresAt || hit.expiresAt >= Date.now());
  const data  = hit ? hit.value : undefined;
  const stale = !!hit && !fresh;

  const [error, setError]               = useState(null);
  const [isValidating, setValidating]   = useState(false);

  const run = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) return;
      if (pending.has(k)) {
        // Already in-flight — let it complete and re-render via the
        // watcher subscription above.
        return pending.get(k);
      }
      if (!silent) setValidating(true);
      setError(null);
      try {
        const p = (async () => {
          const v = await fetcherRef.current();
          // Tags are passed via tagsKey for stable identity; rebuild on call.
          setCached(k, v, { ttlMs, tags: tagsKey ? tagsKey.split("|") : [] });
          return v;
        })();
        pending.set(k, p);
        try { await p; } finally { pending.delete(k); }
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setValidating(false);
      }
    },
    [k, ttlMs, tagsKey, enabled],
  );

  // First-mount + stale revalidation. We schedule via a microtask so the
  // setState calls inside run() happen outside the effect body — keeps
  // the React 19 set-state-in-effect lint rule happy without changing
  // behaviour.
  useEffect(() => {
    if (!enabled) return;
    if (!hit || !fresh) {
      Promise.resolve().then(() => {
        run({ silent: !!hit }).catch(() => {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled]);

  return {
    data,
    error,
    isLoading: !hit && (isValidating || pending.has(k)),
    isValidating,
    isStale: stale,
    refresh: useCallback(() => run({ silent: false }), [run]),
  };
}

// Mutation helper — invalidates one or more tags after a fn resolves.
//   const { mutate, isMutating } = useMutate(
//     (form) => createBannerStyle(supabase, form),
//     { invalidateTags: ["styles"] },
//   );
export function useMutate(fn, { invalidateTags: tags = [] } = {}) {
  const [isMutating, setMutating] = useState(false);
  const [error, setError]         = useState(null);
  const tagsKey = tags.join("|");

  const mutate = useCallback(
    async (...args) => {
      setMutating(true);
      setError(null);
      try {
        const result = await fn(...args);
        const list = tagsKey ? tagsKey.split("|") : [];
        if (list.length) invalidateTags(list);
        return result;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [fn, tagsKey],
  );

  return { mutate, isMutating, error };
}

// Reset everything when the user signs out — call this from AuthProvider's
// signOut path to avoid showing stale data to the next user on the same
// device.
export const onSignOut = clearCache;
