const db = require('../src/config/db');
const territoryScopeService = require('../src/services/territoryScopeService');
const shopVisitController = require('../src/controllers/shopVisitController');
const reportController = require('../src/controllers/reportController');
const authController = require('../src/controllers/authController');
const vendorController = require('../src/controllers/vendorController');
const managerDirectoryController = require('../src/controllers/managerDirectoryController');

async function runTests() {
  console.log('========================================================================');
  console.log('PRODUCTION E2E & RBAC ACCEPTANCE TEST SUITE');
  console.log('========================================================================\n');

  await db.initDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // 1. Fetch test users across all 4 tiers plus another state
  const surya = await db.users.findOne({ email: 'surya@gmail.com' }); // State Manager (Tamil Nadu)
  const bala = await db.users.findOne({ email: 'bala@gmail.com' }); // State Manager (Karnataka)
  const ironman = await db.users.findOne({ email: 'ironman@gmail.com' }); // District Manager (Madurai, TN)
  const balavignesh = await db.users.findOne({ email: 'balavignesh@gmail.com' }); // Division Manager (Vandalur, Chengalpattu, TN)
  const muruga = await db.users.findOne({ email: 'muruga@gmail.com' }); // Pincode Manager (636112, Salem, TN)

  console.log('Loaded users:');
  console.log('- Surya:', surya?.role, surya?.state);
  console.log('- Bala:', bala?.role, bala?.state);
  console.log('- Ironman:', ironman?.role, ironman?.district, ironman?.state);
  console.log('- Balavignesh:', balavignesh?.role, balavignesh?.division, balavignesh?.district, balavignesh?.state);
  console.log('- Muruga:', muruga?.role, muruga?.pincode, muruga?.division, muruga?.district, muruga?.state);
  console.log('------------------------------------------------------------------------\n');

  // Helper to mock Express req & res
  function mockReqRes(user, query = {}, params = {}, body = {}) {
    let responseData = null;
    let statusCode = 200;
    const req = { user, query, params, body, headers: {} };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      setHeader() {},
      send(data) {
        responseData = data;
        return this;
      }
    };
    return { req, res, getResult: () => ({ status: statusCode, data: responseData }) };
  }

  // TEST 1: State Manager (Surya) sees Tamil Nadu reports, NO Karnataka reports
  {
    const { req, res, getResult } = mockReqRes(surya, { scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const result = getResult();
    const visits = result.data?.data || [];
    const hasKarnataka = visits.some(v => (v.state || v.assignedState) === 'Karnataka');
    const hasTamilNadu = visits.some(v => (v.state || v.assignedState) === 'Tamil Nadu' || !v.state);
    assert(result.status === 200 && visits.length > 0 && !hasKarnataka && hasTamilNadu,
      'Test 1: State Manager sees Tamil Nadu reports and NO Karnataka reports',
      `Count: ${visits.length}, hasKarnataka: ${hasKarnataka}`
    );
  }

  // TEST 2: District Manager (Ironman - Madurai) sees ONLY Madurai & authorized subordinates
  // NEVER sees State Manager reports or other districts (Salem, Krishnagiri)
  {
    const { req, res, getResult } = mockReqRes(ironman, { scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const result = getResult();
    const visits = result.data?.data || [];
    const hasStateMgrReports = visits.some(v => v.managerRole === 'state_manager' || v.recordedByRole === 'state_manager');
    const hasOutsideMadurai = visits.some(v => v.district && v.district.toLowerCase() !== 'madurai');
    assert(result.status === 200 && !hasStateMgrReports && !hasOutsideMadurai,
      'Test 2: District Manager sees only own district and NEVER State Manager reports or other districts',
      `Visits: ${visits.length}, hasStateMgrReports: ${hasStateMgrReports}, hasOutsideMadurai: ${hasOutsideMadurai}`
    );
  }

  // TEST 3: Division Manager (Balavignesh - Vandalur) sees ONLY Vandalur data
  // NEVER sees State or District Manager reports or other divisions
  {
    const { req, res, getResult } = mockReqRes(balavignesh, { scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const result = getResult();
    const visits = result.data?.data || [];
    const hasHigherReports = visits.some(v => ['state_manager', 'district_manager'].includes(v.managerRole || v.recordedByRole));
    const hasOutsideVandalur = visits.some(v => v.division && v.division.toLowerCase() !== 'vandalur');
    assert(result.status === 200 && !hasHigherReports && !hasOutsideVandalur,
      'Test 3: Division Manager sees only own division and NEVER State/District Manager reports',
      `Visits: ${visits.length}, hasHigherReports: ${hasHigherReports}, hasOutsideVandalur: ${hasOutsideVandalur}`
    );
  }

  // TEST 4: Pincode Manager (Muruga - 636112) sees ONLY records for assigned pincode
  {
    const { req, res, getResult } = mockReqRes(muruga, { scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const result = getResult();
    const visits = result.data?.data || [];
    const hasHigherReports = visits.some(v => ['state_manager', 'district_manager', 'division_manager'].includes(v.managerRole || v.recordedByRole));
    const hasOutsidePin = visits.some(v => v.pincode && String(v.pincode) !== '636112');
    assert(result.status === 200 && !hasHigherReports && !hasOutsidePin,
      'Test 4: Pincode Manager sees only assigned pincode records',
      `Visits: ${visits.length}, hasHigherReports: ${hasHigherReports}, hasOutsidePin: ${hasOutsidePin}`
    );
  }

  // TEST 5: My Reports returns ONLY the authenticated user's own reports
  {
    const { req, res, getResult } = mockReqRes(surya, { scope: 'self' });
    await shopVisitController.getShopVisits(req, res);
    const result = getResult();
    const visits = result.data?.data || [];
    const allSelf = visits.every(v => String(v.recordedById || v.userId || v.managerId) === String(surya._id || surya.id));
    assert(result.status === 200 && allSelf,
      'Test 5: My Reports (scope=self) returns ONLY the authenticated user\'s own reports',
      `Total: ${visits.length}, allSelf: ${allSelf}`
    );
  }

  // TEST 6: All Reports returns strictly permitted dataset by role hierarchy
  {
    const { req, res, getResult } = mockReqRes(ironman, { scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const visits = getResult().data?.data || [];
    const validLevels = visits.every(v => {
      const role = v.managerRole || v.recordedByRole || '';
      return ['district_manager', 'division_manager', 'pincode_manager', ''].includes(role);
    });
    assert(validLevels,
      'Test 6: All Reports restricts to authorized hierarchy only',
      `validLevels: ${validLevels}`
    );
  }

  // TEST 7: Client cannot bypass territory scope by injecting query parameters
  {
    // Ironman (District Manager Madurai) attempts to query district=Salem or state=Karnataka
    const { req, res, getResult } = mockReqRes(ironman, { district: 'Salem', state: 'Karnataka', scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const visits = getResult().data?.data || [];
    const hasSalem = visits.some(v => v.district === 'Salem');
    const hasKarnataka = visits.some(v => v.state === 'Karnataka');
    assert(!hasSalem && !hasKarnataka,
      'Test 7: Client cannot bypass territory boundary by passing query params',
      `hasSalem: ${hasSalem}, hasKarnataka: ${hasKarnataka}`
    );
  }

  // TEST 8: Export to CSV and search honor authorization boundary
  {
    const { req, res, getResult } = mockReqRes(ironman, { exportCsv: 'true' });
    await shopVisitController.getShopVisits(req, res);
    const result = getResult();
    const csvContent = String(result.data || '');
    const leaksStateMgr = csvContent.includes('State Manager') || csvContent.includes('surya@gmail.com');
    assert(result.status === 200 && !leaksStateMgr,
      'Test 8: CSV Export does not leak unauthorized managers or higher-tier data',
      `leaksStateMgr: ${leaksStateMgr}`
    );
  }

  // TEST 9: Merchant & Tie-ups Trend reflects real database records
  {
    const { req, res, getResult } = mockReqRes(surya);
    await reportController.getDashboardStats(req, res);
    const result = getResult();
    const trend6m = result.data?.trendData?.['6m'] || [];
    const hasMonths = trend6m.length === 6;
    const hasRealActivity = trend6m.some(m => m.merchants > 0);
    const hasProperFields = trend6m.every(m => typeof m.month === 'string' && typeof m.merchants === 'number' && typeof m.tieUps === 'number');
    assert(result.status === 200 && hasMonths && hasRealActivity && hasProperFields,
      'Test 9: Merchant & Tie-ups Trend reflects real non-zero database records and selected date ranges',
      `Months: ${trend6m.length}, hasRealActivity: ${hasRealActivity}, sample: ${JSON.stringify(trend6m.slice(-3))}`
    );
  }

  // TEST 10: Territory Performance displays real authorized territory metrics
  {
    const { req, res, getResult } = mockReqRes(surya);
    await reportController.getDashboardStats(req, res);
    const result = getResult();
    const roleData = result.data?.roleSpecificData;
    const distBreakdown = roleData?.districtBreakdown || [];
    const divBreakdown = roleData?.divisionBreakdown || [];
    const pinBreakdown = roleData?.pincodeBreakdown || [];

    const hasDistMetrics = distBreakdown.length > 0 && distBreakdown.some(d => d.totalVendors > 0 || d.shopVisits > 0);
    const hasDivMetrics = divBreakdown.length > 0 && divBreakdown.some(d => d.totalVendors > 0 || d.shopVisits > 0);
    const hasPinMetrics = pinBreakdown.length > 0 && pinBreakdown.some(d => d.totalVendors > 0 || d.shopVisits > 0);

    assert(hasDistMetrics && hasDivMetrics && hasPinMetrics,
      'Test 10: Territory Performance aggregates real authorized metrics for Districts, Divisions, and Pincodes',
      `dist: ${distBreakdown.length}, div: ${divBreakdown.length}, pin: ${pinBreakdown.length}`
    );
  }

  // TEST 11: Resume Onboarding status and Duplicate Prevention
  {
    const { req, res, getResult } = mockReqRes(surya, { scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const visits = getResult().data?.data || [];
    const completedVisits = visits.filter(v => v.isOnboardingCompleted === true);
    const pendingVisits = visits.filter(v => v.isOnboardingCompleted === false);

    const completedAreIneligible = completedVisits.every(v => v.isEligibleForResume === false);
    const pendingAreEligible = pendingVisits.every(v => v.isEligibleForResume === true);

    // Also test duplicate vendor prevention in createVendor
    const activeVendor = await db.vendors.findOne({ status: 'Approved' });
    let duplicateBlocked = false;
    if (activeVendor) {
      const dupReqRes = mockReqRes(surya, {}, {}, {
        name: activeVendor.ownerName || activeVendor.name || 'Test Owner',
        mobile: activeVendor.phone || activeVendor.mobile || '9876543210',
        businessName: activeVendor.businessName,
        category: activeVendor.category || 'Retail',
        stateId: activeVendor.stateId,
        districtId: activeVendor.districtId
      });
      await vendorController.createVendor(dupReqRes.req, dupReqRes.res);
      duplicateBlocked = dupReqRes.getResult().status === 409;
    }

    assert(completedVisits.length > 0 && completedAreIneligible && duplicateBlocked,
      'Test 11: Resume Onboarding hidden for completed vendors & duplicate vendor creation blocked with 409',
      `completedVisits: ${completedVisits.length}, duplicateBlocked: ${duplicateBlocked}`
    );
  }

  // TEST 12: Manager Bank Account Details persistence and privacy
  {
    // Update bank details for Balavignesh
    const bankPayload = {
      accountHolderName: 'Balavignesh K',
      accountNumber: '112233445566',
      bankName: 'HDFC Bank',
      ifscCode: 'HDFC0001234',
      branchName: 'Vandalur Branch',
      city: 'Chennai'
    };
    const updateReqRes = mockReqRes(balavignesh, {}, {}, bankPayload);
    await authController.updateBankDetails(updateReqRes.req, updateReqRes.res);
    const updateResult = updateReqRes.getResult();

    // Verify in database
    const updatedUserInDb = await db.users.findById(balavignesh._id);
    const dbBankMatch = updatedUserInDb?.bankDetails?.accountNumber === '112233445566';

    // Verify getMe returns saved details
    const getMeReqRes = mockReqRes(updatedUserInDb);
    await authController.getMe(getMeReqRes.req, getMeReqRes.res);
    const meResult = getMeReqRes.getResult();
    const meBankMatch = meResult.data?.user?.bankDetails?.accountNumber === '112233445566';

    // Verify manager directory does NOT leak bank details to another manager
    const dirReqRes = mockReqRes(surya); // Surya viewing directory
    await managerDirectoryController.getLowerLevelManagers(dirReqRes.req, dirReqRes.res);
    const dirList = dirReqRes.getResult().data?.all || dirReqRes.getResult().data?.data || [];
    const balaInDir = dirList.find(m => String(m.id || m._id) === String(balavignesh._id));
    const bankLeakedInDir = balaInDir && (balaInDir.bankDetails || balaInDir.bankAccount);

    assert(updateResult.status === 200 && dbBankMatch && meBankMatch && !bankLeakedInDir,
      'Test 12: Bank details persist to DB, returned in profile API, and NOT leaked to other managers in directory',
      `dbBankMatch: ${dbBankMatch}, meBankMatch: ${meBankMatch}, bankLeakedInDir: ${bankLeakedInDir}`
    );
  }

  // TEST 13: Missing or invalid territory mappings do not cause unauthorized records to appear
  {
    const unmappedUser = { id: 'dummy_unmapped', role: 'division_manager', division: 'NonExistentDivision999' };
    const { req, res, getResult } = mockReqRes(unmappedUser, { scope: 'all' });
    await shopVisitController.getShopVisits(req, res);
    const visits = getResult().data?.data || [];
    assert(visits.length === 0,
      'Test 13: Missing or invalid territory mappings safely return empty dataset without leakage',
      `Visits returned: ${visits.length}`
    );
  }

  // TEST 14: Report Submission workflow creates persistent record with proper territory metadata
  {
    const newVisitPayload = {
      shopName: 'Test Automation Grocery',
      vendorName: 'Automated Owner',
      ownerName: 'Automated Owner',
      contactNumber: '9988776655',
      phone: '9988776655',
      category: 'Grocery',
      interestedStatus: 'YES',
      interestStatus: 'YES',
      address: 'Main Bazaar, Vandalur, Tamil Nadu',
      state: 'Tamil Nadu',
      district: 'Chengalpattu',
      division: 'Vandalur',
      pincode: '600048'
    };
    const createReqRes = mockReqRes(balavignesh, {}, {}, newVisitPayload);
    await shopVisitController.createShopVisit(createReqRes.req, createReqRes.res);
    const createResult = createReqRes.getResult();
    const createdId = createResult.data?.data?._id || createResult.data?.data?.id;

    let foundInDb = false;
    if (createdId) {
      const inDb = await db.shopVisits.findById(createdId);
      foundInDb = !!inDb;
      // Clean up test record
      await db.shopVisits.deleteOne({ _id: createdId });
    }

    assert(createResult.status === 201 && foundInDb,
      'Test 14: Existing shop visit submission workflow functions cleanly and persists to database',
      `status: ${createResult.status}, foundInDb: ${foundInDb}`
    );
  }

  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
