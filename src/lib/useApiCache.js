"use client";

import { useCachedQuery } from "./cache";

/**
 * Hook to fetch and cache API responses with automatic stale-while-revalidate.
 * Uses the global cache system to avoid redundant API calls across page transitions.
 * 
 * @param {string} url - API endpoint URL
 * @param {object} options - Cache options
 * @param {number} options.ttlMs - Cache TTL in milliseconds (default: 60s)
 * @param {array} options.tags - Invalidation tags (default: [])
 * @param {boolean} options.enabled - Whether to fetch (default: true)
 * 
 * @returns {object} { data, error, isLoading, isValidating, refresh, isStale }
 */
export function useApiCache(url, { ttlMs = 60_000, tags = [], enabled = true, persist = true } = {}) {
  return useCachedQuery(
    ["api", url],
    async () => {
      const res = await fetch(url, {
        credentials: "same-origin",
        // Allow the HTTP cache to serve a fresh response within its
        // Cache-Control window — `no-store` defeated browser caching
        // entirely, so every navigation hit the network even when the
        // payload hadn't changed. Server routes now set explicit
        // private/max-age + stale-while-revalidate headers.
        cache: "default",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || `API error: ${res.status}`);
      }
      return res.json();
    },
    { ttlMs, tags, enabled, persist },
  );
}
