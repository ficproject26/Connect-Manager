const assert = require('assert');
const db = require('../src/config/db');
const authController = require('../src/controllers/authController');
const taskController = require('../src/controllers/taskController');
const shopVisitController = require('../src/controllers/shopVisitController');

async function runTests() {
  console.log('========================================================================');
  console.log('🔍 VERIFYING ISSUE STATUS NAVIGATION & CSV DATE VALIDATION FIXES');
  console.log('========================================================================\n');

  // Test User
  const stateUser = {
    _id: 'test_surya_state',
    id: 'test_surya_state',
    name: 'Surya State Manager',
    email: 'surya.state@example.com',
    role: 'state_manager',
    level: 1,
    state: 'Tamil Nadu',
    stateName: 'Tamil Nadu',
    stateId: '6aa10f70ca0932e6eaec1f5c',
    status: 'active'
  };

  // Seed user into db.users if not present
  if (!db.users.cache) db.users.cache = [];
  if (!db.users.cache.some(u => u.id === stateUser.id)) {
    db.users.cache.push(stateUser);
  }

  // =========================================================================
  // TEST SUITE 1: Bank Details Resilient Lookup (No 404)
  // =========================================================================
  console.log('--- TEST 1: Bank Details Resilient Retrieval (Eliminating 404) ---');

  // 1.1 Existing user lookup
  let resData1 = null;
  await authController.getBankDetails(
    { user: stateUser },
    {
      status: (code) => ({ json: (d) => { resData1 = { code, ...d }; } }),
      json: (d) => { resData1 = { code: 200, ...d }; }
    }
  );
  assert(resData1 && resData1.success, 'getBankDetails should succeed for existing user');
  assert.strictEqual(resData1.code, 200, 'Should return HTTP 200');
  assert(resData1.bankDetails, 'Should return bankDetails object');
  console.log('  ✓ Existing user bank details returned successfully with 200 OK');

  // 1.2 Uncached or new user ID lookup (previously caused 404)
  let resData2 = null;
  await authController.getBankDetails(
    { user: { id: 'unknown_mgr_id', name: 'New Manager', role: 'state_manager', email: 'unknown@example.com' } },
    {
      status: (code) => ({ json: (d) => { resData2 = { code, ...d }; } }),
      json: (d) => { resData2 = { code: 200, ...d }; }
    }
  );
  assert(resData2 && resData2.success, 'getBankDetails should return default template without 404');
  assert.strictEqual(resData2.code, 200, 'Must return 200 instead of 404');
  assert.strictEqual(resData2.bankDetails.accountHolderName, 'New Manager');
  console.log('  ✓ Unknown/new user gracefully returns default template without 404');
  console.log('✅ TEST 1 PASSED: Bank details endpoints are resilient and never throw 404\n');

  // =========================================================================
  // TEST SUITE 2: Task Controller Normalized Status Queries
  // =========================================================================
  console.log('--- TEST 2: Task Controller Status & ID Query Mapping ---');

  // Ensure test tasks exist in db.tasks
  if (!db.tasks.cache) db.tasks.cache = [];
  const sampleTasks = [
    {
      _id: 'task_open_1',
      id: 'task_open_1',
      title: 'Store Verification 1',
      status: 'Pending Acceptance',
      priority: 'Medium',
      state: 'Tamil Nadu',
      district: 'Krishnagiri',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'task_prog_1',
      id: 'task_prog_1',
      title: 'Store Verification 2',
      status: 'In Progress',
      priority: 'High',
      state: 'Tamil Nadu',
      district: 'Krishnagiri',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'task_esc_1',
      id: 'task_esc_1',
      title: 'Store Verification 3',
      status: 'Assigned',
      priority: 'Urgent',
      isEscalated: true,
      state: 'Tamil Nadu',
      district: 'Krishnagiri',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'task_res_1',
      id: 'task_res_1',
      title: 'Store Verification 4',
      status: 'Completed',
      priority: 'Low',
      state: 'Tamil Nadu',
      district: 'Krishnagiri',
      createdAt: new Date().toISOString()
    }
  ];

  sampleTasks.forEach(st => {
    if (!db.tasks.cache.some(t => (t.id || t._id) === st.id)) {
      db.tasks.cache.push(st);
    }
  });

  const queryTasks = async (query) => {
    let out = null;
    await taskController.getTasks(
      { user: stateUser, query },
      {
        status: (code) => ({ json: (d) => { out = { code, ...d }; } }),
        json: (d) => { out = { code: 200, ...d }; }
      }
    );
    return out?.tasks || out?.data || [];
  };

  // 2.1 Query Open
  const openResult = await queryTasks({ status: 'Open' });
  console.log(`  Query status=Open: found ${openResult.length} tasks`);
  assert(openResult.some(t => t.id === 'task_open_1'), 'Should match Pending Acceptance as Open');

  // 2.2 Query In Progress
  const progResult = await queryTasks({ status: 'In Progress' });
  console.log(`  Query status=In Progress: found ${progResult.length} tasks`);
  assert(progResult.some(t => t.id === 'task_prog_1'), 'Should match In Progress');

  // 2.3 Query Escalated
  const escResult = await queryTasks({ status: 'Escalated' });
  console.log(`  Query status=Escalated: found ${escResult.length} tasks`);
  assert(escResult.some(t => t.id === 'task_esc_1'), 'Should match Urgent/isEscalated as Escalated');

  // 2.4 Query Resolved
  const resResult = await queryTasks({ status: 'Resolved' });
  console.log(`  Query status=Resolved: found ${resResult.length} tasks`);
  assert(resResult.some(t => t.id === 'task_res_1'), 'Should match Completed as Resolved');

  // 2.5 Query specific Task ID
  const idResult = await queryTasks({ taskId: 'task_prog_1' });
  console.log(`  Query taskId=task_prog_1: found ${idResult.length} tasks`);
  assert.strictEqual(idResult.length, 1);
  assert.strictEqual(idResult[0].id, 'task_prog_1');

  console.log('✅ TEST 2 PASSED: Task controller handles mapped statuses and ID lookups\n');

  // =========================================================================
  // TEST SUITE 3: Shop Visits Date Range & Future-Date Handling
  // =========================================================================
  console.log('--- TEST 3: Shop Visits Date Range & Future Date Validation ---');

  // Seed shop visit
  if (!db.shopVisits.cache) db.shopVisits.cache = [];
  const testVisit = {
    _id: 'visit_tn_today',
    shopName: 'Green Grocers',
    state: 'Tamil Nadu',
    district: 'Krishnagiri',
    interestedStatus: 'YES',
    createdAt: new Date().toISOString()
  };
  if (!db.shopVisits.cache.some(v => (v._id || v.id) === testVisit._id)) {
    db.shopVisits.cache.push(testVisit);
  }

  const queryShopVisits = async (query) => {
    let out = null;
    let rawText = null;
    let headers = {};
    await shopVisitController.getShopVisits(
      { user: stateUser, query },
      {
        setHeader: (k, v) => { headers[k] = v; },
        status: (code) => ({
          send: (text) => { rawText = text; out = { code, text, headers }; },
          json: (d) => { out = { code, ...d, headers }; }
        }),
        send: (text) => { rawText = text; out = { code: 200, text, headers }; },
        json: (d) => { out = { code: 200, ...d, headers }; }
      }
    );
    return out;
  };

  // 3.1 Valid historical date range
  const validRange = await queryShopVisits({
    startDate: '2026-09-01',
    endDate: '2026-10-31'
  });
  assert(validRange && validRange.success, 'Valid range should succeed');
  assert(validRange.total >= 1, 'Should find seeded visit');
  console.log(`  ✓ Valid date range returned ${validRange.total} records`);

  // 3.2 Future date range (clamped to today without crashing)
  const futureRange = await queryShopVisits({
    startDate: '2029-01-01',
    endDate: '2029-12-31'
  });
  assert(futureRange && futureRange.success, 'Future range query should process safely without crashing');
  assert.strictEqual(futureRange.total, 0, 'Future range has 0 records');
  console.log('  ✓ Future date range returns 0 records safely without throwing errors');

  // 3.3 CSV Export
  const csvExport = await queryShopVisits({
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    export: 'csv'
  });
  assert.strictEqual(csvExport.code, 200);
  assert(csvExport.headers['Content-Type'] === 'text/csv', 'Should set text/csv header');
  assert(csvExport.text.includes('Shop Name,Category'), 'CSV contains headers');
  assert(csvExport.text.split('\n').length > 5, 'CSV contains multiple rows of data');
  console.log('  ✓ Server-side CSV export generates valid CSV format with headers and rows');

  console.log('✅ TEST 3 PASSED: Shop visit date handling and CSV export verified\n');

  console.log('========================================================================');
  console.log('🎉 ALL ISSUE NAVIGATION & CSV DATE TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
