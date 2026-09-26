const redisBroker = require('../redis/redisClient');
const cacheManager = require('../cache/cacheManager');
const eventPublisher = require('../events/eventPublisher');
const eventSubscriber = require('../events/eventSubscriber');
const realtimeWebSocketServer = require('../websocket/websocketServer');
const { getRealtimeMetrics } = require('./realtimeMetrics');
const { CHANNELS, ACTIONS, ENTITIES } = require('../events/eventStandards');

module.exports = {
  redisBroker,
  cacheManager,
  eventPublisher,
  publishEntityEvent: eventPublisher.publishEntityEvent.bind(eventPublisher),
  publishBatchEvent: eventPublisher.publishBatchEvent.bind(eventPublisher),
  eventSubscriber,
  realtimeWebSocketServer,
  getRealtimeMetrics,
  CHANNELS,
  ACTIONS,
  ENTITIES
};
