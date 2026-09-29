/**
 * Centralized Real-Time Event Subscriber
 * Listens to global events distributed via Redis message broker,
 * deduplicates incoming events, triggers cache updates,
 * and forwards payloads to the WebSocket gateway for client delivery.
 */

const redisBroker = require('../redis/redisClient');
const realtimeWebSocketServer = require('../websocket/websocketServer');
const { CHANNELS } = require('./eventStandards');

class EventSubscriber {
  constructor() {
    this.seenEventIds = new Set();
    this.maxSeen = 1000;
    this.recentEvents = [];
    this.maxRecent = 100;
    this.metrics = {
      totalReceived: 0,
      totalDuplicatesSkipped: 0,
      totalBroadcastToWs: 0
    };
    this.unsubscribeFn = null;

    this.init();
  }

  init() {
    if (this.unsubscribeFn) return;

    this.unsubscribeFn = redisBroker.subscribe(CHANNELS.GLOBAL, (event) => {
      this.handleIncomingEvent(event);
    });

    console.log('📥 [Event Subscriber] Listening for cross-application events on', CHANNELS.GLOBAL);
  }

  handleIncomingEvent(event) {
    if (!event || !event.event) return;

    this.metrics.totalReceived++;

    // Deduplication check: drop duplicate event IDs
    if (event.eventId) {
      if (this.seenEventIds.has(event.eventId)) {
        this.metrics.totalDuplicatesSkipped++;
        return;
      }
      this.seenEventIds.add(event.eventId);

      // Prune when oversized
      if (this.seenEventIds.size > this.maxSeen) {
        const iter = this.seenEventIds.values();
        for (let i = 0; i < 100; i++) {
          this.seenEventIds.delete(iter.next().value);
        }
      }
    }

    // Keep in ring buffer for HTTP event polling fallback
    this.recentEvents.push({
      ...event,
      receivedAt: Date.now()
    });
    if (this.recentEvents.length > this.maxRecent) {
      this.recentEvents.shift();
    }

    // Forward to WebSocket server for scoped delivery to connected applications
    const delivered = realtimeWebSocketServer.broadcastEvent(event);
    this.metrics.totalBroadcastToWs += delivered;
  }

  getRecentEvents(sinceTimestamp = 0) {
    if (!sinceTimestamp || isNaN(sinceTimestamp) || sinceTimestamp <= 0) {
      return this.recentEvents.slice(-20);
    }
    return this.recentEvents.filter(e => {
      const ts = e.meta?.emittedAt || e.receivedAt || 0;
      return ts > sinceTimestamp;
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      seenEventCacheSize: this.seenEventIds.size,
      recentEventsBufferSize: this.recentEvents.length
    };
  }

  stop() {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
  }
}

const eventSubscriber = new EventSubscriber();
module.exports = eventSubscriber;
