const Redis = require('ioredis');
const EventEmitter = require('events');

class RedisBroker {
  constructor() {
    this.pubClient = null;
    this.subClient = null;
    this.memoryBus = new EventEmitter();
    this.memoryBus.setMaxListeners(100);
    this.isRedisConnected = false;
    this.subscribers = new Map(); // channel -> Set of callbacks

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
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 300, 2000))
    };

    if (redisPassword) redisOptions.password = redisPassword;

    try {
      this.pubClient = redisUrl ? new Redis(redisUrl, redisOptions) : new Redis({ host: redisHost, port: redisPort, ...redisOptions });
      this.subClient = redisUrl ? new Redis(redisUrl, redisOptions) : new Redis({ host: redisHost, port: redisPort, ...redisOptions });

      this.pubClient.on('connect', () => {
        this.isRedisConnected = true;
        console.log('✅ [Realtime Broker] Connected to Redis Pub/Sub cluster.');
      });

      this.pubClient.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn('⚠️ [Realtime Broker] Redis connection lost, switching to in-memory event bus fallback.');
        }
        this.isRedisConnected = false;
      });

      this.subClient.on('error', (err) => {
        this.isRedisConnected = false;
      });

      this.subClient.on('message', (channel, message) => {
        try {
          const parsed = JSON.parse(message);
          const handlers = this.subscribers.get(channel);
          if (handlers) {
            handlers.forEach(fn => fn(parsed));
          }
        } catch (e) {
          console.error('[Realtime Broker] Error parsing message from Redis:', e.message);
        }
      });

      // Attempt async connection
      Promise.all([this.pubClient.connect().catch(() => {}), this.subClient.connect().catch(() => {})])
        .then(() => {
          if (this.pubClient.status === 'ready' && this.subClient.status === 'ready') {
            this.isRedisConnected = true;
            console.log('✅ [Realtime Broker] Redis publisher and subscriber ready.');
          }
        })
        .catch(() => {
          this.isRedisConnected = false;
        });

    } catch (err) {
      console.warn('ℹ️ [Realtime Broker] Redis unavailable. Operating with high-performance in-memory event bus.');
      this.isRedisConnected = false;
    }
  }

  async publish(channel, data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    let redisSuccess = false;

    if (this.isRedisConnected && this.pubClient && this.pubClient.status === 'ready') {
      try {
        await this.pubClient.publish(channel, payload);
        redisSuccess = true;
      } catch (err) {
        this.isRedisConnected = false;
      }
    }

    // Always emit on local bus so local subscribers receive it immediately (< 1ms)
    // and if Redis is not active, this serves as the primary distribution channel
    this.memoryBus.emit(channel, typeof data === 'object' ? data : JSON.parse(payload));
    return redisSuccess;
  }

  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
      if (this.isRedisConnected && this.subClient && this.subClient.status === 'ready') {
        this.subClient.subscribe(channel).catch(() => {});
      }
    }
    this.subscribers.get(channel).add(callback);

    // Also register on memory bus for local emissions
    this.memoryBus.on(channel, callback);

    return () => {
      const set = this.subscribers.get(channel);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(channel);
          if (this.isRedisConnected && this.subClient && this.subClient.status === 'ready') {
            this.subClient.unsubscribe(channel).catch(() => {});
          }
        }
      }
      this.memoryBus.off(channel, callback);
    };
  }

  getStatus() {
    return {
      broker: this.isRedisConnected ? 'redis' : 'in-memory-bus',
      isRedisConnected: this.isRedisConnected,
      activeChannels: Array.from(this.subscribers.keys()),
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, s) => sum + s.size, 0)
    };
  }
}

const redisBroker = new RedisBroker();
module.exports = redisBroker;
