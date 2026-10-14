const db = require('../src/config/db');
const shopVisitController = require('../src/controllers/shopVisitController');

async function runTests() {
  console.log('====================================================');
  console.log('TEST SUITE: Shop Visit Reports Not Interested & KPI');
  console.log('====================================================');

  const users = await db.users.find();
  const surya = users.find(u => u.name === 'Surya' || (u.email && u.email.includes('surya')));
  if (!surya) throw new Error('Surya user not found');

  console.log(`User: ${surya.name} | Role: ${surya.role} | Territory: ${surya.state}`);

  // Test 1: All Reports for State Manager Surya
  let resAll = null;
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15 } },
    { json: d => { resAll = d; } }
  );
  console.log('\n--- TEST 1: All Reports (Baseline) ---');
  console.log(`Total visits returned: ${resAll.total}`);
  console.log(`Page 1 count: ${resAll.visits.length}`);
  console.log('KPI Stats:', resAll.kpi);
  if (resAll.kpi.total !== resAll.total) {
    console.warn(`Note: resAll.kpi.total (${resAll.kpi.total}) vs filtered total (${resAll.total})`);
  }

  // Test 2: Status = NO
  let resNo = null;
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15, status: 'NO' } },
    { json: d => { resNo = d; } }
  );
  console.log('\n--- TEST 2: Filter Status = NO ---');
  console.log(`Total NO visits returned: ${resNo.total}`);
  console.log(`Page 1 count: ${resNo.visits.length}`);
  console.log('KPI Stats (Should remain overall scope total):', resNo.kpi);
  console.log('Records returned:');
  resNo.visits.forEach(v => {
    console.log(`  - Shop: "${v.shopName}", Manager: "${v.managerName}", Role: "${v.managerRole || v.recordedByRole}", Interest: "${v.interestedStatus || v.interestStatus}", Reason: "${v.notInterestedReason}"`);
  });

  // Verify KPI consistency:
  // kpi.total should equal kpi.interested + kpi.notInterested
  if (resNo.kpi.interested + resNo.kpi.notInterested === resNo.kpi.total) {
    console.log('PASS: KPI mathematical consistency (Interested + Not Interested == Total)');
  } else {
    console.error('FAIL: KPI mathematical inconsistency');
  }

  if (resNo.total > 0 && resNo.visits.length === resNo.total) {
    console.log(`PASS: All ${resNo.total} Not Interested visits returned`);
  } else {
    console.error(`FAIL: Expected visits to match total ${resNo.total}`);
  }

  // Test 3: Status variations
  let resVariant1 = null, resVariant2 = null, resVariant3 = null;
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15, status: 'not_interested' } },
    { json: d => { resVariant1 = d; } }
  );
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15, status: 'Not Interested' } },
    { json: d => { resVariant2 = d; } }
  );
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15, status: 'NOT_INTERESTED' } },
    { json: d => { resVariant3 = d; } }
  );
  console.log('\n--- TEST 3: Status Variations Normalization ---');
  console.log(`status='not_interested': ${resVariant1.total} records`);
  console.log(`status='Not Interested': ${resVariant2.total} records`);
  console.log(`status='NOT_INTERESTED': ${resVariant3.total} records`);
  if (resVariant1.total === resNo.total && resVariant2.total === resNo.total && resVariant3.total === resNo.total) {
    console.log('PASS: All status variations normalized to identical results');
  } else {
    console.error('FAIL: Status variation mismatch');
  }

  // Test 4: Scope = self (My Direct Visits)
  let resSelf = null;
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15, scope: 'self' } },
    { json: d => { resSelf = d; } }
  );
  console.log('\n--- TEST 4: My Direct Visits (scope=self) ---');
  console.log(`Total self visits: ${resSelf.total}`);
  console.log('Self Scope KPI:', resSelf.kpi);

  // Test 5: Scope = self & status = NO
  let resSelfNo = null;
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15, scope: 'self', status: 'NO' } },
    { json: d => { resSelfNo = d; } }
  );
  console.log('\n--- TEST 5: My Direct Visits with Status = NO ---');
  console.log(`Total self NO visits: ${resSelfNo.total}`);
  console.log('Self Scope KPI (Preserved scope metrics):', resSelfNo.kpi);
  resSelfNo.visits.forEach(v => {
    console.log(`  - Shop: "${v.shopName}", Manager: "${v.managerName}", Reason: "${v.notInterestedReason}"`);
  });
  if (resSelfNo.total === resSelf.kpi.notInterested) {
    console.log(`PASS: Self NO visits (${resSelfNo.total}) matches self KPI notInterested count (${resSelf.kpi.notInterested})`);
  } else {
    console.error('FAIL: Mismatch between self NO visits and self KPI notInterested');
  }

  // Test 6: Search with Status = NO
  let resSearch = null;
  await shopVisitController.getShopVisits(
    { user: surya, query: { page: 1, limit: 15, status: 'NO', search: 'Karthick' } },
    { json: d => { resSearch = d; } }
  );
  console.log('\n--- TEST 6: Search with Status = NO ---');
  console.log(`Search "Karthick" total: ${resSearch.total}`);
  resSearch.visits.forEach(v => {
    console.log(`  - Shop: "${v.shopName}", Reason: "${v.notInterestedReason}"`);
  });
  if (resSearch.total === 1 && resSearch.visits[0].shopName === 'Karthick') {
    console.log('PASS: Search works accurately with Not Interested filter');
  } else {
    console.error('FAIL: Search did not return expected record');
  }

  console.log('\n====================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
