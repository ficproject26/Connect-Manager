/**
 * Centralized Realtime WebSocket Client
 * Connects to backend real-time event distribution layer,
 * handles automatic authentication, reconnection, deduplication,
 * and out-of-order event protection.
 */

class RealtimeClient {
  constructor() {
    this.ws = null;
    this.token = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.listeners = new Map(); // entity/event -> Set of callbacks
    this.seenEventIds = new Set();
    this.maxSeenEvents = 500;
    this.entityVersions = new Map(); // entityId -> latest version timestamp
  }

  getWsUrl(token) {
    if (import.meta.env.VITE_WS_URL) {
      return `${import.meta.env.VITE_WS_URL}?token=${token}`;
    }
    const isHttps = window.location.protocol === 'https:';
    const proto = isHttps ? 'wss:' : 'ws:';
    
    // In local dev Vite runs on 5173, backend on 8005
    let host = window.location.host;
    if (window.location.port === '5173') {
      host = `${window.location.hostname}:8005`;
    }
    return `${proto}//${host}/ws?token=${token}`;
  }

  connect(token) {
    const activeToken = token || localStorage.getItem('agent_mgr_token');
    if (!activeToken) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.token === activeToken) return;
      this.disconnect();
    }

    this.token = activeToken;
    this.isConnecting = true;

    try {
      const url = this.getWsUrl(activeToken);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('⚡ [Realtime Client] Connected to real-time event bus.');

        // Dispatch connection event for catch-up syncing if needed
        window.dispatchEvent(new CustomEvent('connect:ws:connected', { detail: { timestamp: Date.now() } }));

        this.startHeartbeat();
      };

      this.ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.handleIncomingMessage(payload);
        } catch (err) {
          console.error('[Realtime Client] Error parsing incoming frame:', err);
        }
      };

      this.ws.onclose = (e) => {
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        window.dispatchEvent(new CustomEvent('connect:ws:disconnected', { detail: { code: e.code } }));

        // Reconnect with exponential backoff if not an explicit client closure
        if (e.code !== 1000 && this.token) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // Will trigger onclose and retry
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
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
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    console.log(`[Realtime Client] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`);
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

    // Standard Realtime Event
    const event = msg.payload || msg;
    if (!event || !event.event) return;

    // 1. Deduplication check
    if (event.eventId) {
      if (this.seenEventIds.has(event.eventId)) {
        return; // Suppress duplicate event
      }
      this.seenEventIds.add(event.eventId);
      if (this.seenEventIds.size > this.maxSeenEvents) {
        // Drop oldest entries
        const iterator = this.seenEventIds.values();
        for (let i = 0; i < 50; i++) {
          this.seenEventIds.delete(iterator.next().value);
        }
      }
    }

    // 2. Out-of-order version check
    if (event.entityId && event.version) {
      const lastVersion = this.entityVersions.get(event.entityId);
      if (lastVersion && lastVersion > event.version) {
        console.warn(`[Realtime Client] Discarded older out-of-order event v${event.version} for ${event.entity}:${event.entityId} (current: v${lastVersion})`);
        return;
      }
      this.entityVersions.set(event.entityId, event.version);
    }

    // Log end-to-end propagation latency
    const emittedAt = event.meta?.emittedAt;
    const latency = emittedAt ? (Date.now() - emittedAt) : null;
    if (latency !== null) {
      console.log(`⚡ [Realtime Client] Received ${event.event} (${event.entity}:${event.entityId}) in ${latency}ms`);
    }

    // 3. Dispatch to direct registered listeners
    const notifyKey = (key) => {
      const set = this.listeners.get(key);
      if (set) {
        set.forEach(cb => {
          try {
            cb(event);
          } catch (err) {
            console.error('[Realtime Client] Listener error:', err);
          }
        });
      }
    };

    notifyKey('*');
    if (event.entity) notifyKey(event.entity.toLowerCase());
    if (event.event) notifyKey(event.event.toUpperCase());

    // 4. Dispatch browser custom events for seamless component binding
    window.dispatchEvent(new CustomEvent('connect:event', { detail: event }));
    if (event.entity) {
      window.dispatchEvent(new CustomEvent(`connect:event:${event.entity.toLowerCase()}`, { detail: event }));
    }
    if (event.event) {
      window.dispatchEvent(new CustomEvent(`connect:event:${event.event.toUpperCase()}`, { detail: event }));
    }
  }

  on(key, callback) {
    const k = key.toLowerCase();
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
      reconnectAttempts: this.reconnectAttempts,
      activeListeners: Array.from(this.listeners.keys())
    };
  }
}

export const realtimeClient = new RealtimeClient();
export default realtimeClient;
