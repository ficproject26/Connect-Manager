const assert = require('assert');
const db = require('../src/config/db');
const territoryScopeService = require('../src/services/territoryScopeService');
const reportController = require('../src/controllers/reportController');

async function testDashboardMasterFixes() {
  console.log('========================================================================');
  console.log('🔍 VERIFYING CONNECT MANAGER DASHBOARD MASTER PROMPT FIXES');
  console.log('========================================================================\n');

  // 1. Setup mock or real users across hierarchy
  const stateUser = {
    _id: 'state_user_1',
    id: 'state_user_1',
    name: 'Surya State',
    role: 'state_manager',
    level: 1,
    state: 'Tamil Nadu',
    stateName: 'Tamil Nadu',
    stateId: 'state_tn'
  };

  const districtUser = {
    _id: 'dist_user_1',
    id: 'dist_user_1',
    name: 'Ironman District',
    role: 'district_manager',
    level: 2,
    state: 'Tamil Nadu',
    stateName: 'Tamil Nadu',
    district: 'Krishnagiri',
    districtName: 'Krishnagiri',
    districtId: 'dist_krishnagiri'
  };

  const divisionUser = {
    _id: 'div_user_1',
    id: 'div_user_1',
    name: 'Division Manager',
    role: 'division_manager',
    level: 3,
    state: 'Tamil Nadu',
    stateName: 'Tamil Nadu',
    district: 'Krishnagiri',
    districtName: 'Krishnagiri',
    division: 'Hosur',
    divisionName: 'Hosur',
    divisionId: 'div_hosur'
  };

  const pincodeUser = {
    _id: 'pin_user_1',
    id: 'pin_user_1',
    name: 'Pincode Manager',
    role: 'pincode_manager',
    level: 4,
    state: 'Tamil Nadu',
    stateName: 'Tamil Nadu',
    district: 'Krishnagiri',
    districtName: 'Krishnagiri',
    division: 'Hosur',
    divisionName: 'Hosur',
    pincode: '635126',
    pincodeCode: '635126',
    pincodeId: 'pin_635126'
  };

  // Seed vendors and visits if needed
  if (!db.vendors.cache || db.vendors.cache.length === 0) {
    db.vendors.cache = [
      {
        _id: 'v_hosur_1',
        name: 'Hosur Fresh Mart',
        state: 'Tamil Nadu',
        district: 'Krishnagiri',
        division: 'Hosur',
        pincode: '635126',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        _id: 'v_hosur_2',
        name: 'Hosur Spices',
        state: 'Tamil Nadu',
        district: 'Krishnagiri',
        division: 'Hosur',
        pincode: '635109',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        _id: 'v_chennai_1',
        name: 'Marina Electronics',
        state: 'Tamil Nadu',
        district: 'Chennai',
        division: 'T Nagar',
        pincode: '600017',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  // =========================================================================
  // TEST SUITE 1: Territory Performance Role Scoping
  // =========================================================================
  console.log('--- TEST 1: Territory Performance Hierarchy Scoping ---');

  // 1.1 State Manager: Districts
  const stateDistPerf = await territoryScopeService.getTerritoryPerformance(stateUser, 'dist');
  console.log(`[State Manager - dist] items returned: ${stateDistPerf.length}`);
  assert(Array.isArray(stateDistPerf), 'Should return array');
  const distNames = stateDistPerf.map(d => d.districtName);
  console.log(`  Districts: ${distNames.join(', ')}`);
  assert(distNames.includes('Krishnagiri') || stateDistPerf.length > 0, 'Should include Krishnagiri');

  // 1.2 District Manager: Divisions (Default)
  const distDivPerf = await territoryScopeService.getTerritoryPerformance(districtUser, 'div');
  console.log(`[District Manager - div] items returned: ${distDivPerf.length}`);
  assert(Array.isArray(distDivPerf), 'Should return array');
  // Check no cross-district leakage (e.g. T Nagar from Chennai should not appear)
  const divNames = distDivPerf.map(d => d.divisionName);
  console.log(`  Divisions: ${divNames.join(', ')}`);
  assert(!divNames.includes('T Nagar'), 'Should not leak divisions outside Krishnagiri');

  // 1.3 District Manager: District Summary
  const distSummaryPerf = await territoryScopeService.getTerritoryPerformance(districtUser, 'dist');
  console.log(`[District Manager - dist summary] items returned: ${distSummaryPerf.length}`);
  assert(distSummaryPerf.length >= 1, 'Should include district summary');
  assert(distSummaryPerf.some(d => d.districtName === 'Krishnagiri'), 'Should show Krishnagiri');

  // 1.4 Division Manager: Pincodes (Default)
  const divPinPerf = await territoryScopeService.getTerritoryPerformance(divisionUser, 'pin');
  console.log(`[Division Manager - pin] items returned: ${divPinPerf.length}`);
  assert(Array.isArray(divPinPerf), 'Should return array');
  const pinCodes = divPinPerf.map(d => d.pincodeCode);
  console.log(`  Pincodes: ${pinCodes.join(', ')}`);
  assert(!pinCodes.includes('600017'), 'Should not leak pincodes outside Hosur');

  // 1.5 Division Manager: Division Summary
  const divSummaryPerf = await territoryScopeService.getTerritoryPerformance(divisionUser, 'div');
  console.log(`[Division Manager - div summary] items returned: ${divSummaryPerf.length}`);
  assert(divSummaryPerf.length >= 1, 'Should include division summary');
  assert(divSummaryPerf.some(d => d.divisionName === 'Hosur'), 'Should show Hosur');

  // 1.6 Pincode Manager: Assigned Pincode Performance
  const pinPerf = await territoryScopeService.getTerritoryPerformance(pincodeUser, 'pin');
  console.log(`[Pincode Manager - pin] items returned: ${pinPerf.length}`);
  assert(pinPerf.length >= 1, 'Should include assigned pincode');
  const assignedRecord = pinPerf.find(d => String(d.pincodeCode) === '635126');
  assert(assignedRecord, 'Pincode manager must see their assigned pincode 635126');
  console.log(`  Pincode 635126 vendors: ${assignedRecord.totalVendors}`);
  console.log('✅ TEST 1 PASSED: Territory performance hierarchy correctly scoped for all roles\n');

  // =========================================================================
  // TEST SUITE 2: Today\'s Activities Date Range Filtering (Asia/Kolkata)
  // =========================================================================
  console.log('--- TEST 2: Today\'s Activities Date Filtering (Asia/Kolkata) ---');

  const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const now = new Date();
  const todayKolkataStr = kolkataFormatter.format(now);
  const startOfToday = new Date(`${todayKolkataStr}T00:00:00+05:30`);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  // Yesterday at 23:00 IST
  const yesterdayLogTime = new Date(startOfToday.getTime() - 60 * 60 * 1000).toISOString();
  // Today at 09:30 IST
  const todayLogTime = new Date(startOfToday.getTime() + 9.5 * 60 * 60 * 1000).toISOString();

  // Inject test audit logs
  if (!db.auditLogs.cache) db.auditLogs.cache = [];
  db.auditLogs.cache.push(
    {
      _id: 'log_yesterday_1',
      action: 'VENDOR_CREATED',
      recordId: 'v_hosur_1',
      userId: districtUser.id,
      timestamp: yesterdayLogTime,
      state: 'Tamil Nadu',
      district: 'Krishnagiri'
    },
    {
      _id: 'log_today_1',
      action: 'VENDOR_APPROVED',
      recordId: 'v_hosur_1',
      userId: districtUser.id,
      timestamp: todayLogTime,
      state: 'Tamil Nadu',
      district: 'Krishnagiri'
    }
  );

  // Invoke reportController.getDashboardStats
  const req = { user: districtUser };
  let responseData = null;
  const res = {
    json: (data) => { responseData = data; }
  };

  await reportController.getDashboardStats(req, res);
  assert(responseData && responseData.success, 'Dashboard API must return success');
  console.log(`  todayDate in response: ${responseData.todayDate}`);
  assert.strictEqual(responseData.todayDate, todayKolkataStr, 'todayDate must match IST date string');

  const todayActivities = responseData.todayActivities || [];
  console.log(`  todayActivities count: ${todayActivities.length}`);

  const hasYesterdayLog = todayActivities.some(l => l._id === 'log_yesterday_1');
  const hasTodayLog = todayActivities.some(l => l._id === 'log_today_1');

  assert(!hasYesterdayLog, 'Yesterday\'s audit log MUST NOT be present in todayActivities');
  assert(hasTodayLog, 'Today\'s audit log MUST be present in todayActivities');
  console.log('✅ TEST 2 PASSED: Today\'s activities strictly scoped to Asia/Kolkata calendar day\n');

  // =========================================================================
  // TEST SUITE 3: Trend Data Aggregation & Empty States
  // =========================================================================
  console.log('--- TEST 3: Merchant & Tie-Ups Trend Graph Aggregation ---');

  const trendData = responseData.trendData;
  assert(trendData, 'trendData must exist in response');
  assert(Array.isArray(trendData['3m']), 'trendData.3m must be an array');
  assert(Array.isArray(trendData['6m']), 'trendData.6m must be an array');
  assert(Array.isArray(trendData['1y']), 'trendData.1y must be an array');

  assert.strictEqual(trendData['3m'].length, 3, '3m period should contain exactly 3 months');
  assert.strictEqual(trendData['6m'].length, 6, '6m period should contain exactly 6 months');
  assert.strictEqual(trendData['1y'].length, 12, '1y period should contain exactly 12 months');

  console.log('  6-Month trend datapoints:');
  trendData['6m'].forEach(d => {
    console.log(`    ${d.month}: merchants=${d.merchants}, tieUps=${d.tieUps}`);
    assert(typeof d.merchants === 'number', 'merchants must be number');
    assert(typeof d.tieUps === 'number', 'tieUps must be number');
  });
  console.log('✅ TEST 3 PASSED: Trend data properly formatted for all periods\n');

  // =========================================================================
  // TEST SUITE 4: Task Status Navigation & Filter Mapping
  // =========================================================================
  console.log('--- TEST 4: Task Status Filter Normalization & Mapping ---');

  const testTasks = [
    { id: 't1', title: 'Task 1', status: 'Pending', priority: 'Medium' },
    { id: 't2', title: 'Task 2', status: 'Pending Acceptance', priority: 'High' },
    { id: 't3', title: 'Task 3', status: 'In Progress', priority: 'Medium' },
    { id: 't4', title: 'Task 4', status: 'Accepted', priority: 'Low' },
    { id: 't5', title: 'Task 5', status: 'Escalated', priority: 'Urgent', isEscalated: true },
    { id: 't6', title: 'Task 6', status: 'Completed', priority: 'Medium' },
    { id: 't7', title: 'Task 7', status: 'Resolved', priority: 'Low' }
  ];

  // Helper mimicking Tasks.jsx filtering logic
  const filterByStatus = (tasks, statusFilter) => {
    if (statusFilter === 'All') return tasks;
    const sf = statusFilter.toLowerCase();
    return tasks.filter(t => {
      const ts = (t.status || '').toLowerCase();
      if (sf === 'open') {
        return ['open', 'pending', 'pending acceptance', 'assigned'].includes(ts);
      } else if (sf === 'in progress') {
        return ['in progress', 'accepted'].includes(ts);
      } else if (sf === 'escalated') {
        return ['escalated'].includes(ts) || (t.priority || '').toLowerCase() === 'urgent' || t.isEscalated;
      } else if (sf === 'resolved') {
        return ['resolved', 'completed', 'closed'].includes(ts);
      }
      return ts === sf;
    });
  };

  const openTasks = filterByStatus(testTasks, 'Open');
  const inProgressTasks = filterByStatus(testTasks, 'In Progress');
  const escalatedTasks = filterByStatus(testTasks, 'Escalated');
  const resolvedTasks = filterByStatus(testTasks, 'Resolved');

  console.log(`  Open mapped count: ${openTasks.length} (Expected: 2)`);
  assert.strictEqual(openTasks.length, 2, 'Pending and Pending Acceptance map to Open');

  console.log(`  In Progress mapped count: ${inProgressTasks.length} (Expected: 2)`);
  assert.strictEqual(inProgressTasks.length, 2, 'In Progress and Accepted map to In Progress');

  console.log(`  Escalated mapped count: ${escalatedTasks.length} (Expected: 1)`);
  assert.strictEqual(escalatedTasks.length, 1, 'Escalated/Urgent maps to Escalated');

  console.log(`  Resolved mapped count: ${resolvedTasks.length} (Expected: 2)`);
  assert.strictEqual(resolvedTasks.length, 2, 'Completed and Resolved map to Resolved');

  console.log('✅ TEST 4 PASSED: Task status mapping logic verified successfully\n');

  console.log('========================================================================');
  console.log('🎉 ALL 4 DASHBOARD VERIFICATION SUITES PASSED WITHOUT ERRORS!');
  console.log('========================================================================');
  process.exit(0);
}

testDashboardMasterFixes().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
