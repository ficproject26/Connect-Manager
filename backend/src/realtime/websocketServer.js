const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const redisBroker = require('./redisClient');
const { GLOBAL_CHANNEL } = require('./eventPublisher');
const { JWT_SECRET } = require('../middleware/authMiddleware');

class RealtimeWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.metrics = {
      totalConnected: 0,
      currentConnected: 0,
      totalDelivered: 0,
      totalBroadcasts: 0,
      averageLatencyMs: 0
    };
    this.pingInterval = null;
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({
      noServer: true
    });

    httpServer.on('upgrade', (request, socket, head) => {
      const pathname = url.parse(request.url).pathname;

      if (pathname === '/ws' || pathname === '/realtime' || pathname === '/api/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
      // If path doesn't match, let other upgrade handlers proceed or destroy
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat
    this.pingInterval = setInterval(() => {
      for (const ws of this.clients) {
        if (!ws.isAlive) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, 30000);
    this.pingInterval.unref();

    // Subscribe to Redis / internal pubsub events
    redisBroker.subscribe(GLOBAL_CHANNEL, (event) => {
      this.broadcastEvent(event);
    });

    console.log('⚡ [Realtime WebSocket] Attached to HTTP server on /ws and /realtime');
  }

  handleConnection(ws, req) {
    ws.isAlive = true;
    ws.isAuthenticated = false;
    ws.user = null;
    ws.connectedAt = Date.now();

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Try extracting token from URL query string
    try {
      const parsedUrl = url.parse(req.url, true);
      const token = parsedUrl.query.token;
      if (token) {
        this.authenticateClient(ws, token);
      }
    } catch (e) {}

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'AUTH' && msg.token) {
          this.authenticateClient(ws, msg.token);
        } else if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (err) {
        // Ignore unparseable frames
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      this.metrics.currentConnected = this.clients.size;
    });

    ws.on('error', () => {
      this.clients.delete(ws);
      this.metrics.currentConnected = this.clients.size;
    });

    this.clients.add(ws);
    this.metrics.totalConnected++;
    this.metrics.currentConnected = this.clients.size;

    // Send connection established welcome frame
    ws.send(JSON.stringify({
      type: 'CONNECTION_READY',
      serverTime: new Date().toISOString(),
      requiresAuth: !ws.isAuthenticated
    }));
  }

  authenticateClient(ws, token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      ws.isAuthenticated = true;
      ws.user = {
        id: decoded.id || decoded._id,
        email: decoded.email,
        role: decoded.role || 'user',
        level: decoded.level || 4,
        stateId: decoded.stateId || decoded.regionId || null,
        districtId: decoded.districtId || null,
        divisionId: decoded.divisionId || null,
        pincodeId: decoded.pincodeId || null,
        state: decoded.state || null,
        district: decoded.district || null,
        division: decoded.division || null,
        pincode: decoded.pincode || null
      };

      ws.send(JSON.stringify({
        type: 'AUTH_SUCCESS',
        userId: ws.user.id,
        role: ws.user.role
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'AUTH_FAILED',
        message: 'Invalid or expired token'
      }));
    }
  }

  isEventAuthorizedForClient(event, ws) {
    // If client is not yet authenticated, do not deliver scoped data events
    if (!ws.isAuthenticated || !ws.user) {
      return false;
    }

    const user = ws.user;
    const role = (user.role || '').toLowerCase();

    // Central / Super Admins receive all events
    if (['admin', 'super-admin', 'super_admin', 'central_admin'].includes(role) || user.email === 'admin@example.com') {
      return true;
    }

    const scope = event.scope || {};

    // Specific user target check
    if (scope.targetUserId) {
      const target = String(scope.targetUserId).toLowerCase();
      const clientUid = String(user.id || '').toLowerCase();
      const clientEmail = String(user.email || '').toLowerCase();
      if (target !== clientUid && target !== clientEmail) {
        return false;
      }
    }

    const norm = (s) => (s || '').toString().trim().toLowerCase();

    // Geographic scoping
    if (role.includes('state')) {
      const userState = norm(user.stateId || user.state);
      const evState = norm(scope.stateId || scope.state);
      if (userState && evState && userState !== evState) return false;
    } else if (role.includes('district')) {
      const userDist = norm(user.districtId || user.district);
      const evDist = norm(scope.districtId || scope.district);
      if (userDist && evDist && userDist !== evDist) return false;
    } else if (role.includes('division')) {
      const userDiv = norm(user.divisionId || user.division);
      const evDiv = norm(scope.divisionId || scope.division);
      if (userDiv && evDiv && userDiv !== evDiv) return false;
    } else if (role.includes('pincode') || role.includes('agent')) {
      const userPin = norm(user.pincodeId || user.pincode);
      const evPin = norm(scope.pincodeId || scope.pincode);
      if (userPin && evPin && userPin !== evPin) return false;
    }

    return true;
  }

  broadcastEvent(event) {
    if (!this.wss || this.clients.size === 0) return;

    this.metrics.totalBroadcasts++;
    const now = Date.now();
    const emittedAt = event.meta?.emittedAt || now;
    const latency = Math.max(0, now - emittedAt);

    // Update moving average latency
    this.metrics.averageLatencyMs = Math.round(
      (this.metrics.averageLatencyMs * 0.8) + (latency * 0.2)
    );

    const messagePayload = JSON.stringify({
      ...event,
      meta: {
        ...event.meta,
        deliveredAt: now,
        latencyMs: latency
      }
    });

    let deliveredCount = 0;
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        if (this.isEventAuthorizedForClient(event, client)) {
          client.send(messagePayload);
          deliveredCount++;
        }
      }
    }

    this.metrics.totalDelivered += deliveredCount;
    if (deliveredCount > 0) {
      console.log(`⚡ [Realtime WebSocket] Delivered ${event.event} to ${deliveredCount} client(s) (propagation latency: ${latency}ms)`);
    }
  }

  getHealth() {
    return {
      status: 'healthy',
      connectedClients: this.clients.size,
      authenticatedClients: Array.from(this.clients).filter(c => c.isAuthenticated).length,
      metrics: this.metrics,
      broker: redisBroker.getStatus()
    };
  }
}

const realtimeWebSocketServer = new RealtimeWebSocketServer();
module.exports = realtimeWebSocketServer;
