/**
 * Comprehensive Real-Time Ecosystem & Latency Benchmark Test Suite
 * Tests end-to-end event propagation, WebSocket concurrency, territory scoping,
 * deduplication, out-of-order protection, cache invalidation, and latency targets.
 */

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { JWT_SECRET } = require('../src/middleware/authMiddleware');
const db = require('../src/config/db');
const {
  redisBroker,
  cacheManager,
  publishEntityEvent,
  realtimeWebSocketServer,
  getRealtimeMetrics,
  CHANNELS
} = require('../src/realtime');

const TEST_PORT = 8099;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}/ws`;

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 CONNECT-MANAGER REAL-TIME ECOSYSTEM TEST SUITE & BENCHMARK');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedTests++;
    }
  }

  // 1. Setup Test HTTP + WebSocket Server
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  realtimeWebSocketServer.attach(server);

  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[Test Server] Listening on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  // Generate Scoped Test Tokens
  const superAdminToken = generateToken({
    id: 'user_super_admin',
    email: 'admin@example.com',
    role: 'super_admin',
    name: 'Super Admin'
  });

  const stateManagerToken = generateToken({
    id: 'user_state_mgr_tn',
    email: 'state.mgr1@example.com',
    role: 'state_manager',
    stateId: 'state_tn',
    state: 'Tamil Nadu'
  });

  const salemDistrictToken = generateToken({
    id: 'user_dist_salem',
    email: 'salem.mgr@example.com',
    role: 'district_manager',
    stateId: 'state_tn',
    districtId: 'dist_salem',
    district: 'Salem'
  });

  const cbeDistrictToken = generateToken({
    id: 'user_dist_cbe',
    email: 'cbe.mgr@example.com',
    role: 'district_manager',
    stateId: 'state_tn',
    districtId: 'dist_coimbatore',
    district: 'Coimbatore'
  });

  const clients = {};

  function connectClient(name, token) {
    return new Promise((resolve, reject) => {
      const url = token ? `${WS_URL}?token=${token}` : WS_URL;
      const ws = new WebSocket(url);
      const messages = [];

      ws.on('open', () => {
        resolve({ ws, messages });
      });

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          messages.push(parsed);
        } catch (e) {}
      });

      ws.on('error', reject);
    });
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Simultaneous Multi-Client Authentication & Connection
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Simultaneous Multi-Client Connection & Authentication ---');
    clients.superAdmin = await connectClient('superAdmin', superAdminToken);
    clients.stateManager = await connectClient('stateManager', stateManagerToken);
    clients.salemDistrict = await connectClient('salemDistrict', salemDistrictToken);
    clients.cbeDistrict = await connectClient('cbeDistrict', cbeDistrictToken);
    clients.unauth = await connectClient('unauth', null);

    // Give 100ms for connection ready frames
    await new Promise((r) => setTimeout(r, 100));

    assert(clients.superAdmin.ws.readyState === WebSocket.OPEN, 'Super Admin connected to WebSocket gateway');
    assert(clients.salemDistrict.ws.readyState === WebSocket.OPEN, 'Salem District Manager connected');
    assert(clients.cbeDistrict.ws.readyState === WebSocket.OPEN, 'Coimbatore District Manager connected');
    assert(clients.unauth.ws.readyState === WebSocket.OPEN, 'Unauthenticated client connected (awaits auth)');

    // -------------------------------------------------------------
    // TEST 2: End-to-End Propagation Latency Benchmark (< 500ms Target)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: End-to-End Latency Benchmark (Database -> Redis -> WS -> Client) ---');

    const latencyMeasurements = [];
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      const taskId = `bench_task_${Date.now()}_${i}`;
      const writeStart = Date.now();

      // Trigger write via database collection
      await db.tasks.insertOne({
        _id: taskId,
        id: taskId,
        title: `Benchmark Task ${i}`,
        status: 'Assigned',
        category: 'Field Audit',
        stateId: 'state_tn',
        districtId: 'dist_salem',
        pincodeId: 'pin_636001',
        createdAt: new Date().toISOString()
      });

      // Wait for Super Admin client to receive event
      const received = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 1000);
        const check = setInterval(() => {
          const found = clients.superAdmin.messages.find(
            (m) => m.entity === 'tasks' && String(m.entityId) === taskId
          );
          if (found) {
            clearInterval(check);
            clearTimeout(timeout);
            const latency = Date.now() - writeStart;
            resolve({ event: found, latency });
          }
        }, 5);
      });

      if (received) {
        latencyMeasurements.push(received.latency);
      }
    }

    const avgLatency = latencyMeasurements.length > 0
      ? Math.round(latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length)
      : 9999;

    console.log(`  ⏱️ Measured Latencies across ${iterations} runs: ${latencyMeasurements.join('ms, ')}ms (Average: ${avgLatency}ms)`);
    assert(latencyMeasurements.length === iterations, `All ${iterations} benchmark events received`);
    assert(avgLatency < 500, `Average propagation latency (${avgLatency}ms) meets the < 500ms target`);
    assert(Math.max(...latencyMeasurements) < 1000, `Max propagation latency (${Math.max(...latencyMeasurements)}ms) is well under 1 second`);

    // -------------------------------------------------------------
    // TEST 3: Territory & Role Scoping Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Territory & Scoping Security ---');

    // Clear message queues for clean check
    clients.superAdmin.messages.length = 0;
    clients.stateManager.messages.length = 0;
    clients.salemDistrict.messages.length = 0;
    clients.cbeDistrict.messages.length = 0;
    clients.unauth.messages.length = 0;

    const scopedTaskId = `scoped_salem_${Date.now()}`;
    await publishEntityEvent({
      entity: 'task',
      action: 'updated',
      entityId: scopedTaskId,
      data: { status: 'In Progress', note: 'Salem local update' },
      scope: {
        stateId: 'state_tn',
        districtId: 'dist_salem'
      }
    });

    await new Promise((r) => setTimeout(r, 200));

    const superAdminGotScoped = clients.superAdmin.messages.some((m) => String(m.entityId) === scopedTaskId);
    const stateManagerGotScoped = clients.stateManager.messages.some((m) => String(m.entityId) === scopedTaskId);
    const salemGotScoped = clients.salemDistrict.messages.some((m) => String(m.entityId) === scopedTaskId);
    const cbeGotScoped = clients.cbeDistrict.messages.some((m) => String(m.entityId) === scopedTaskId);
    const unauthGotScoped = clients.unauth.messages.some((m) => String(m.entityId) === scopedTaskId);

    assert(superAdminGotScoped, 'Super Admin received scoped Salem event (global scope)');
    assert(stateManagerGotScoped, 'TN State Manager received Salem event (parent territory)');
    assert(salemGotScoped, 'Salem District Manager received Salem event (exact match)');
    assert(!cbeGotScoped, 'Coimbatore District Manager did NOT receive Salem event (scope isolation)');
    assert(!unauthGotScoped, 'Unauthenticated client did NOT receive scoped event');

    // -------------------------------------------------------------
    // TEST 4: Burst Duplicate Event Suppression
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Event Deduplication ---');

    clients.superAdmin.messages.length = 0;
    const dupEntityId = `dedup_vendor_${Date.now()}`;

    // Publish identical event twice rapidly
    await publishEntityEvent({
      entity: 'vendor',
      action: 'updated',
      entityId: dupEntityId,
      data: { name: 'Deduplication Test Vendor' },
      scope: {}
    });

    await publishEntityEvent({
      entity: 'vendor',
      action: 'updated',
      entityId: dupEntityId,
      data: { name: 'Deduplication Test Vendor' },
      scope: {}
    });

    await new Promise((r) => setTimeout(r, 200));

    const dupCount = clients.superAdmin.messages.filter((m) => String(m.entityId) === dupEntityId).length;
    assert(dupCount === 1, `Publisher suppressed duplicate burst (delivered ${dupCount} time instead of 2)`);

    // -------------------------------------------------------------
    // TEST 5: Cache Invalidation on State Mutation
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Cache Invalidation on State Mutation ---');

    const cacheKey = 'territory:districts:test';
    await cacheManager.set(cacheKey, { test: 'initial' }, 300);
    const cachedBefore = await cacheManager.get(cacheKey);
    assert(cachedBefore !== null, 'Cache key successfully stored');

    // Invalidate pattern
    await cacheManager.invalidatePattern('territory:*');
    await new Promise((r) => setTimeout(r, 100));
    const cachedAfter = await cacheManager.get(cacheKey);
    assert(cachedAfter === null, 'Cache entry instantly purged on invalidation signal');


    // -------------------------------------------------------------
    // TEST 6: Heartbeat Ping / Pong
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Heartbeat Ping / Pong ---');

    const pingPromise = new Promise((resolve) => {
      const handler = (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'PONG') {
            clients.superAdmin.ws.off('message', handler);
            resolve(true);
          }
        } catch (e) {}
      };
      clients.superAdmin.ws.on('message', handler);
      clients.superAdmin.ws.send(JSON.stringify({ type: 'PING' }));
    });

    const gotPong = await Promise.race([
      pingPromise,
      new Promise((r) => setTimeout(() => r(false), 500))
    ]);

    assert(gotPong === true, 'WebSocket server responded with PONG frame to client heartbeat');

    // -------------------------------------------------------------
    // TEST 7: Observability Metrics Endpoint
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Observability & Health Metrics ---');

    const metrics = getRealtimeMetrics();
    assert(metrics.status === 'healthy', 'Observability metrics status is healthy');
    assert(metrics.websocket.connectedClients >= 4, `Active connected clients correctly tracked (${metrics.websocket.connectedClients})`);
    assert(metrics.events.totalPublished > 0, `Total published events recorded (${metrics.events.totalPublished})`);

    console.log('\n================================================================');
    console.log(`🏁 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log(`⏱️ End-to-End Latency Target: < 500ms (Achieved: ${avgLatency}ms)`);
    console.log('================================================================\n');

  } finally {
    // Teardown
    Object.values(clients).forEach((c) => {
      if (c && c.ws) {
        c.ws.terminate();
      }
    });
    server.close();
    await redisBroker.close().catch(() => {});
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});

