/**
 * Real-Time Architecture Observability & Health Metrics
 */

const redisBroker = require('../redis/redisClient');
const cacheManager = require('../cache/cacheManager');
const eventPublisher = require('../events/eventPublisher');
const eventSubscriber = require('../events/eventSubscriber');
const realtimeWebSocketServer = require('../websocket/websocketServer');

function getRealtimeMetrics() {
  const wsHealth = realtimeWebSocketServer.getHealth();
  const brokerStatus = redisBroker.getStatus();
  const cacheStats = cacheManager.getStats();
  const pubMetrics = eventPublisher.getMetrics();
  const subMetrics = eventSubscriber.getMetrics();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    broker: {
      mode: brokerStatus.broker,
      instanceId: brokerStatus.instanceId,
      isRedisConnected: brokerStatus.isRedisConnected,
      activeChannels: brokerStatus.activeChannels
    },
    websocket: {
      connectedClients: wsHealth.connectedClients,
      authenticatedClients: wsHealth.authenticatedClients,
      totalBroadcasts: wsHealth.metrics.totalBroadcasts,
      totalDelivered: wsHealth.metrics.totalDelivered,
      averageLatencyMs: wsHealth.metrics.averageLatencyMs
    },
    cache: {
      hitRatio: cacheStats.hitRatio,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      invalidations: cacheStats.invalidations,
      inMemoryKeyCount: cacheStats.inMemoryKeyCount
    },
    events: {
      totalPublished: pubMetrics.totalPublished,
      duplicatesSuppressed: pubMetrics.totalDuplicatesSuppressed,
      totalReceived: subMetrics.totalReceived,
      duplicatesSkipped: subMetrics.totalDuplicatesSkipped,
      averagePublishTimeMs: pubMetrics.averagePublishTimeMs
    }
  };
}

module.exports = {
  getRealtimeMetrics
};
