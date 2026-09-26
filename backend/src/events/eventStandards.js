/**
 * Centralized Real-Time Event Standards & Payload Specifications
 * Shared event definitions, channels, and payload normalization
 * across all connected applications in the ecosystem.
 */

const { v4: uuidv4 } = require('uuid');

const CHANNELS = {
  GLOBAL: 'connect:global:events',
  CACHE: 'connect:cache:events'
};

const ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  BATCH_CREATED: 'batch_created',
  BATCH_UPDATED: 'batch_updated',
  STATUS_CHANGED: 'status_changed',
  ALLOCATED: 'allocated',
  INVALIDATED: 'invalidated'
};

const ENTITIES = {
  TASK: 'task',
  VENDOR: 'vendor',
  AGENT: 'agent',
  USER: 'user',
  MANAGER: 'manager',
  NOTIFICATION: 'notification',
  AUDIT: 'audit',
  TERRITORY: 'territory',
  SETTINGS: 'settings',
  SHOP_VISIT: 'shop_visit',
  REPORT: 'report'
};

/**
 * Standardized Event Payload Generator
 */
function createStandardPayload({
  entity,
  action,
  entityId,
  data = {},
  scope = {},
  meta = {}
}) {
  const normEntity = String(entity || 'generic').toLowerCase();
  const normAction = String(action || 'updated').toLowerCase();
  const strEntityId = String(entityId || data?._id || data?.id || uuidv4());
  const now = Date.now();

  const eventName = `${normEntity.toUpperCase()}_${normAction.toUpperCase()}`;

  return {
    eventId: `evt_${now}_${Math.random().toString(36).substring(2, 9)}`,
    event: eventName,
    entity: normEntity,
    entityId: strEntityId,
    action: normAction,
    timestamp: new Date(now).toISOString(),
    version: now,
    data: data || {},
    scope: {
      stateId: scope.stateId || scope.state || null,
      districtId: scope.districtId || scope.district || null,
      divisionId: scope.divisionId || scope.division || null,
      pincodeId: scope.pincodeId || scope.pincode || null,
      targetUserId: scope.targetUserId || scope.assignedTo || scope.userId || null,
      role: scope.role || null
    },
    meta: {
      source: 'connect-manager-backend',
      emittedAt: now,
      ...meta
    }
  };
}

module.exports = {
  CHANNELS,
  ACTIONS,
  ENTITIES,
  createStandardPayload
};
