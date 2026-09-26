const redisBroker = require('./redisClient');

const GLOBAL_CHANNEL = 'connect:global:events';

// Deduplication window: keep recent event signatures for 2 seconds
const recentEvents = new Map();
const CLEANUP_INTERVAL = 5000;

setInterval(() => {
  const cutoff = Date.now() - 3000;
  for (const [key, timestamp] of recentEvents.entries()) {
    if (timestamp < cutoff) recentEvents.delete(key);
  }
}, CLEANUP_INTERVAL).unref();

/**
 * Standardized Entity Event Publisher
 * @param {Object} options
 * @param {string} options.entity - generic entity type (e.g., 'task', 'vendor', 'agent', 'user', 'notification', 'wallet')
 * @param {string} options.action - 'created' | 'updated' | 'deleted'
 * @param {string|number} options.entityId - Unique ID of the affected entity
 * @param {Object} options.data - The updated entity or data payload
 * @param {Object} [options.scope] - Scoping criteria for targeted distribution { stateId, districtId, divisionId, pincodeId, targetUserId, role }
 * @param {Object} [options.meta] - Additional metadata
 */
async function publishEntityEvent({ entity, action, entityId, data, scope = {}, meta = {} }) {
  if (!entity || !action || !entityId) {
    console.warn('[Realtime Publisher] Skipped publishing event with missing entity, action, or entityId');
    return null;
  }

  const startTime = Date.now();
  const eventName = `${String(entity).toUpperCase()}_${String(action).toUpperCase()}`;
  const strEntityId = String(entityId);

  // Deduplication check: prevent identical event spam within 1000ms
  const dedupKey = `${eventName}:${strEntityId}:${JSON.stringify(scope)}`;
  const lastPublished = recentEvents.get(dedupKey);
  if (lastPublished && (startTime - lastPublished) < 1000) {
    return null; // Suppress duplicate
  }
  recentEvents.set(dedupKey, startTime);

  const eventPayload = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    event: eventName,
    entity: String(entity).toLowerCase(),
    entityId: strEntityId,
    action: String(action).toLowerCase(),
    timestamp: new Date().toISOString(),
    version: Date.now(),
    data: data || {},
    scope: {
      stateId: scope.stateId || scope.state || null,
      districtId: scope.districtId || scope.district || null,
      divisionId: scope.divisionId || scope.division || null,
      pincodeId: scope.pincodeId || scope.pincode || null,
      targetUserId: scope.targetUserId || scope.assignedTo || null,
      role: scope.role || null
    },
    meta: {
      source: 'manager-backend',
      emittedAt: startTime,
      ...meta
    }
  };

  try {
    await redisBroker.publish(GLOBAL_CHANNEL, eventPayload);
    const duration = Date.now() - startTime;
    console.log(`📡 [Realtime Publisher] Broadcasted ${eventName} for ${entity}:${strEntityId} (broker: ${redisBroker.getStatus().broker}, ${duration}ms)`);
    return eventPayload;
  } catch (err) {
    console.error(`❌ [Realtime Publisher] Failed to publish ${eventName}:`, err.message);
    return null;
  }
}

module.exports = {
  publishEntityEvent,
  GLOBAL_CHANNEL
};
