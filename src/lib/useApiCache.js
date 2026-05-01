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
export function useApiCache(url, { ttlMs = 60_000, tags = [], enabled = true } = {}) {
  return useCachedQuery(
    ["api", url],
    async () => {
      const res = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || `API error: ${res.status}`);
      }
      return res.json();
    },
    { ttlMs, tags, enabled },
  );
}
