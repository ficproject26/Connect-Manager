import { API_BASE } from '../services/api';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.token = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isPolling = false;
    this.pollTimer = null;
    this.lastPollTimestamp = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.listeners = new Map(); // key -> Set of callbacks
    this.seenEventIds = new Set();
    this.maxSeenEvents = 500;
    this.entityVersions = new Map(); // entityId -> latest version timestamp
    this.lastLatencyMs = 0;
  }

  getWsUrl(token) {
    if (typeof window === 'undefined') return null;

    if (import.meta.env.VITE_WS_URL) {
      return `${import.meta.env.VITE_WS_URL}?token=${token}`;
    }

    // Vercel serverless edge does not host persistent WebSocket connections
    if (window.location.hostname.endsWith('vercel.app')) {
      return null;
    }

    const isHttps = window.location.protocol === 'https:';
    if (isHttps) {
      // Modern browsers reject insecure ws:// from https:// origin (Mixed Content).
      // Fallback to high-performance real-time HTTP event polling when WSS endpoint is not provided.
      return null;
    }

    let host = window.location.host;
    if (window.location.port === '5173') {
      host = `${window.location.hostname}:8005`;
    }
    return `ws://${host}/ws?token=${token}`;
  }

  connect(token) {
    const activeToken = token || localStorage.getItem('agent_mgr_token');
    if (!activeToken) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.token === activeToken) return;
      this.disconnect();
    }

    this.token = activeToken;

    const url = this.getWsUrl(activeToken);
    if (!url) {
      // Platform does not support WebSocket (e.g. Vercel deployment), activate HTTP event polling fallback
      this.startPollingFallback(activeToken);
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.stopPollingFallback();
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('⚡ [Realtime Client] Connected to ecosystem real-time event bus.');

        window.dispatchEvent(new CustomEvent('connect:ws:connected', { detail: { mode: 'websocket', timestamp: Date.now() } }));
        this.startHeartbeat();
      };

      this.ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.handleIncomingMessage(payload);
        } catch (err) {
          console.error('[Realtime Client] Frame parsing error:', err);
        }
      };

      this.ws.onclose = (e) => {
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        window.dispatchEvent(new CustomEvent('connect:ws:disconnected', { detail: { code: e.code } }));

        if (e.code !== 1000 && this.token) {
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.info('ℹ️ [Realtime Client] Switched to high-performance HTTP real-time event polling.');
            this.startPollingFallback(this.token);
          } else {
            this.scheduleReconnect();
          }
        }
      };

      this.ws.onerror = () => {
        // Handled by onclose
      };
    } catch (err) {
      this.isConnecting = false;
      this.startPollingFallback(activeToken);
    }
  }

  startPollingFallback(token) {
    if (this.isPolling) return;
    this.isPolling = true;
    this.isConnecting = false;
    this.isConnected = true;
    if (this.lastPollTimestamp === 0) {
      this.lastPollTimestamp = Date.now() - 5000;
    }

    window.dispatchEvent(new CustomEvent('connect:ws:connected', { detail: { mode: 'polling', timestamp: Date.now() } }));

    const poll = async () => {
      if (!this.token) {
        this.stopPollingFallback();
        return;
      }

      try {
        const query = new URLSearchParams({
          since: this.lastPollTimestamp.toString(),
          token: this.token
        });
        const res = await fetch(`${API_BASE}/realtime/events?${query.toString()}`, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.events)) {
            data.events.forEach(ev => this.handleIncomingMessage(ev));
            if (data.timestamp) {
              this.lastPollTimestamp = data.timestamp;
            }
          }
        }
      } catch (e) {
        // Retry silently on next cycle
      }

      if (this.isPolling) {
        const interval = (typeof document !== 'undefined' && document.hidden) ? 10000 : 3500;
        this.pollTimer = setTimeout(poll, interval);
      }
    };

    poll();
  }

  stopPollingFallback() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.stopPollingFallback();
    if (this.ws) {
      this.ws.close(1000, 'User logged out');
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const jitter = Math.floor(Math.random() * 500);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts) + jitter, 10000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  handleIncomingMessage(msg) {
    if (msg.type === 'PONG' || msg.type === 'CONNECTION_READY' || msg.type === 'AUTH_SUCCESS') {
      return;
    }

    const event = msg.payload || msg;
    if (!event || !event.event) return;

    // 1. Deduplication check
    if (event.eventId) {
      if (this.seenEventIds.has(event.eventId)) {
        return; // Suppress duplicate
      }
      this.seenEventIds.add(event.eventId);
      if (this.seenEventIds.size > this.maxSeenEvents) {
        const iter = this.seenEventIds.values();
        for (let i = 0; i < 50; i++) {
          this.seenEventIds.delete(iter.next().value);
        }
      }
    }

    // 2. Out-of-order version check
    if (event.entityId && event.version) {
      const lastVersion = this.entityVersions.get(event.entityId);
      if (lastVersion && lastVersion > event.version) {
        console.warn(`[Realtime Client] Dropped stale event v${event.version} for ${event.entity}:${event.entityId}`);
        return;
      }
      this.entityVersions.set(event.entityId, event.version);
    }

    // Measure propagation latency
    const emittedAt = event.meta?.emittedAt;
    if (emittedAt) {
      this.lastLatencyMs = Date.now() - emittedAt;
      console.log(`⚡ [Realtime Client] Received ${event.event} in ${this.lastLatencyMs}ms`);
    }

    // 3. Dispatch to registered listeners
    const notify = (key) => {
      const handlers = this.listeners.get(key);
      if (handlers) {
        handlers.forEach(fn => {
          try {
            fn(event);
          } catch (err) {
            console.error('[Realtime Client] Listener error:', err);
          }
        });
      }
    };

    notify('*');
    if (event.entity) notify(event.entity.toLowerCase());
    if (event.event) notify(event.event.toUpperCase());

    // 4. Dispatch browser custom events
    window.dispatchEvent(new CustomEvent('connect:event', { detail: event }));
    if (event.entity) {
      window.dispatchEvent(new CustomEvent(`connect:event:${event.entity.toLowerCase()}`, { detail: event }));
    }
    if (event.event) {
      window.dispatchEvent(new CustomEvent(`connect:event:${event.event.toUpperCase()}`, { detail: event }));
    }
  }

  on(key, callback) {
    const k = (key || '*').toLowerCase();
    if (!this.listeners.has(k)) {
      this.listeners.set(k, new Set());
    }
    this.listeners.get(k).add(callback);

    return () => {
      const set = this.listeners.get(k);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(k);
      }
    };
  }

  subscribe(entity, callback) {
    return this.on(entity, callback);
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      isPolling: this.isPolling,
      mode: this.isPolling ? 'polling' : (this.isConnected ? 'websocket' : 'disconnected'),
      reconnectAttempts: this.reconnectAttempts,
      lastLatencyMs: this.lastLatencyMs,
      activeListeners: Array.from(this.listeners.keys())
    };
  }
}

export const realtimeClient = new WebSocketClient();
export default realtimeClient;
