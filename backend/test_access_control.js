const http = require('http');

const PORT = 5005;
process.env.PORT = PORT;

const app = require('./src/server');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const data = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode, headers: res.headers, data });
          } catch (e) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n========================================================================');
  console.log('🧪 TESTING AGENT MANAGER ROLES & LOWER-LEVEL MANAGERS ACCESS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const serverInstance = app.listen(PORT, async () => {
    try {
      // 1. Authenticate Managers across all levels
      console.log('--- 1. Manager Authentication (4 State, 2 District, 2 Division, 2 Pincode) ---');
      const stateLogin1 = await request('POST', '/api/auth/login', { identifier: 'state.mgr1@example.com', password: 'Password@123' });
      assert(stateLogin1.status === 200, 'State Manager 1 logged in');
      const stateToken = stateLogin1.data?.token;

      const stateLogin4 = await request('POST', '/api/auth/login', { identifier: 'state.mgr4@example.com', password: 'Password@123' });
      assert(stateLogin4.status === 200, 'State Manager 4 logged in (4 managers allocated per state)');

      const distLogin = await request('POST', '/api/auth/login', { identifier: 'dist.mgr1@example.com', password: 'Password@123' });
      assert(distLogin.status === 200, 'District Manager 1 logged in');
      const distToken = distLogin.data?.token;

      const divLogin = await request('POST', '/api/auth/login', { identifier: 'div.mgr1@example.com', password: 'Password@123' });
      assert(divLogin.status === 200, 'Division Manager 1 logged in');
      const divToken = divLogin.data?.token;

      const pinLogin = await request('POST', '/api/auth/login', { identifier: 'pin.mgr1@example.com', password: 'Password@123' });
      assert(pinLogin.status === 200, 'Pincode Manager 1 logged in');
      const pinToken = pinLogin.data?.token;

      // 2. State Manager Lower-Level Managers Access
      console.log('\n--- 2. State Manager: Access to Lower-Level Managers ---');
      const stateManagersRes = await request('GET', '/api/managers', null, stateToken);
      assert(stateManagersRes.status === 200, 'State Manager GET /api/managers returned 200');
      const stateSubordinates = stateManagersRes.data?.data || [];
      const hasDist = stateSubordinates.some(m => m.role === 'district_manager');
      const hasDiv = stateSubordinates.some(m => m.role === 'division_manager');
      const hasPin = stateSubordinates.some(m => m.role === 'pincode_manager');
      assert(
        hasDist && hasDiv && hasPin,
        `State Manager can access District, Division, and Pincode managers under the State (found: ${stateSubordinates.length})`
      );

      // 3. District Manager Lower-Level Managers Access
      console.log('\n--- 3. District Manager: Access to Division & Pincode Managers ---');
      const distManagersRes = await request('GET', '/api/managers', null, distToken);
      assert(distManagersRes.status === 200, 'District Manager GET /api/managers returned 200');
      const distSubordinates = distManagersRes.data?.data || [];
      const distHasDiv = distSubordinates.some(m => m.role === 'division_manager');
      const distHasPin = distSubordinates.some(m => m.role === 'pincode_manager');
      const distHasState = distSubordinates.some(m => m.role === 'state_manager');
      assert(
        distHasDiv && distHasPin && !distHasState,
        `District Manager can access Division and Pincode managers in District, but not State managers (found: ${distSubordinates.length})`
      );

      // 4. Division Manager Lower-Level Managers Access
      console.log('\n--- 4. Division Manager: Access to Pincode Managers ---');
      const divManagersRes = await request('GET', '/api/managers', null, divToken);
      assert(divManagersRes.status === 200, 'Division Manager GET /api/managers returned 200');
      const divSubordinates = divManagersRes.data?.data || [];
      const divAllPin = divSubordinates.every(m => m.role === 'pincode_manager');
      assert(
        divAllPin && divSubordinates.length > 0,
        `Division Manager can access only Pincode managers under that Division (found: ${divSubordinates.length})`
      );

      // 5. Pincode Manager (No Lower-Level Managers)
      console.log('\n--- 5. Pincode Manager: No Lower-Level Managers ---');
      const pinManagersRes = await request('GET', '/api/managers', null, pinToken);
      assert(
        pinManagersRes.status === 200 && pinManagersRes.data?.data?.length === 0,
        'Pincode Manager has no lower-level managers (returns empty list)'
      );

      // 6. Security: Preventing Manager Creation by Field Managers
      console.log('\n--- 6. Security: Field Managers Blocked from Creating Managers ---');
      const writeAttempt = await request('POST', '/api/managers', { name: 'Illegal Manager' }, stateToken);
      assert(
        writeAttempt.status === 403,
        `Manager write endpoint blocked with 403 Forbidden (status: ${writeAttempt.status})`
      );

      // 7. Security: Field Managers Blocked from Deactivating Vendors
      console.log('\n--- 7. Security: Field Managers Blocked from Deactivating Vendors ---');
      const vendorsRes = await request('GET', '/api/vendors', null, stateToken);
      const testVendor = vendorsRes.data?.data?.[0];
      if (testVendor) {
        const deactivateAttempt = await request('PATCH', `/api/vendors/${testVendor._id}/status`, { status: 'Inactive' }, stateToken);
        assert(
          deactivateAttempt.status === 403,
          `Vendor deactivation by Manager blocked with 403 Forbidden (status: ${deactivateAttempt.status})`
        );
      }

      // 8. Security: Field Managers Blocked from Re-evaluating Rejected Vendors
      console.log('\n--- 8. Security: Rejected Vendor Re-evaluation Blocked ---');
      const rejectedVendor = vendorsRes.data?.data?.find(v => v.status === 'Rejected');
      if (rejectedVendor) {
        const reevalAttempt = await request('PATCH', `/api/vendors/${rejectedVendor._id}/status`, { status: 'Under Review' }, stateToken);
        assert(
          reevalAttempt.status === 400,
          `Rejected vendor re-evaluation blocked with 400 Bad Request (status: ${reevalAttempt.status})`
        );
      } else {
        console.log('  ℹ️ No rejected vendor in seed data, testing rejection first');
        const pendingVendor = vendorsRes.data?.data?.find(v => v.status === 'Pending' || v.status === 'Under Review');
        if (pendingVendor) {
          await request('PATCH', `/api/vendors/${pendingVendor._id}/status`, { status: 'Rejected', notes: 'Test rejection' }, stateToken);
          const reevalAttempt = await request('PATCH', `/api/vendors/${pendingVendor._id}/status`, { status: 'Under Review' }, stateToken);
          assert(
            reevalAttempt.status === 400,
            `Rejected vendor re-evaluation blocked with 400 Bad Request (status: ${reevalAttempt.status})`
          );
        }
      }

      console.log('\n========================================================================');
      console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
      console.log('========================================================================\n');

      serverInstance.close(() => {
        process.exit(failed > 0 ? 1 : 0);
      });
    } catch (err) {
      console.error('Test execution error:', err);
      serverInstance.close(() => process.exit(1));
    }
  });
}

runTests();
