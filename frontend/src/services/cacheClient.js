/**
 * High-Performance Client Data Cache & Request Deduplicator
 * Features:
 * - Instant frame-0 rendering of cached data (0ms latency for visited views)
 * - Transparent in-flight request deduplication across components
 * - Stale-While-Revalidate (SWR) background data refresh
 * - Resource-tuned TTLs and Garbage Collection
 * - Auto-invalidation on real-time WebSocket events and mutations
 * - Complete user-scoped isolation & purge on logout
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { realtimeClient } from '../realtime/websocketClient';

// Resource-specific freshness (stale) and garbage collection (gc) durations in milliseconds
export const CACHE_POLICIES = {
  'dashboard:stats': { stale: 30 * 1000, gc: 5 * 60 * 1000 },
  'dashboard:trends': { stale: 60 * 1000, gc: 10 * 60 * 1000 },
  'leaderboard': { stale: 60 * 1000, gc: 10 * 60 * 1000 },
  'vendors': { stale: 30 * 1000, gc: 5 * 60 * 1000 },
  'tasks': { stale: 30 * 1000, gc: 5 * 60 * 1000 },
  'managers': { stale: 60 * 1000, gc: 10 * 60 * 1000 },
  'agents': { stale: 60 * 1000, gc: 10 * 60 * 1000 },
  'notifications': { stale: 15 * 1000, gc: 3 * 60 * 1000 },
  'locations': { stale: 15 * 60 * 1000, gc: 60 * 60 * 1000 },
  'default': { stale: 30 * 1000, gc: 5 * 60 * 1000 }
};

export class CacheClient {
  constructor() {
    this.store = new Map(); // key -> { data, fetchedAt, staleAt, gcAt }
    this.inFlight = new Map(); // key -> Promise
    this.listeners = new Map(); // key -> Set<callback>
    this.patternListeners = new Set(); // Set<{ pattern, callback }>
    this.currentUserId = null;

    // Start background garbage collection timer every 30s
    if (typeof window !== 'undefined') {
      this.gcTimer = setInterval(() => this.runGarbageCollection(), 30000);
      this.initRealtimeSync();
    }
  }

  setCurrentUser(user) {
    const nextId = user?.id || user?._id || null;
    if (this.currentUserId && nextId && this.currentUserId !== nextId) {
      // User switched! Wipe entire cache to avoid cross-user data leakage
      this.clear();
    }
    this.currentUserId = nextId;
  }

  getPolicy(key) {
    for (const [prefix, policy] of Object.entries(CACHE_POLICIES)) {
      if (prefix !== 'default' && key.startsWith(prefix)) {
        return policy;
      }
    }
    return CACHE_POLICIES.default;
  }

  initRealtimeSync() {
    try {
      realtimeClient.on('*', (event) => {
        if (!event || !event.entity) return;
        this.invalidateEntity(event.entity);
      });
    } catch (err) {
      console.warn('[CacheClient] Realtime event listener binding deferred:', err);
    }
  }

  runGarbageCollection() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.gcAt) {
        this.store.delete(key);
      }
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isStale = now > entry.staleAt;
    return {
      data: entry.data,
      isStale,
      fetchedAt: entry.fetchedAt
    };
  }

  set(key, data, customPolicy = null) {
    const now = Date.now();
    const policy = customPolicy || this.getPolicy(key);
    const entry = {
      data,
      fetchedAt: now,
      staleAt: now + (policy.stale || 30000),
      gcAt: now + (policy.gc || 300000)
    };

    this.store.set(key, entry);
    this.notifyListeners(key, data);
    return data;
  }

  async fetchWithCache(key, fetcher, options = {}) {
    const { force = false, customPolicy = null } = options;
    const now = Date.now();
    const existing = this.store.get(key);

    // 1. Fresh cache hit: Return immediately (0ms)
    if (!force && existing && now <= existing.staleAt) {
      return existing.data;
    }

    // 2. In-flight request deduplication: Join ongoing network call
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    // 3. Stale cache exists (SWR): Return stale data immediately, revalidate silently in background
    if (!force && existing && now > existing.staleAt) {
      this.revalidateInBackground(key, fetcher, customPolicy);
      return existing.data;
    }

    // 4. Cache miss: Fetch and cache
    const promise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data, customPolicy);
        return data;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  async revalidateInBackground(key, fetcher, customPolicy) {
    if (this.inFlight.has(key)) return;

    const promise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data, customPolicy);
        return data;
      } catch (err) {
        console.warn(`[CacheClient] Background revalidation failed for ${key}:`, err?.message);
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
  }

  invalidateQueries(prefixOrPattern) {
    const isRegex = prefixOrPattern instanceof RegExp;
    const keysToPurge = [];

    for (const key of this.store.keys()) {
      const matches = isRegex ? prefixOrPattern.test(key) : key.startsWith(prefixOrPattern);
      if (matches) {
        keysToPurge.push(key);
      }
    }

    keysToPurge.forEach(key => {
      // Mark as stale immediately so next view revalidates
      const entry = this.store.get(key);
      if (entry) {
        entry.staleAt = 0;
      }
      this.notifyListeners(key, entry ? entry.data : null, true);
    });
  }

  invalidateEntity(entity) {
    const e = String(entity || '').toLowerCase();
    if (e.includes('vendor')) {
      this.invalidateQueries('vendors');
      this.invalidateQueries('dashboard:stats');
      this.invalidateQueries('reports');
    } else if (e.includes('task')) {
      this.invalidateQueries('tasks');
      this.invalidateQueries('dashboard:stats');
    } else if (e.includes('manager')) {
      this.invalidateQueries('managers');
      this.invalidateQueries('dashboard:stats');
      this.invalidateQueries('leaderboard');
    } else if (e.includes('agent')) {
      this.invalidateQueries('agents');
      this.invalidateQueries('dashboard:stats');
      this.invalidateQueries('leaderboard');
    } else if (e.includes('notification')) {
      this.invalidateQueries('notifications');
    } else {
      // Generic refresh for dashboard
      this.invalidateQueries('dashboard:stats');
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(key);
      }
    };
  }

  notifyListeners(key, data, isInvalidated = false) {
    const set = this.listeners.get(key);
    if (set) {
      set.forEach(cb => {
        try {
          cb(data, isInvalidated);
        } catch (e) {
          console.error('[CacheClient] Listener error:', e);
        }
      });
    }
  }

  clear() {
    this.store.clear();
    this.inFlight.clear();
    this.currentUserId = null;
    console.log('🧹 [CacheClient] Client-side data cache wiped cleanly.');
  }

  getStats() {
    return {
      entriesCount: this.store.size,
      inFlightCount: this.inFlight.size,
      listenersCount: this.listeners.size
    };
  }
}

export const cacheClient = new CacheClient();

/**
 * High-performance React hook for cached data with Stale-While-Revalidate (SWR)
 */
export function useCachedQuery(key, fetcher, options = {}) {
  const { enabled = true, customPolicy = null } = options;

  // Frame 0 synchronous cache probe
  const initialCache = enabled && key ? cacheClient.get(key) : null;

  const [data, setData] = useState(() => initialCache?.data || null);
  const [loading, setLoading] = useState(() => (enabled && key ? !initialCache : false));
  const [isStale, setIsStale] = useState(() => initialCache?.isStale || false);
  const [error, setError] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const executeFetch = useCallback(async (force = false) => {
    if (!enabled || !key) return;

    const currentCached = cacheClient.get(key);
    if (!currentCached && !force) {
      setLoading(true);
    }

    try {
      setError(null);
      const res = await cacheClient.fetchWithCache(
        key,
        () => fetcherRef.current(),
        { force, customPolicy }
      );
      setData(res);
      setIsStale(false);
      return res;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [key, enabled, customPolicy]);

  useEffect(() => {
    if (!enabled || !key) return;

    // Check cache on key changes
    const cached = cacheClient.get(key);
    if (cached) {
      setData(cached.data);
      setIsStale(cached.isStale);
      setLoading(false);

      if (cached.isStale) {
        executeFetch(true).catch(() => {});
      }
    } else {
      executeFetch().catch(() => {});
    }

    // Subscribe to external updates or invalidations
    const unsubscribe = cacheClient.subscribe(key, (newData, isInvalidated) => {
      if (newData !== null && newData !== undefined) {
        setData(newData);
        setIsStale(false);
      }
      if (isInvalidated) {
        setIsStale(true);
        executeFetch(true).catch(() => {});
      }
    });

    return () => {
      unsubscribe();
    };
  }, [key, enabled, executeFetch]);

  const mutate = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      cacheClient.set(key, next, customPolicy);
      return next;
    });
  }, [key, customPolicy]);

  return {
    data,
    loading,
    isStale,
    error,
    refetch: () => executeFetch(true),
    mutate
  };
}
