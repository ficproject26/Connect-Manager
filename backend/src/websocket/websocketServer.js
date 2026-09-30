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

  async authenticateClient(ws, token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      ws.isAuthenticated = true;
      let stateName = decoded.state || null;
      let districtName = decoded.district || null;
      let divisionName = decoded.division || null;
      let pincodeCode = decoded.pincode || null;

      try {
        const db = require('../config/db');
        if (!stateName && (decoded.stateId || decoded.regionId)) {
          const s = await db.states.findById(decoded.stateId || decoded.regionId);
          if (s) stateName = s.name;
        }
        if (!districtName && decoded.districtId) {
          const d = await db.districts.findById(decoded.districtId);
          if (d) districtName = d.name;
        }
        if (!divisionName && decoded.divisionId) {
          const div = await db.divisions.findById(decoded.divisionId);
          if (div) divisionName = div.name;
        }
        if (!pincodeCode && decoded.pincodeId) {
          const p = await db.pincodes.findById(decoded.pincodeId);
          if (p) pincodeCode = p.code;
        }
      } catch (dbErr) {}

      ws.user = {
        id: decoded.id || decoded._id,
        email: decoded.email,
        role: (decoded.role || 'user').toLowerCase(),
        level: decoded.level || 4,
        stateId: decoded.stateId || decoded.regionId || null,
        districtId: decoded.districtId || null,
        divisionId: decoded.divisionId || null,
        pincodeId: decoded.pincodeId || null,
        state: stateName,
        district: districtName,
        division: divisionName,
        pincode: pincodeCode
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
    if (['admin', 'super-admin', 'super_admin', 'central_admin'].includes(role) || user.email === 'admin@example.com') {
      return true;
    }

    const scope = event.scope || {};

    // Direct targeted user check
    if (scope.targetUserId) {
      const target = String(scope.targetUserId).toLowerCase();
      const clientUid = String(user.id || '').toLowerCase();
      const clientEmail = String(user.email || '').toLowerCase();
      // If client is the explicitly targeted user, authorize immediately
      if (target === clientUid || target === clientEmail) {
        return true;
      }
      // If not the targeted user and this is a purely private direct message (no territorial scope), block
      const hasTerritory = scope.stateId || scope.state || scope.districtId || scope.district || scope.divisionId || scope.pincodeId;
      if (!hasTerritory) {
        return false;
      }
    }

    const norm = (s) => (s || '').toString().trim().toLowerCase();

    // Territorial scope checks: support cross-matching by ID or geographic name
    if (role.includes('state')) {
      const uStateId = norm(user.stateId);
      const uStateName = norm(user.state);
      const eStateId = norm(scope.stateId);
      const eStateName = norm(scope.state || scope.stateName);
      if (uStateId || uStateName) {
        const match = 
          (uStateId && eStateId && uStateId === eStateId) ||
          (uStateName && eStateName && (uStateName.includes(eStateName) || eStateName.includes(uStateName))) ||
          (uStateName && eStateId && (uStateName.includes(eStateId) || eStateId.includes(uStateName))) ||
          (uStateId && eStateName && uStateId === eStateName);
        if (eStateId || eStateName) {
          if (!match) return false;
        }
      }
    } else if (role.includes('district')) {
      const uDistId = norm(user.districtId);
      const uDistName = norm(user.district);
      const eDistId = norm(scope.districtId);
      const eDistName = norm(scope.district || scope.districtName);
      if (uDistId || uDistName) {
        const match = 
          (uDistId && eDistId && uDistId === eDistId) ||
          (uDistName && eDistName && (uDistName.includes(eDistName) || eDistName.includes(uDistName))) ||
          (uDistName && eDistId && (uDistName.includes(eDistId) || eDistId.includes(uDistName))) ||
          (uDistId && eDistName && uDistId === eDistName);
        if (eDistId || eDistName) {
          if (!match) return false;
        }
      }
    } else if (role.includes('division')) {
      const uDivId = norm(user.divisionId);
      const uDivName = norm(user.division);
      const eDivId = norm(scope.divisionId);
      const eDivName = norm(scope.division || scope.divisionName);
      if (uDivId || uDivName) {
        const match = 
          (uDivId && eDivId && uDivId === eDivId) ||
          (uDivName && eDivName && (uDivName.includes(eDivName) || eDivName.includes(uDivName))) ||
          (uDivName && eDivId && (uDivName.includes(eDivId) || eDivId.includes(uDivName))) ||
          (uDivId && eDivName && uDivId === eDivName);
        if (eDivId || eDivName) {
          if (!match) return false;
        }
      }
    } else if (role.includes('pincode') || role.includes('agent')) {
      const uPinId = norm(user.pincodeId);
      const uPinCode = norm(user.pincode);
      const ePinId = norm(scope.pincodeId);
      const ePinCode = norm(scope.pincode || scope.pincodeCode);
      if (uPinId || uPinCode) {
        const match = 
          (uPinId && ePinId && uPinId === ePinId) ||
          (uPinCode && ePinCode && uPinCode === ePinCode) ||
          (uPinCode && ePinId && uPinCode === ePinId) ||
          (uPinId && ePinCode && uPinId === ePinCode);
        if (ePinId || ePinCode) {
          if (!match) return false;
        }
      }
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
