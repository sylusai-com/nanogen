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
// reload). A subset of entries is mirrored into sessionStorage so client-
// side navigation back to a page hydrates instantly — the in-memory tier
// is checked first, then sessionStorage fills the gap when the user
// hard-reloads. sessionStorage is per-tab and cleared on close, so we
// don't leak data across users on shared machines.
//
// Entries can opt OUT of persistence by passing `persist: false` on set.
// That's used for anything containing data: URIs (banner html/css) since
// they'd blow past the ~5MB sessionStorage quota in a handful of rows.
// ─────────────────────────────────────────────────────────────────────────

const cache    = new Map();    // key → { value, expiresAt, tags, persist }
const watchers = new Map();    // key → Set<() => void>
const pending  = new Map();    // key → Promise (request coalescing)

const SS_PREFIX     = "nano-cache:v1:";
const SS_QUOTA_BYTES = 2_500_000; // ~2.5 MB cap before we stop persisting

let ssAvailable = null;
function hasSessionStorage() {
  if (ssAvailable !== null) return ssAvailable;
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      ssAvailable = false; return false;
    }
    const probeKey = `${SS_PREFIX}__probe__`;
    window.sessionStorage.setItem(probeKey, "1");
    window.sessionStorage.removeItem(probeKey);
    ssAvailable = true;
  } catch {
    ssAvailable = false;
  }
  return ssAvailable;
}

function ssWrite(k, entry) {
  if (!hasSessionStorage()) return;
  try {
    const payload = JSON.stringify({
      value: entry.value,
      expiresAt: entry.expiresAt,
      tags: [...(entry.tags || [])],
    });
    if (payload.length > SS_QUOTA_BYTES) return;
    window.sessionStorage.setItem(SS_PREFIX + k, payload);
  } catch {
    // QuotaExceededError or serializable-cycle — drop the persist
    // silently. The in-memory tier still has the value.
  }
}

function ssDelete(k) {
  if (!hasSessionStorage()) return;
  try { window.sessionStorage.removeItem(SS_PREFIX + k); } catch { /* noop */ }
}

function ssRead(k) {
  if (!hasSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(SS_PREFIX + k);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expiresAt && parsed.expiresAt < Date.now()) {
      ssDelete(k);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// On first import in the browser, hydrate the in-memory cache from
// sessionStorage. Entries are restored with their original tags so
// invalidation still works.
if (typeof window !== "undefined" && hasSessionStorage()) {
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key || !key.startsWith(SS_PREFIX)) continue;
      const k = key.slice(SS_PREFIX.length);
      const parsed = ssRead(k);
      if (!parsed) continue;
      cache.set(k, {
        value: parsed.value,
        expiresAt: parsed.expiresAt || 0,
        tags: new Set(parsed.tags || []),
        persist: true,
      });
    }
  } catch { /* hydration is best-effort */ }
}

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

export function setCached(key, value, { ttlMs = 60_000, tags = [], persist = true } = {}) {
  const k = keyOf(key);
  const entry = {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    tags: new Set(tags),
    persist,
  };
  cache.set(k, entry);
  if (persist) ssWrite(k, entry); else ssDelete(k);
  for (const fn of watchers.get(k) || []) fn();
  notifyGlobal();
}

// Invalidation default: SOFT. We keep the cached value but mark it
// stale so useCachedQuery shows the old data immediately and refetches
// in the background — that's the SWR pattern the gallery needs. The
// previous hard-delete behaviour caused the banner grid to flash
// skeletons every time a mutation invalidated the list, because the
// component then had `data === undefined` until the refetch landed.
//
// Pass `{ hard: true }` to force a true delete (used on signOut or when
// the entry is genuinely gone, e.g. a 404 row).
export function invalidate(key, { hard = false } = {}) {
  const k = keyOf(key);
  if (hard) {
    cache.delete(k);
    ssDelete(k);
  } else {
    const entry = cache.get(k);
    if (entry) {
      // expiresAt < now() marks the entry stale without removing the
      // value — getCached / useCachedQuery still return it as the data
      // for the next render, but flag it for revalidation.
      entry.expiresAt = 1;
    } else {
      // Nothing to soft-invalidate; nuke it anyway in case ssRead has
      // a copy we haven't hydrated yet.
      ssDelete(k);
    }
  }
  pending.delete(k);
  for (const fn of watchers.get(k) || []) fn();
  notifyGlobal();
}

export function invalidateTags(tags, { hard = false } = {}) {
  if (!Array.isArray(tags)) tags = [tags];
  const tagSet = new Set(tags);
  for (const [k, entry] of cache) {
    if (entry.tags && [...entry.tags].some((t) => tagSet.has(t))) {
      if (hard) {
        cache.delete(k);
        ssDelete(k);
      } else {
        entry.expiresAt = 1;
      }
      pending.delete(k);
      for (const fn of watchers.get(k) || []) fn();
    }
  }
  notifyGlobal();
}

export function clearCache() {
  cache.clear();
  pending.clear();
  if (hasSessionStorage()) {
    try {
      const toDelete = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(SS_PREFIX)) toDelete.push(key);
      }
      toDelete.forEach((k) => window.sessionStorage.removeItem(k));
    } catch { /* noop */ }
  }
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
// Exported so callers driving their own fetch loops (e.g. the infinite-
// scroll gallery) can re-run when tags are invalidated elsewhere.
export function useCacheTick() {
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
  const { ttlMs = 60_000, tags = [], enabled = true, persist = true } = options;
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
          setCached(k, v, {
            ttlMs,
            tags: tagsKey ? tagsKey.split("|") : [],
            persist,
          });
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
    [k, ttlMs, tagsKey, enabled, persist],
  );

  // First-mount + stale revalidation + re-fetch after invalidation.
  // The previous deps array was `[k, enabled]` only, which meant a
  // tag invalidation deleted the cache entry, the watcher fired a
  // re-render, but this effect never re-ran (k/enabled didn't change),
  // so the new render saw `hit: undefined` and just sat there. The
  // visible symptom: after generating a banner, `invalidateTags`
  // dropped the cached list but the gallery never repopulated.
  //
  // Adding `hasHit`/`fresh` to the deps re-arms the effect whenever
  // the cache state actually transitions, which is exactly when we
  // need to decide whether to fetch.
  const hasHit = !!hit;
  useEffect(() => {
    if (!enabled) return;
    if (!hasHit || !fresh) {
      Promise.resolve().then(() => {
        run({ silent: hasHit }).catch(() => {});
      });
    }
    // run is stable via useCallback (key in its deps); excluding it
    // here avoids loop-on-every-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled, hasHit, fresh]);

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
