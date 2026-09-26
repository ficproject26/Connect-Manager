/**
 * Centralized Real-Time WebSocket Server
 * Connects authenticated clients across all applications in the ecosystem,
 * providing scoped event broadcasts, heartbeat health checking, and latency tracking.
 */

const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
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
    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
      const pathname = url.parse(request.url).pathname;

      if (pathname === '/ws' || pathname === '/realtime' || pathname === '/api/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start 30s heartbeat interval to detect stale/dead connections
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
      this.metrics.currentConnected = this.clients.size;
    }, 30000);
    this.pingInterval.unref();

    console.log('⚡ [WebSocket Server] Real-time gateway active on /ws, /realtime, /api/ws');
  }

  handleConnection(ws, req) {
    ws.isAlive = true;
    ws.isAuthenticated = false;
    ws.user = null;
    ws.connectedAt = Date.now();

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Attempt token authentication via query parameter ?token=...
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
      } catch (err) {}
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

    // Send connection established frame
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
        role: (decoded.role || 'user').toLowerCase(),
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
    // Only deliver scoped events to authenticated clients
    if (!ws.isAuthenticated || !ws.user) {
      return false;
    }

    const user = ws.user;
    const role = user.role || '';

    // Central / Super Admins receive all events across all territories
    if (['admin', 'super-admin', 'super_admin', 'central_admin', 'state_manager'].includes(role) || user.email === 'admin@example.com') {
      return true;
    }

    const scope = event.scope || {};

    // Direct targeted user check
    if (scope.targetUserId) {
      const target = String(scope.targetUserId).toLowerCase();
      const clientUid = String(user.id || '').toLowerCase();
      const clientEmail = String(user.email || '').toLowerCase();
      if (target !== clientUid && target !== clientEmail) {
        return false;
      }
    }

    const norm = (s) => (s || '').toString().trim().toLowerCase();

    // Territorial scope checks
    if (role.includes('state')) {
      const uState = norm(user.stateId || user.state);
      const eState = norm(scope.stateId || scope.state);
      if (uState && eState && uState !== eState) return false;
    } else if (role.includes('district')) {
      const uDist = norm(user.districtId || user.district);
      const eDist = norm(scope.districtId || scope.district);
      if (uDist && eDist && uDist !== eDist) return false;
    } else if (role.includes('division')) {
      const uDiv = norm(user.divisionId || user.division);
      const eDiv = norm(scope.divisionId || scope.division);
      if (uDiv && eDiv && uDiv !== eDiv) return false;
    } else if (role.includes('pincode') || role.includes('agent')) {
      const uPin = norm(user.pincodeId || user.pincode);
      const ePin = norm(scope.pincodeId || scope.pincode);
      if (uPin && ePin && uPin !== ePin) return false;
    }

    return true;
  }

  broadcastEvent(event) {
    if (!this.wss || this.clients.size === 0) return 0;

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
          try {
            client.send(messagePayload);
            deliveredCount++;
          } catch (sendErr) {
            // Client socket dead
          }
        }
      }
    }

    this.metrics.totalDelivered += deliveredCount;
    return deliveredCount;
  }

  getHealth() {
    return {
      status: 'healthy',
      connectedClients: this.clients.size,
      authenticatedClients: Array.from(this.clients).filter(c => c.isAuthenticated).length,
      metrics: this.metrics
    };
  }
}

const realtimeWebSocketServer = new RealtimeWebSocketServer();
module.exports = realtimeWebSocketServer;
