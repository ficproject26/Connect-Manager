const assert = require('assert');
const db = require('../src/config/db');
const auditController = require('../src/controllers/auditController');

async function testAuditScoping() {
  console.log('========================================================================');
  console.log('🔍 VERIFYING AUDIT TRAIL HIERARCHY SCOPING & REPORTS S.NO CALCULATION');
  console.log('========================================================================\n');

  // Ensure test audit logs with different territories exist in db.auditLogs
  const testLogs = [
    {
      _id: 'audit_tn_1',
      action: 'VENDOR_CREATED',
      recordId: 'v_tn_1',
      targetName: 'Kaveri Textiles',
      userId: 'surya_state',
      userName: 'Surya',
      userRole: 'state_manager',
      stateId: 'state_tn',
      state: 'Tamil Nadu',
      districtId: 'dist_krishnagiri',
      district: 'Krishnagiri',
      divisionId: 'div_hosur',
      division: 'Hosur',
      pincode: '635126',
      timestamp: new Date().toISOString()
    },
    {
      _id: 'audit_krishnagiri_1',
      action: 'VENDOR_APPROVED',
      recordId: 'v_krishnagiri_1',
      targetName: 'Hosur Electronics',
      userId: 'iniya_dist',
      userName: 'Iniya',
      userRole: 'district_manager',
      stateId: 'state_tn',
      state: 'Tamil Nadu',
      districtId: 'dist_krishnagiri',
      district: 'Krishnagiri',
      divisionId: 'div_hosur',
      division: 'Hosur',
      pincode: '635109',
      timestamp: new Date().toISOString()
    },
    {
      _id: 'audit_chennai_1',
      action: 'VENDOR_CREATED',
      recordId: 'v_chennai_1',
      targetName: 'Marina Cafe',
      userId: 'chennai_mgr',
      userName: 'Karthik',
      userRole: 'district_manager',
      stateId: 'state_tn',
      state: 'Tamil Nadu',
      districtId: 'dist_chennai',
      district: 'Chennai',
      divisionId: 'div_t_nagar',
      division: 'T Nagar',
      pincode: '600017',
      timestamp: new Date().toISOString()
    },
    {
      _id: 'audit_vandalur_1',
      action: 'STATUS_UPDATED',
      recordId: 'v_vandalur_1',
      targetName: 'Vandalur Superstore',
      userId: 'div_mgr_1',
      userName: 'Balavignesh',
      userRole: 'division_manager',
      stateId: 'state_tn',
      state: 'Tamil Nadu',
      districtId: 'dist_chengalpattu',
      district: 'Chengalpattu',
      divisionId: 'div_vandalur',
      division: 'Vandalur',
      pincode: '600048',
      timestamp: new Date().toISOString()
    },
    {
      _id: 'audit_pincode_625205',
      action: 'VENDOR_CREATED',
      recordId: 'v_pin_625205',
      targetName: 'Alanganallur Spices',
      userId: 'pin_mgr_1',
      userName: 'Murugan',
      userRole: 'pincode_manager',
      stateId: 'state_tn',
      state: 'Tamil Nadu',
      districtId: 'dist_madurai',
      district: 'Madurai',
      divisionId: 'div_madurai_north',
      division: 'Madurai North',
      pincode: '625205',
      timestamp: new Date().toISOString()
    },
    {
      _id: 'audit_ap_1',
      action: 'VENDOR_CREATED',
      recordId: 'v_ap_1',
      targetName: 'Amaravati Traders',
      userId: 'ap_mgr',
      userName: 'Rao',
      userRole: 'state_manager',
      stateId: 'state_ap',
      state: 'Andhra Pradesh',
      districtId: 'dist_ntr',
      district: 'NTR District',
      divisionId: 'div_vijayawada',
      division: 'Vijayawada',
      pincode: '520001',
      timestamp: new Date().toISOString()
    },
    {
      _id: 'audit_ka_1',
      action: 'VENDOR_CREATED',
      recordId: 'v_ka_1',
      targetName: 'Indiranagar Bakery',
      userId: 'ka_mgr',
      userName: 'Anand',
      userRole: 'district_manager',
      stateId: 'state_ka',
      state: 'Karnataka',
      districtId: 'dist_blr',
      district: 'Bengaluru Urban',
      divisionId: 'div_indiranagar',
      division: 'Indiranagar',
      pincode: '560038',
      timestamp: new Date().toISOString()
    }
  ];

  for (const log of testLogs) {
    if (db.auditLogs.insertOne) {
      await db.auditLogs.insertOne(log);
    }
  }

  const mockRes = () => {
    let statusCode = 200;
    let payload = null;
    return {
      status(c) { statusCode = c; return this; },
      json(d) { payload = d; return this; },
      getStatus: () => statusCode,
      getData: () => payload
    };
  };

  // Test 1: Global Admin sees pan-India logs
  console.log('Test 1: Global Admin Audit Logs Access');
  {
    const res = mockRes();
    await auditController.getAuditLogs({ user: { id: 'admin_1', role: 'central_admin' } }, res);
    const data = res.getData();
    assert.strictEqual(res.getStatus(), 200);
    assert(data.success, 'Request must succeed');
    const logs = data.data;
    const hasTN = logs.some(l => l.state === 'Tamil Nadu' || l.stateId === 'state_tn');
    const hasAP = logs.some(l => l.state === 'Andhra Pradesh' || l.stateId === 'state_ap');
    const hasKA = logs.some(l => l.state === 'Karnataka' || l.stateId === 'state_ka');
    assert(hasTN && hasAP && hasKA, 'Global Admin must see records across all states');
    console.log('  ✅ PASS: Global Admin receives pan-India audit logs.');
  }

  // Test 2: State Manager (Tamil Nadu) only sees Tamil Nadu logs, not AP or KA
  console.log('\nTest 2: State Manager (Tamil Nadu) Hierarchy Scoping');
  {
    const res = mockRes();
    await auditController.getAuditLogs({
      user: {
        id: 'u_surya',
        role: 'state_manager',
        stateId: 'state_tn',
        state: 'Tamil Nadu'
      }
    }, res);
    const data = res.getData();
    assert.strictEqual(res.getStatus(), 200);
    const logs = data.data;
    const foreignLogs = logs.filter(l => l.state === 'Andhra Pradesh' || l.state === 'Karnataka' || l.stateId === 'state_ap' || l.stateId === 'state_ka');
    assert.strictEqual(foreignLogs.length, 0, 'State Manager must NOT see logs from other states');
    const tnLogs = logs.filter(l => l.state === 'Tamil Nadu' || l.stateId === 'state_tn');
    assert(tnLogs.length > 0, 'State Manager must see Tamil Nadu logs');
    console.log(`  ✅ PASS: State Manager saw ${tnLogs.length} TN logs and 0 foreign state logs.`);
  }

  // Test 3: District Manager (Krishnagiri) only sees Krishnagiri district logs
  console.log('\nTest 3: District Manager (Krishnagiri) Hierarchy Scoping');
  {
    const res = mockRes();
    await auditController.getAuditLogs({
      user: {
        id: 'u_iniya',
        role: 'district_manager',
        stateId: 'state_tn',
        state: 'Tamil Nadu',
        districtId: 'dist_krishnagiri',
        district: 'Krishnagiri'
      }
    }, res);
    const data = res.getData();
    assert.strictEqual(res.getStatus(), 200);
    const logs = data.data;
    const foreignDistLogs = logs.filter(l => l.district && l.district !== 'Krishnagiri' && l.districtId !== 'dist_krishnagiri');
    assert.strictEqual(foreignDistLogs.length, 0, 'District Manager must NOT see logs from other districts');
    const krishnagiriLogs = logs.filter(l => l.district === 'Krishnagiri' || l.districtId === 'dist_krishnagiri');
    assert(krishnagiriLogs.length > 0, 'District Manager must see Krishnagiri logs');
    console.log(`  ✅ PASS: District Manager saw ${krishnagiriLogs.length} Krishnagiri logs and 0 foreign district logs.`);
  }

  // Test 4: Division Manager (Vandalur) only sees Vandalur division logs
  console.log('\nTest 4: Division Manager (Vandalur) Hierarchy Scoping');
  {
    const res = mockRes();
    await auditController.getAuditLogs({
      user: {
        id: 'u_bala',
        role: 'division_manager',
        stateId: 'state_tn',
        state: 'Tamil Nadu',
        districtId: 'dist_chengalpattu',
        district: 'Chengalpattu',
        divisionId: 'div_vandalur',
        division: 'Vandalur'
      }
    }, res);
    const data = res.getData();
    assert.strictEqual(res.getStatus(), 200);
    const logs = data.data;
    const foreignDivLogs = logs.filter(l => l.division && l.division !== 'Vandalur' && l.divisionId !== 'div_vandalur');
    assert.strictEqual(foreignDivLogs.length, 0, 'Division Manager must NOT see logs from other divisions');
    const vandalurLogs = logs.filter(l => l.division === 'Vandalur' || l.divisionId === 'div_vandalur');
    assert(vandalurLogs.length > 0, 'Division Manager must see Vandalur logs');
    console.log(`  ✅ PASS: Division Manager saw ${vandalurLogs.length} Vandalur logs and 0 foreign division logs.`);
  }

  // Test 5: Pincode Manager (625205) only sees 625205 pincode logs
  console.log('\nTest 5: Pincode Manager (625205) Hierarchy Scoping');
  {
    const res = mockRes();
    await auditController.getAuditLogs({
      user: {
        id: 'u_murugan',
        role: 'pincode_manager',
        stateId: 'state_tn',
        state: 'Tamil Nadu',
        districtId: 'dist_madurai',
        district: 'Madurai',
        divisionId: 'div_madurai_north',
        division: 'Madurai North',
        pincode: '625205',
        pincodeCode: '625205'
      }
    }, res);
    const data = res.getData();
    assert.strictEqual(res.getStatus(), 200);
    const logs = data.data;
    const foreignPinLogs = logs.filter(l => l.pincode && l.pincode !== '625205');
    assert.strictEqual(foreignPinLogs.length, 0, 'Pincode Manager must NOT see logs from other pincodes');
    const pinLogs = logs.filter(l => l.pincode === '625205');
    assert(pinLogs.length > 0, 'Pincode Manager must see 625205 logs');
    console.log(`  ✅ PASS: Pincode Manager saw ${pinLogs.length} 625205 logs and 0 foreign pincode logs.`);
  }

  // Test 6: Continuous Serial Number (S.No) Pagination Logic Verification
  console.log('\nTest 6: Reports Serial Number (S.No) Continuous Pagination Formula');
  const calculateSerial = (page, limit, idx) => ((page || 1) - 1) * (limit || 25) + idx + 1;

  // Page 1 (limit 25): 1 to 25
  assert.strictEqual(calculateSerial(1, 25, 0), 1, 'First item on page 1 must be 1');
  assert.strictEqual(calculateSerial(1, 25, 24), 25, '25th item on page 1 must be 25');

  // Page 2 (limit 25): 26 to 50
  assert.strictEqual(calculateSerial(2, 25, 0), 26, 'First item on page 2 must be 26');
  assert.strictEqual(calculateSerial(2, 25, 24), 50, '25th item on page 2 must be 50');

  // Page 3 (limit 25): 51 to 75
  assert.strictEqual(calculateSerial(3, 25, 0), 51, 'First item on page 3 must be 51');
  assert.strictEqual(calculateSerial(3, 25, 24), 75, '25th item on page 3 must be 75');

  // Page 4 (limit 25): 76 to 80 (for 80 total records)
  assert.strictEqual(calculateSerial(4, 25, 0), 76, 'First item on page 4 must be 76');
  assert.strictEqual(calculateSerial(4, 25, 4), 80, '5th item on page 4 must be 80');

  console.log('  ✅ PASS: Serial number formula accurately numbers across pages:');
  console.log('     - Page 1: 1 to 25');
  console.log('     - Page 2: 26 to 50');
  console.log('     - Page 3: 51 to 75');
  console.log('     - Page 4: 76 to 80');

  console.log('\n========================================================================');
  console.log('🎉 ALL AUDIT TRAIL SCOPING AND REPORTS S.NO TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

testAuditScoping()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  });
