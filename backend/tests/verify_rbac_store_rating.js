const db = require('../src/config/db');
const managerDirectoryController = require('../src/controllers/managerDirectoryController');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('========================================================================');
  console.log('🧪 RUNNING STRICT VERIFICATION SUITE: MANAGERS DIRECTORY RBAC & STORE RATING');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  function assert(cond, msg) {
    if (cond) {
      console.log('  ✅ PASS: ' + msg);
      passed++;
    } else {
      console.error('  ❌ FAIL: ' + msg);
      failed++;
    }
  }

  const users = await db.users.find();
  const mgrs = await db.managers.find();
  const allUsers = [...users, ...mgrs];

  const surya = allUsers.find(u => u.name === 'Surya');
  const iniya = allUsers.find(u => u.name === 'iniya');
  const vennila = allUsers.find(u => u.name === 'Vennila');
  const muruga = allUsers.find(u => u.name === 'Muruga');

  const mockReqRes = (user, query = {}) => {
    return new Promise((resolve) => {
      const req = {
        user: {
          _id: String(user._id || user.id),
          id: String(user._id || user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          stateId: user.stateId,
          state: user.state || user.stateName,
          stateName: user.state || user.stateName,
          districtId: user.districtId,
          district: user.district || user.districtName,
          districtName: user.district || user.districtName,
          divisionId: user.divisionId,
          division: user.division || user.divisionName,
          divisionName: user.division || user.divisionName,
          pincodeId: user.pincodeId,
          pincode: user.pincode || user.pincodeCode,
          pincodeCode: user.pincode || user.pincodeCode
        },
        query
      };
      let headers = {};
      const res = {
        status: (code) => ({
          json: (data) => resolve({ status: code, data, headers }),
          send: (data) => resolve({ status: code, data, headers })
        }),
        json: (data) => resolve({ status: 200, data, headers }),
        send: (data) => resolve({ status: 200, data, headers }),
        setHeader: (k, v) => { headers[k] = v; }
      };
      managerDirectoryController.getLowerLevelManagers(req, res);
    });
  };

  // 1. State Manager Verification
  console.log('--- 1. State Manager (Level 1: Surya - Tamil Nadu) ---');
  const r1 = await mockReqRes(surya);
  assert(r1.status === 200, 'State Manager request returns 200 OK');
  assert(r1.data.supervisors.length === 0, 'State Manager has 0 higher-level managers (supervisors = 0)');
  assert(!r1.data.all.some(m => (m.stateName || '').toLowerCase().includes('karnataka')), 'State Manager CANNOT access unrelated states (0 Karnataka managers)');
  assert(r1.data.peers.every(m => m.role === 'state_manager' && (m.stateName || '').toLowerCase().includes('tamil nadu')), 'State Manager peers are strictly Level 1 managers within Tamil Nadu');
  assert(r1.data.subordinates.every(m => ['district_manager', 'division_manager', 'pincode_manager'].includes(m.role)), 'State Manager subordinates are strictly Level 2, 3, 4 managers');

  // 2. District Manager Verification
  console.log('\n--- 2. District Manager (Level 2: iniya - Krishnagiri, Tamil Nadu) ---');
  const r2 = await mockReqRes(iniya);
  assert(r2.status === 200, 'District Manager request returns 200 OK');
  assert(!r2.data.all.some(m => m.role === 'state_manager'), 'District Manager MUST NOT view State Managers (0 Level 1 managers)');
  assert(!r2.data.all.some(m => (m.districtName || '').toLowerCase() === 'salem'), 'District Manager MUST NOT view managers in other districts (0 Salem managers)');
  assert(r2.data.supervisors.length === 0, 'District Manager reporting authority array is strictly empty');
  assert(r2.data.subordinates.every(m => (m.districtName || '').toLowerCase() === 'krishnagiri'), 'District Manager subordinates are strictly within assigned district (Krishnagiri)');

  // 2b. Direct API bypass test for District Manager
  const r2BypassRole = await mockReqRes(iniya, { role: 'state_manager' });
  assert(r2BypassRole.data.count === 0, 'Direct API bypass attempt (?role=state_manager) returns 0 records');
  const r2BypassLevel = await mockReqRes(iniya, { level: '1' });
  assert(r2BypassLevel.data.count === 0, 'Direct API bypass attempt (?level=1) returns 0 records');

  // 3. Division Manager Verification
  console.log('\n--- 3. Division Manager (Level 3: Vennila - Hosur, Krishnagiri, Tamil Nadu) ---');
  const r3 = await mockReqRes(vennila);
  assert(r3.status === 200, 'Division Manager request returns 200 OK');
  assert(!r3.data.all.some(m => m.role === 'state_manager' || m.role === 'district_manager'), 'Division Manager MUST NOT view State or District Managers');
  assert(r3.data.supervisors.length === 0, 'Division Manager reporting authority array is strictly empty');
  assert(r3.data.subordinates.every(m => (m.divisionName || '').toLowerCase() === 'hosur'), 'Division Manager subordinates are strictly within assigned division (Hosur)');

  // 3b. Direct API bypass test for Division Manager
  const r3BypassDist = await mockReqRes(vennila, { role: 'district_manager' });
  assert(r3BypassDist.data.count === 0, 'Direct API bypass attempt (?role=district_manager) returns 0 records');

  // 4. Pincode Manager Verification
  console.log('\n--- 4. Pincode Manager (Level 4: Muruga - PIN 636112, Thalaivasal, Salem) ---');
  const r4 = await mockReqRes(muruga);
  assert(r4.status === 200, 'Pincode Manager request returns 200 OK');
  assert(!r4.data.all.some(m => m.role !== 'pincode_manager'), 'Pincode Manager MUST NOT view State, District, or Division Managers');
  assert(r4.data.subordinates.length === 0, 'Pincode Manager has 0 subordinates');
  assert(r4.data.supervisors.length === 0, 'Pincode Manager reporting authority is strictly empty');

  // 4b. Direct API bypass test for Pincode Manager
  const r4BypassDiv = await mockReqRes(muruga, { role: 'division_manager' });
  assert(r4BypassDiv.data.count === 0, 'Direct API bypass attempt (?role=division_manager) returns 0 records');

  // 5. Query parameters, tabs, and CSV export
  console.log('\n--- 5. Query Parameters, Tabs, and Export ---');
  const rTabEqual = await mockReqRes(surya, { tab: 'equal' });
  assert(rTabEqual.data.all.length === rTabEqual.data.peers.length, 'Tab equal returns strictly peers');
  const rTabReporting = await mockReqRes(surya, { tab: 'reporting' });
  assert(rTabReporting.data.count === 0, 'Tab reporting returns 0 records');
  const rSearch = await mockReqRes(surya, { search: 'iniya' });
  assert(rSearch.data.count === 1 && rSearch.data.all[0].name === 'iniya', 'Search query correctly filters authorized managers');
  const rExport = await mockReqRes(surya, { export: 'csv' });
  assert(rExport.status === 200 && rExport.headers['Content-Type'] === 'text/csv', 'CSV export endpoint returns authorized records in text/csv format');

  // 6. Fail-closed security checks
  console.log('\n--- 6. Fail-Closed Security Checks ---');
  const rFailNoRole = await mockReqRes({ id: 'bad' });
  assert(rFailNoRole.status === 401, 'Request without authenticated user role returns 401');
  const rFailBadRole = await mockReqRes({ id: 'bad', role: 'unknown' });
  assert(rFailBadRole.status === 403, 'Request with unverified role returns 403');
  const rFailNoTerritory = await mockReqRes({ id: 'bad', role: 'district_manager' });
  assert(rFailNoTerritory.status === 403, 'Request without assigned district jurisdiction returns 403');

  // 7. Store Rating Removal Verification
  console.log('\n--- 7. Store Rating Removal from Vendor Profile ---');
  const vendorDetailsFile = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'VendorDetails.jsx'), 'utf8');
  assert(!vendorDetailsFile.includes('Store Rating'), 'Store Rating text completely absent from VendorDetails.jsx');
  assert(!vendorDetailsFile.includes('vendor.rating'), 'vendor.rating completely absent from VendorDetails.jsx');
  assert(!vendorDetailsFile.includes('Star,'), 'Star icon import removed from VendorDetails.jsx');

  console.log('\n========================================================================');
  console.log('TEST SUMMARY: ' + passed + ' PASSED, ' + failed + ' FAILED');
  console.log('========================================================================');

  process.exit(failed > 0 ? 1 : 0);
})();
