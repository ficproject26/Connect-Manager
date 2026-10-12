const assert = require('assert');
const { validateVendorCreationScope } = require('../src/middleware/scopeMiddleware');
const locationController = require('../src/controllers/locationController');
const db = require('../src/config/db');

// Helper to mock Express req, res, next
const mockReqRes = (user, body = {}, query = {}) => {
  const req = { user, body: { ...body }, query: { ...query } };
  let responseData = null;
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return { req, res, next, getStatus: () => statusCode, getData: () => responseData, wasNextCalled: () => nextCalled };
};

async function runTests() {
  console.log('--- STARTING ROLE-BASED TERRITORY LOCKING & VALIDATION TEST SUITE ---');

  // Ensure test fixtures in memory
  await db.states.insertOne({ _id: 'state_test_ka', name: 'Karnataka', status: 'Active' });
  await db.states.insertOne({ _id: 'state_test_tn', name: 'Tamil Nadu', status: 'Active' });

  await db.districts.insertOne({ _id: 'dist_blr', name: 'Bengaluru Urban', stateId: 'state_test_ka', status: 'Active' });
  await db.districts.insertOne({ _id: 'dist_mys', name: 'Mysuru', stateId: 'state_test_ka', status: 'Active' });
  await db.districts.insertOne({ _id: 'dist_chennai', name: 'Chennai', stateId: 'state_test_tn', status: 'Active' });

  await db.divisions.insertOne({ _id: 'div_blr_south', name: 'Bengaluru South', districtId: 'dist_blr', stateId: 'state_test_ka', status: 'Active' });
  await db.divisions.insertOne({ _id: 'div_blr_north', name: 'Bengaluru North', districtId: 'dist_blr', stateId: 'state_test_ka', status: 'Active' });
  await db.divisions.insertOne({ _id: 'div_mys_city', name: 'Mysuru City', districtId: 'dist_mys', stateId: 'state_test_ka', status: 'Active' });

  await db.pincodes.insertOne({ _id: 'pin_560001', code: '560001', divisionId: 'div_blr_south', districtId: 'dist_blr', stateId: 'state_test_ka', status: 'Active' });
  await db.pincodes.insertOne({ _id: 'pin_560002', code: '560002', divisionId: 'div_blr_south', districtId: 'dist_blr', stateId: 'state_test_ka', status: 'Active' });
  await db.pincodes.insertOne({ _id: 'pin_560099', code: '560099', divisionId: 'div_blr_north', districtId: 'dist_blr', stateId: 'state_test_ka', status: 'Active' });

  // 1. STATE MANAGER TESTS
  console.log('\n[TEST 1] State Manager: Scope & Submission Validation');
  const stateMgr = { id: 'u_stm', role: 'state_manager', stateId: 'state_test_ka' };
  
  // 1.A Valid submission in scope
  {
    const { req, res, wasNextCalled, next } = mockReqRes(stateMgr, {
      districtId: 'dist_blr',
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, next);
    assert(wasNextCalled(), 'Valid State Manager submission should be approved by middleware');
    assert.strictEqual(req.body.stateId, 'state_test_ka', 'State Manager assigned state must be enforced');
    console.log('  ✓ State Manager valid territory accepted');
  }

  // 1.B Out of scope district (Chennai is in Tamil Nadu, manager is in Karnataka)
  {
    let nextCalled = false;
    const { req, res, getStatus, getData } = mockReqRes(stateMgr, {
      districtId: 'dist_chennai',
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(!nextCalled, 'Out of scope district submission must NOT call next()');
    assert.strictEqual(getStatus(), 403, 'Should reject out-of-scope district with 403');
    console.log('  ✓ Server correctly rejected district outside State Manager scope (403)');
  }

  // 1.C Division mismatch with District
  {
    let nextCalled = false;
    const { req, res, getStatus, getData } = mockReqRes(stateMgr, {
      districtId: 'dist_mys',
      divisionId: 'div_blr_south', // Belongs to dist_blr, not dist_mys
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(!nextCalled, 'Mismatched division for district must NOT call next()');
    assert.strictEqual(getStatus(), 403, 'Should reject division mismatch with 403');
    console.log('  ✓ Server correctly rejected division mismatch (403)');
  }

  // 2. DISTRICT MANAGER TESTS
  console.log('\n[TEST 2] District Manager: Scope & Submission Validation');
  const distMgr = { id: 'u_dtm', role: 'district_manager', stateId: 'state_test_ka', districtId: 'dist_blr' };

  // 2.A Valid submission within assigned district
  {
    let nextCalled = false;
    const { req, res, wasNextCalled } = mockReqRes(distMgr, {
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'Valid District Manager submission should be approved');
    assert.strictEqual(req.body.districtId, 'dist_blr', 'District Manager assigned district must be enforced');
    console.log('  ✓ District Manager valid territory accepted');
  }

  // 2.B Attempt to submit another district
  {
    let nextCalled = false;
    const { req, res, getStatus } = mockReqRes(distMgr, {
      districtId: 'dist_mys', // Different district
      divisionId: 'div_mys_city',
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(!nextCalled, 'Attempting another district must NOT call next()');
    assert.strictEqual(getStatus(), 403, 'Should reject foreign district with 403');
    console.log('  ✓ Server correctly rejected foreign district for District Manager (403)');
  }

  // 2.C Division not in assigned district
  {
    let nextCalled = false;
    const { req, res, getStatus } = mockReqRes(distMgr, {
      divisionId: 'div_mys_city', // In Mysuru, manager assigned to Bengaluru
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(!nextCalled, 'Attempting foreign division must NOT call next()');
    assert.strictEqual(getStatus(), 403, 'Should reject division not belonging to assigned district with 403');
    console.log('  ✓ Server correctly rejected foreign division for District Manager (403)');
  }

  // 3. DIVISION MANAGER TESTS
  console.log('\n[TEST 3] Division Manager: Scope & Submission Validation');
  const divMgr = { id: 'u_div', role: 'division_manager', stateId: 'state_test_ka', districtId: 'dist_blr', divisionId: 'div_blr_south' };

  // 3.A Valid submission in assigned division
  {
    let nextCalled = false;
    const { req, res } = mockReqRes(divMgr, {
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'Valid Division Manager submission should be approved');
    assert.strictEqual(req.body.divisionId, 'div_blr_south', 'Division Manager assigned division must be enforced');
    console.log('  ✓ Division Manager valid territory accepted');
  }

  // 3.B Pincode outside assigned division
  {
    let nextCalled = false;
    const { req, res, getStatus } = mockReqRes(divMgr, {
      divisionId: 'div_blr_north', // Foreign division
      pincodeId: 'pin_560099'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(!nextCalled, 'Foreign division must NOT call next()');
    assert.strictEqual(getStatus(), 403, 'Should reject foreign division with 403');
    console.log('  ✓ Server correctly rejected foreign division for Division Manager (403)');
  }

  // 4. PINCODE MANAGER TESTS
  console.log('\n[TEST 4] Pincode Manager: Scope & Submission Validation');
  const pinMgr = { id: 'u_pin', role: 'pincode_manager', stateId: 'state_test_ka', districtId: 'dist_blr', divisionId: 'div_blr_south', pincodeId: 'pin_560001' };

  // 4.A Valid submission
  {
    let nextCalled = false;
    const { req, res } = mockReqRes(pinMgr, {
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'Pincode Manager valid submission should call next()');
    assert.strictEqual(req.body.pincodeId, 'pin_560001');
    console.log('  ✓ Pincode Manager valid assigned pincode accepted');
  }

  // 4.B Attempt to submit another pincode
  {
    let nextCalled = false;
    const { req, res, getStatus } = mockReqRes(pinMgr, {
      pincodeId: 'pin_560002' // Different pincode
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(!nextCalled, 'Foreign pincode must NOT call next()');
    assert.strictEqual(getStatus(), 403, 'Should reject unauthorized pincode with 403');
    console.log('  ✓ Server correctly rejected unauthorized pincode for Pincode Manager (403)');
  }

  // 5. MISSING ASSIGNED TERRITORY TEST
  console.log('\n[TEST 5] Manager Profile Missing Territory Assignments');
  {
    const brokenMgr = { id: 'u_broken', role: 'district_manager', stateId: 'state_test_ka', districtId: null };
    let nextCalled = false;
    const { req, res, getStatus, getData } = mockReqRes(brokenMgr, {
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560001'
    });
    await validateVendorCreationScope(req, res, () => { nextCalled = true; });
    assert(!nextCalled, 'Missing territory on manager profile must prevent onboarding');
    assert.strictEqual(getStatus(), 403, 'Should reject with 403');
    console.log('  ✓ Server rejected manager with missing territory configuration (403)');
  }

  // 6. LOCATION CONTROLLER DROPDOWN BEHAVIOR FOR ROLES
  console.log('\n[TEST 6] Location Controller Cascading & Role-Based Filtering');
  // 6.A State Manager can query all districts in assigned state
  {
    const { req, res, getData } = mockReqRes(stateMgr, {}, { stateId: 'state_test_ka' });
    await locationController.getDistricts(req, res);
    const result = getData();
    assert(result.success && result.data.length >= 2, 'State Manager should receive all districts in assigned state');
    const districtIds = result.data.map(d => d._id);
    assert(districtIds.includes('dist_blr') && districtIds.includes('dist_mys'), 'Must include both Bengaluru and Mysuru');
    console.log('  ✓ State Manager getDistricts returns all districts in assigned state');
  }

  // 6.B District Manager getDistricts only returns assigned district
  {
    const { req, res, getData } = mockReqRes(distMgr, {}, { stateId: 'state_test_ka' });
    await locationController.getDistricts(req, res);
    const result = getData();
    assert(result.success && result.data.length === 1, 'District Manager must only receive their assigned district');
    assert.strictEqual(result.data[0]._id, 'dist_blr', 'Must be dist_blr');
    console.log('  ✓ District Manager getDistricts returns only assigned district');
  }

  // 6.C District Manager getDivisions returns divisions in assigned district
  {
    const { req, res, getData } = mockReqRes(distMgr, {}, { districtId: 'dist_blr' });
    await locationController.getDivisions(req, res);
    const result = getData();
    assert(result.success && result.data.length >= 2, 'District Manager should receive divisions in assigned district');
    const divIds = result.data.map(v => v._id);
    assert(divIds.includes('div_blr_south') && divIds.includes('div_blr_north'), 'Must include South and North divisions');
    console.log('  ✓ District Manager getDivisions returns all divisions in assigned district');
  }

  // 6.D District Manager getPincodes returns all pincodes in selected division (NOT restricted to manager home pincode)
  {
    const distMgrWithHomePin = { ...distMgr, pincodeId: 'pin_560001' };
    const { req, res, getData } = mockReqRes(distMgrWithHomePin, {}, { divisionId: 'div_blr_south' });
    await locationController.getPincodes(req, res);
    const result = getData();
    assert(result.success && result.data.length >= 2, 'District Manager should receive all pincodes in division, not just home pincode');
    console.log('  ✓ District Manager getPincodes returns all division pincodes');
  }

  // 6.E Division Manager getDivisions only returns assigned division
  {
    const { req, res, getData } = mockReqRes(divMgr, {}, { districtId: 'dist_blr' });
    await locationController.getDivisions(req, res);
    const result = getData();
    assert(result.success && result.data.length === 1, 'Division Manager only receives assigned division');
    assert.strictEqual(result.data[0]._id, 'div_blr_south');
    console.log('  ✓ Division Manager getDivisions returns only assigned division');
  }

  // 6.F Pincode Manager getPincodes only returns assigned pincode
  {
    const { req, res, getData } = mockReqRes(pinMgr, {}, { divisionId: 'div_blr_south' });
    await locationController.getPincodes(req, res);
    const result = getData();
    assert(result.success && result.data.length === 1, 'Pincode Manager only receives assigned pincode');
    assert.strictEqual(result.data[0]._id, 'pin_560001');
    console.log('  ✓ Pincode Manager getPincodes returns only assigned pincode');
  }

  console.log('\n--- ALL ROLE-BASED TERRITORY TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
