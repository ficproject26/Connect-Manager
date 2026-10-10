/**
 * Centralized Cache Manager with Real-Time Invalidation
 * Enforces: REAL-TIME CORRECTNESS HAS PRIORITY OVER CACHE SPEED.
 * Whenever data changes, affected keys and patterns are immediately invalidated
 * across all connected backend nodes via Redis Pub/Sub.
 */

const redisBroker = require('../redis/redisClient');
const { CHANNELS } = require('../events/eventStandards');

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.ttlTimers = new Map();
    this.inFlight = new Map(); // Key -> Promise for stampede protection / request coalescing
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      coalesced: 0
    };

    this.initCrossNodeSync();
  }

  initCrossNodeSync() {
    // Listen for remote invalidation signals from other backend instances
    redisBroker.subscribe(CHANNELS.CACHE, (event) => {
      if (event && event.type === 'CACHE_INVALIDATE') {
        if (event.pattern) {
          this.purgeLocalPattern(event.pattern, false);
        } else if (event.key) {
          this.purgeLocalKey(event.key, false);
        } else if (event.entity) {
          this.purgeLocalEntity(event.entity, event.entityId, false);
        }
      }
    });
  }

  async get(key) {
    // 1. Check in-memory cache (sub-millisecond instant hit)
    if (this.memoryCache.has(key)) {
      this.stats.hits++;
      return this.memoryCache.get(key);
    }

    // 2. Check Redis if connected
    if (redisBroker.isRedisConnected && redisBroker.pubClient) {
      try {
        const raw = await redisBroker.pubClient.get(`cache:${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.memoryCache.set(key, parsed);
          this.stats.hits++;
          return parsed;
        }
      } catch (err) {}
    }

    this.stats.misses++;
    return null;
  }

  async set(key, value, ttlSeconds = 300) {
    this.stats.sets++;
    this.memoryCache.set(key, value);

    // Set TTL cleanup timer in memory
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
    }
    const timer = setTimeout(() => {
      this.memoryCache.delete(key);
      this.ttlTimers.delete(key);
    }, ttlSeconds * 1000);
    timer.unref();
    this.ttlTimers.set(key, timer);

    // Store in Redis with TTL if connected
    if (redisBroker.isRedisConnected && redisBroker.pubClient) {
      try {
        await redisBroker.pubClient.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
      } catch (err) {}
    }

    return true;
  }

  /**
   * Request Coalescing / Cache Stampede Guard
   * Prevents multiple concurrent requests for the same missing/expired key
   * from hitting the database simultaneously.
   */
  async fetchWithCache(key, fetcher, ttlSeconds = 300) {
    // 1. Check existing cache
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    // 2. In-flight request deduplication: join ongoing execution
    if (this.inFlight.has(key)) {
      this.stats.coalesced++;
      return await this.inFlight.get(key);
    }

    // 3. Launch single backend execution
    const promise = (async () => {
      try {
        const data = await fetcher();
        if (data !== null && data !== undefined) {
          await this.set(key, data, ttlSeconds);
        }
        return data;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return await promise;
  }

  async del(key) {
    this.purgeLocalKey(key, true);
  }

  async purgeLocalKey(key, broadcast = true) {
    this.stats.invalidations++;
    this.memoryCache.delete(key);
    this.inFlight.delete(key);
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
      this.ttlTimers.delete(key);
    }

    if (broadcast) {
      redisBroker.publish(CHANNELS.CACHE, {
        type: 'CACHE_INVALIDATE',
        key,
        timestamp: Date.now()
      }).catch(() => {});
    }

    if (redisBroker.isRedisConnected && redisBroker.pubClient) {
      try {
        await redisBroker.pubClient.del(`cache:${key}`);
      } catch (e) {}
    }
  }

  async purgeLocalPattern(pattern, broadcast = true) {
    this.stats.invalidations++;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        this.inFlight.delete(key);
        if (this.ttlTimers.has(key)) {
          clearTimeout(this.ttlTimers.get(key));
          this.ttlTimers.delete(key);
        }
      }
    }

    if (broadcast) {
      redisBroker.publish(CHANNELS.CACHE, {
        type: 'CACHE_INVALIDATE',
        pattern,
        timestamp: Date.now()
      }).catch(() => {});
    }

    if (redisBroker.isRedisConnected && redisBroker.pubClient) {
      try {
        const redisPattern = `cache:${pattern}`;
        // Use non-blocking SCAN stream in ioredis to prevent locking Redis thread
        if (typeof redisBroker.pubClient.scanStream === 'function') {
          const stream = redisBroker.pubClient.scanStream({
            match: redisPattern,
            count: 100
          });
          stream.on('data', async (keys) => {
            if (keys && keys.length > 0) {
              const pipeline = redisBroker.pubClient.pipeline();
              keys.forEach(k => pipeline.del(k));
              await pipeline.exec().catch(() => {});
            }
          });
        } else {
          const keys = await redisBroker.pubClient.keys(redisPattern);
          if (keys && keys.length > 0) {
            await redisBroker.pubClient.del(...keys);
          }
        }
      } catch (e) {}
    }
  }

  async purgeLocalEntity(entity, entityId = null, broadcast = true) {
    const raw = String(entity).toLowerCase();
    const base = raw.replace(/s$/, ''); // normalize plural/singular (e.g. vendors -> vendor)

    // Purge both singular and plural pattern prefixes
    await this.purgeLocalPattern(`${base}:*`, false);
    await this.purgeLocalPattern(`${base}s:*`, false);
    if (entityId) {
      await this.purgeLocalKey(`${base}_${entityId}`, false);
      await this.purgeLocalKey(`${base}s_${entityId}`, false);
    }

    // Also purge aggregated dashboard and statistics caches
    await this.purgeLocalPattern('stats:*', false);
    await this.purgeLocalPattern('dashboard:*', false);
    await this.purgeLocalPattern('reports:*', false);

    if (broadcast) {
      redisBroker.publish(CHANNELS.CACHE, {
        type: 'CACHE_INVALIDATE',
        entity: raw,
        entityId,
        timestamp: Date.now()
      }).catch(() => {});
    }
  }

  async invalidateEntity(entity, entityId = null) {
    return this.purgeLocalEntity(entity, entityId, true);
  }

  async invalidatePattern(pattern) {
    return this.purgeLocalPattern(pattern, true);
  }

  getStats() {
    return {
      ...this.stats,
      inMemoryKeyCount: this.memoryCache.size,
      inFlightCount: this.inFlight.size,
      hitRatio: this.stats.hits + this.stats.misses > 0
        ? Number((this.stats.hits / (this.stats.hits + this.stats.misses)).toFixed(3))
        : 0
    };
  }
}

const cacheManager = new CacheManager();
module.exports = cacheManager;
