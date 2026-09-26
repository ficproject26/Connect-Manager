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
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0
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
    // 1. Check in-memory cache
    if (this.memoryCache.has(key)) {
      this.stats.hits++;
      return this.memoryCache.get(key);
    }

    // 2. Check Redis if available
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

    // Store in Redis if connected
    if (redisBroker.isRedisConnected && redisBroker.pubClient) {
      try {
        await redisBroker.pubClient.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
      } catch (err) {}
    }

    return true;
  }

  async del(key) {
    this.purgeLocalKey(key, true);
  }

  async purgeLocalKey(key, broadcast = true) {
    this.stats.invalidations++;
    this.memoryCache.delete(key);
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
        const keys = await redisBroker.pubClient.keys(redisPattern);
        if (keys && keys.length > 0) {
          await redisBroker.pubClient.del(...keys);
        }
      } catch (e) {}
    }
  }

  async purgeLocalEntity(entity, entityId = null, broadcast = true) {
    const e = String(entity).toLowerCase();
    await this.purgeLocalPattern(`${e}:*`, false);
    if (entityId) {
      await this.purgeLocalKey(`${e}_${entityId}`, false);
    }

    // Also purge global aggregations
    await this.purgeLocalPattern('stats:*', false);
    await this.purgeLocalPattern('dashboard:*', false);

    if (broadcast) {
      redisBroker.publish(CHANNELS.CACHE, {
        type: 'CACHE_INVALIDATE',
        entity: e,
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
      hitRatio: this.stats.hits + this.stats.misses > 0
        ? Number((this.stats.hits / (this.stats.hits + this.stats.misses)).toFixed(3))
        : 0
    };
  }
}

const cacheManager = new CacheManager();
module.exports = cacheManager;
