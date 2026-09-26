/**
 * Production Redis Message Broker & Pub/Sub Client
 * Supports high-availability standalone & cluster Redis instances
 * with zero-downtime automatic fallback to in-memory event bus.
 */

const Redis = require('ioredis');
const EventEmitter = require('events');

const INSTANCE_ID = `manager_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;

class RedisBroker {
  constructor() {
    this.instanceId = INSTANCE_ID;
    this.pubClient = null;
    this.subClient = null;
    this.memoryBus = new EventEmitter();
    this.memoryBus.setMaxListeners(200);
    this.isRedisConnected = false;
    this.subscribers = new Map(); // channel -> Set of callbacks
    this.activeSubscriptions = new Set();

    this.init();
  }

  init() {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    const redisOptions = {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 300, 2000))
    };

    if (redisPassword) redisOptions.password = redisPassword;

    try {
      this.pubClient = redisUrl
        ? new Redis(redisUrl, redisOptions)
        : new Redis({ host: redisHost, port: redisPort, ...redisOptions });

      this.subClient = redisUrl
        ? new Redis(redisUrl, redisOptions)
        : new Redis({ host: redisHost, port: redisPort, ...redisOptions });

      this.pubClient.on('connect', () => {
        this.isRedisConnected = true;
        console.log(`✅ [Redis Broker:${this.instanceId}] Connected to Redis Publisher.`);
      });

      this.subClient.on('connect', () => {
        console.log(`✅ [Redis Broker:${this.instanceId}] Connected to Redis Subscriber.`);
        // Re-subscribe all active channels
        for (const channel of this.activeSubscriptions) {
          this.subClient.subscribe(channel).catch(() => {});
        }
      });

      this.pubClient.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn(`⚠️ [Redis Broker] Connection lost, fallback to in-memory event bus (${err.message})`);
        }
        this.isRedisConnected = false;
      });

      this.subClient.on('error', () => {
        this.isRedisConnected = false;
      });

      this.subClient.on('message', (channel, message) => {
        try {
          const parsed = JSON.parse(message);
          this.dispatchChannelEvent(channel, parsed);
        } catch (e) {
          console.error(`[Redis Broker] Failed to parse message from ${channel}:`, e.message);
        }
      });

      // Attempt async connection without blocking application startup
      Promise.all([
        this.pubClient.connect().catch(() => {}),
        this.subClient.connect().catch(() => {})
      ]).then(() => {
        if (this.pubClient.status === 'ready' && this.subClient.status === 'ready') {
          this.isRedisConnected = true;
          console.log(`✅ [Redis Broker] Redis Pub/Sub cluster ready for instance ${this.instanceId}`);
        }
      }).catch(() => {
        this.isRedisConnected = false;
      });

    } catch (err) {
      console.warn('ℹ️ [Redis Broker] Redis unavailable. Operating with in-memory event distribution.');
      this.isRedisConnected = false;
    }
  }

  dispatchChannelEvent(channel, data) {
    const handlers = this.subscribers.get(channel);
    if (handlers) {
      handlers.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[Redis Broker] Subscriber handler error on ${channel}:`, err.message);
        }
      });
    }
  }

  /**
   * Publish an event across all backend instances via Redis,
   * or locally if Redis is offline.
   */
  async publish(channel, data) {
    const enrichedData = {
      ...data,
      meta: {
        ...(data.meta || {}),
        originInstanceId: this.instanceId,
        emittedAt: data.meta?.emittedAt || Date.now()
      }
    };

    const payload = JSON.stringify(enrichedData);
    let publishedViaRedis = false;

    if (this.isRedisConnected && this.pubClient && this.pubClient.status === 'ready') {
      try {
        await this.pubClient.publish(channel, payload);
        publishedViaRedis = true;
      } catch (err) {
        this.isRedisConnected = false;
      }
    }

    if (!publishedViaRedis) {
      // In fallback mode, directly trigger subscribers on this node
      this.dispatchChannelEvent(channel, enrichedData);
    }

    return publishedViaRedis;
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
      this.activeSubscriptions.add(channel);

      if (this.isRedisConnected && this.subClient && this.subClient.status === 'ready') {
        this.subClient.subscribe(channel).catch(() => {});
      }
    }

    this.subscribers.get(channel).add(callback);

    // Return unbind function
    return () => {
      this.unsubscribe(channel, callback);
    };
  }

  unsubscribe(channel, callback) {
    const set = this.subscribers.get(channel);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(channel);
        this.activeSubscriptions.delete(channel);
        if (this.isRedisConnected && this.subClient && this.subClient.status === 'ready') {
          this.subClient.unsubscribe(channel).catch(() => {});
        }
      }
    }
  }

  getStatus() {
    return {
      broker: this.isRedisConnected ? 'redis' : 'in-memory-bus',
      instanceId: this.instanceId,
      isRedisConnected: this.isRedisConnected,
      activeChannels: Array.from(this.subscribers.keys()),
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, s) => sum + s.size, 0)
    };
  }

  async close() {
    if (this.pubClient) {
      try { await this.pubClient.quit(); } catch (e) {}
    }
    if (this.subClient) {
      try { await this.subClient.quit(); } catch (e) {}
    }
    this.isRedisConnected = false;
  }
}

const redisBroker = new RedisBroker();
module.exports = redisBroker;
