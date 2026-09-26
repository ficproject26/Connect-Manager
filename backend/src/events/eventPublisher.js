/**
 * Centralized Real-Time Event Publisher
 * Generates versioned, deduplicated, standardized events and distributes
 * them through Redis Pub/Sub to all connected backend and client instances.
 */

const redisBroker = require('../redis/redisClient');
const cacheManager = require('../cache/cacheManager');
const { CHANNELS, createStandardPayload } = require('./eventStandards');

// Deduplication rolling window: tracks event signatures within 1000ms
const recentEvents = new Map();
const CLEANUP_INTERVAL = 5000;

setInterval(() => {
  const cutoff = Date.now() - 3000;
  for (const [key, timestamp] of recentEvents.entries()) {
    if (timestamp < cutoff) recentEvents.delete(key);
  }
}, CLEANUP_INTERVAL).unref();

class EventPublisher {
  constructor() {
    this.metrics = {
      totalPublished: 0,
      totalDuplicatesSuppressed: 0,
      publishFailures: 0,
      averagePublishTimeMs: 0
    };
  }

  /**
   * Publish a single entity state change event
   */
  async publishEntityEvent({ entity, action, entityId, data, scope = {}, meta = {} }) {
    if (!entity || !action || !entityId) {
      console.warn('[Event Publisher] Skipped publishing event with missing parameters');
      return null;
    }

    const startTime = Date.now();
    const strEntityId = String(entityId);
    const scopeKey = JSON.stringify(scope || {});
    const dedupKey = `${String(entity).toLowerCase()}:${String(action).toLowerCase()}:${strEntityId}:${scopeKey}`;

    // Deduplication check
    const lastPublished = recentEvents.get(dedupKey);
    if (lastPublished && (startTime - lastPublished) < 1000) {
      this.metrics.totalDuplicatesSuppressed++;
      return null; // Suppress duplicate burst
    }
    recentEvents.set(dedupKey, startTime);

    const payload = createStandardPayload({
      entity,
      action,
      entityId: strEntityId,
      data,
      scope,
      meta: {
        ...meta,
        emittedAt: startTime
      }
    });

    try {
      // 1. Immediately invalidate local and distributed caches for this entity
      cacheManager.invalidateEntity(entity, strEntityId);

      // 2. Publish to Redis broker
      await redisBroker.publish(CHANNELS.GLOBAL, payload);

      const duration = Date.now() - startTime;
      this.metrics.totalPublished++;
      this.metrics.averagePublishTimeMs = Math.round(
        (this.metrics.averagePublishTimeMs * 0.8) + (duration * 0.2)
      );

      console.log(`📡 [Event Publisher] Published ${payload.event} for ${payload.entity}:${strEntityId} in ${duration}ms (broker: ${redisBroker.getStatus().broker})`);
      return payload;
    } catch (err) {
      this.metrics.publishFailures++;
      console.error(`❌ [Event Publisher] Publish error for ${payload.event}:`, err.message);
      return null;
    }
  }

  /**
   * Publish batch change event for high-throughput bulk operations
   */
  async publishBatchEvent({ entity, action = 'batch_updated', items = [], scope = {}, meta = {} }) {
    if (!entity || !Array.isArray(items) || items.length === 0) return null;

    const startTime = Date.now();
    const payload = createStandardPayload({
      entity,
      action,
      entityId: `batch_${Date.now()}`,
      data: {
        count: items.length,
        items
      },
      scope,
      meta: {
        ...meta,
        batchSize: items.length,
        emittedAt: startTime
      }
    });

    try {
      cacheManager.invalidateEntity(entity);
      await redisBroker.publish(CHANNELS.GLOBAL, payload);
      this.metrics.totalPublished++;
      return payload;
    } catch (err) {
      this.metrics.publishFailures++;
      return null;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeDedupEntries: recentEvents.size
    };
  }
}

const eventPublisher = new EventPublisher();
module.exports = eventPublisher;
