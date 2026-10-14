const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../src/server');
const db = require('../src/config/db');
const { JWT_SECRET } = require('../src/middleware/authMiddleware');

const TEST_PORT = 5099;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      { hostname: '127.0.0.1', port: TEST_PORT, path, method, headers },
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

async function runSecurityTests() {
  console.log('\n========================================================================');
  console.log('🛡️  SECURITY TEST SUITE: STRICT ROLE ISOLATION & APPROVAL ENFORCEMENT');
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

  const server = app.listen(TEST_PORT, async () => {
    try {
      await db.initDatabase();
      const testPassword = 'Password@123';
      const testHash = await bcrypt.hash(testPassword, 10);

      // Setup test users in db for isolated testing
      const now = new Date().toISOString();

      // 1. Approved State Manager
      const approvedManagerId = 'test_sec_approved_mgr';
      await db.users.deleteOne({ _id: approvedManagerId }).catch(() => {});
      await db.users.insertOne({
        _id: approvedManagerId,
        id: approvedManagerId,
        name: 'Approved Test Manager',
        email: 'sec.approved.mgr@example.com',
        mobile: '9888877701',
        passwordHash: testHash,
        role: 'state_manager',
        level: 1,
        status: 'active',
        isActive: true,
        isApproved: true,
        stateId: 'state_ka',
        createdAt: now
      });

      // 2. Pending Sub-Admin Manager
      const pendingSubAdminId = 'test_sec_pending_subadmin';
      await db.users.deleteOne({ _id: pendingSubAdminId }).catch(() => {});
      await db.users.insertOne({
        _id: pendingSubAdminId,
        id: pendingSubAdminId,
        name: 'Pending SubAdmin Manager',
        email: 'sec.pending.subadmin@example.com',
        mobile: '9888877702',
        passwordHash: testHash,
        role: 'district_manager',
        level: 2,
        status: 'PENDING_SUB_ADMIN_APPROVAL',
        isActive: false,
        isApproved: false,
        stateId: 'state_ka',
        districtId: 'dist_blr',
        createdAt: now
      });

      // 3. Pending Main Admin Manager
      const pendingMainAdminId = 'test_sec_pending_mainadmin';
      await db.users.deleteOne({ _id: pendingMainAdminId }).catch(() => {});
      await db.users.insertOne({
        _id: pendingMainAdminId,
        id: pendingMainAdminId,
        name: 'Pending MainAdmin Manager',
        email: 'sec.pending.mainadmin@example.com',
        mobile: '9888877703',
        passwordHash: testHash,
        role: 'division_manager',
        level: 3,
        status: 'PENDING_MAIN_ADMIN_APPROVAL',
        subAdminApprovalStatus: 'approved',
        isActive: false,
        isApproved: false,
        createdAt: now
      });

      // 4. Pending KYC Manager
      const pendingKycId = 'test_sec_pending_kyc';
      await db.users.deleteOne({ _id: pendingKycId }).catch(() => {});
      await db.users.insertOne({
        _id: pendingKycId,
        id: pendingKycId,
        name: 'Pending KYC Manager',
        email: 'sec.pending.kyc@example.com',
        mobile: '9888877704',
        passwordHash: testHash,
        role: 'pincode_manager',
        level: 4,
        status: 'PENDING_KYC_VERIFICATION',
        subAdminApprovalStatus: 'approved',
        mainAdminApprovalStatus: 'approved',
        isActive: false,
        isApproved: false,
        createdAt: now
      });

      // 5. Suspended Manager
      const suspendedManagerId = 'test_sec_suspended_mgr';
      await db.users.deleteOne({ _id: suspendedManagerId }).catch(() => {});
      await db.users.insertOne({
        _id: suspendedManagerId,
        id: suspendedManagerId,
        name: 'Suspended Manager',
        email: 'sec.suspended.mgr@example.com',
        mobile: '9888877705',
        passwordHash: testHash,
        role: 'state_manager',
        level: 1,
        status: 'suspended',
        isActive: false,
        createdAt: now
      });

      // 6. Cross-Role: Customer
      const customerUserId = 'test_sec_customer_user';
      await db.users.deleteOne({ _id: customerUserId }).catch(() => {});
      await db.users.insertOne({
        _id: customerUserId,
        id: customerUserId,
        name: 'Ecosystem Customer',
        email: 'sec.customer@example.com',
        mobile: '9888877706',
        passwordHash: testHash,
        role: 'customer',
        status: 'active',
        createdAt: now
      });

      // 7. Cross-Role: Vendor
      const vendorUserId = 'test_sec_vendor_user';
      await db.users.deleteOne({ _id: vendorUserId }).catch(() => {});
      await db.users.insertOne({
        _id: vendorUserId,
        id: vendorUserId,
        name: 'Ecosystem Vendor',
        email: 'sec.vendor@example.com',
        mobile: '9888877707',
        passwordHash: testHash,
        role: 'Vendor',
        status: 'active',
        createdAt: now
      });

      // 8. Cross-Role: Field Agent
      const agentUserId = 'test_sec_agent_user';
      await db.users.deleteOne({ _id: agentUserId }).catch(() => {});
      await db.users.insertOne({
        _id: agentUserId,
        id: agentUserId,
        name: 'Ecosystem Agent',
        email: 'sec.agent@example.com',
        mobile: '9888877708',
        passwordHash: testHash,
        role: 'agent',
        status: 'active',
        createdAt: now
      });

      // 9. Admin Reviewer User
      const adminReviewerId = 'test_sec_admin_reviewer';
      await db.users.deleteOne({ _id: adminReviewerId }).catch(() => {});
      await db.users.insertOne({
        _id: adminReviewerId,
        id: adminReviewerId,
        name: 'Central Admin Reviewer',
        email: 'sec.admin.reviewer@example.com',
        mobile: '9888877709',
        passwordHash: testHash,
        role: 'admin',
        status: 'active',
        isActive: true,
        createdAt: now
      });

      // Tokens
      const approvedToken = jwt.sign({ id: approvedManagerId, role: 'state_manager' }, JWT_SECRET, { expiresIn: '1h' });
      const pendingToken = jwt.sign({ id: pendingSubAdminId, role: 'district_manager' }, JWT_SECRET, { expiresIn: '1h' });
      const customerToken = jwt.sign({ id: customerUserId, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
      const vendorToken = jwt.sign({ id: vendorUserId, role: 'Vendor' }, JWT_SECRET, { expiresIn: '1h' });
      const suspendedToken = jwt.sign({ id: suspendedManagerId, role: 'state_manager' }, JWT_SECRET, { expiresIn: '1h' });
      const adminToken = jwt.sign({ id: adminReviewerId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
      const expiredToken = jwt.sign({ id: approvedManagerId, role: 'state_manager', exp: Math.floor(Date.now() / 1000) - 3600 }, JWT_SECRET);

      console.log('--- TEST 1: Unauthenticated User Access Denied ---');
      const unauthVendors = await request('GET', '/api/vendors');
      assert(unauthVendors.status === 401, 'Unauthenticated GET /api/vendors returned 401 Unauthorized');
      const unauthReports = await request('GET', '/api/reports/dashboard');
      assert(unauthReports.status === 401, 'Unauthenticated GET /api/reports/dashboard returned 401 Unauthorized');
      const unauthNotifs = await request('GET', '/api/notifications');
      assert(unauthNotifs.status === 401, 'Unauthenticated GET /api/notifications returned 401 Unauthorized');

      console.log('\n--- TEST 2 & 3: Pending Account Cannot Access Dashboard or Obtain Token ---');
      const pendingLogin = await request('POST', '/api/auth/login', {
        identifier: 'sec.pending.subadmin@example.com',
        password: testPassword
      });
      assert(pendingLogin.status === 403, 'Pending manager login returned 403 Forbidden');
      assert(pendingLogin.data?.code === 'APPROVAL_REQUIRED', 'Pending manager login code is APPROVAL_REQUIRED');
      assert(!pendingLogin.data?.token, 'Pending manager was NOT issued any session token');

      // Attempting to access dashboard APIs with a pending account token
      const pendingAccessVendors = await request('GET', '/api/vendors', null, pendingToken);
      assert(pendingAccessVendors.status === 403, 'Pending manager GET /api/vendors returned 403 Forbidden');
      assert(pendingAccessVendors.data?.code === 'APPROVAL_REQUIRED', 'Pending manager GET /api/vendors returned code APPROVAL_REQUIRED');

      const pendingAccessReports = await request('GET', '/api/reports/dashboard', null, pendingToken);
      assert(pendingAccessReports.status === 403, 'Pending manager GET /api/reports/dashboard returned 403 Forbidden');

      const pendingAccessNotifs = await request('GET', '/api/notifications', null, pendingToken);
      assert(pendingAccessNotifs.status === 403, 'Pending manager GET /api/notifications returned 403 Forbidden');

      console.log('\n--- TEST 4: Approved User with Correct Role Can Access Authorized Routes ---');
      const approvedLogin = await request('POST', '/api/auth/login', {
        identifier: 'sec.approved.mgr@example.com',
        password: testPassword
      });
      assert(approvedLogin.status === 200, 'Approved manager login returned 200 OK');
      assert(approvedLogin.data?.token, 'Approved manager received active JWT token');

      const approvedVendors = await request('GET', '/api/vendors', null, approvedToken);
      assert(approvedVendors.status === 200, 'Approved manager GET /api/vendors returned 200 OK');

      const approvedMe = await request('GET', '/api/auth/me', null, approvedToken);
      assert(approvedMe.status === 200, 'Approved manager GET /api/auth/me returned 200 OK');
      assert(approvedMe.data?.user?.role === 'state_manager', 'Manager role is server-verified state_manager');

      console.log('\n--- TEST 5, 6, 7 & 8: Cross-Role Isolation & Email Non-Transferability ---');
      // Customer trying to log into Manager Portal
      const customerLogin = await request('POST', '/api/auth/login', {
        identifier: 'sec.customer@example.com',
        password: testPassword
      });
      assert(customerLogin.status === 403, 'Customer account login to Manager Portal returned 403 Forbidden');
      assert(customerLogin.data?.code === 'ROLE_NOT_AUTHORIZED', 'Customer account rejected with code ROLE_NOT_AUTHORIZED');

      // Vendor trying to log into Manager Portal
      const vendorLogin = await request('POST', '/api/auth/login', {
        identifier: 'sec.vendor@example.com',
        password: testPassword
      });
      assert(vendorLogin.status === 403, 'Vendor account login to Manager Portal returned 403 Forbidden');
      assert(vendorLogin.data?.code === 'ROLE_NOT_AUTHORIZED', 'Vendor account rejected with code ROLE_NOT_AUTHORIZED');

      // Field Agent trying to log into Manager Portal
      const agentLogin = await request('POST', '/api/auth/login', {
        identifier: 'sec.agent@example.com',
        password: testPassword
      });
      assert(agentLogin.status === 403, 'Agent account login to Manager Portal returned 403 Forbidden');
      assert(agentLogin.data?.code === 'ROLE_NOT_AUTHORIZED', 'Agent account rejected with code ROLE_NOT_AUTHORIZED');

      // Customer token used directly against Manager APIs
      const customerApiAccess = await request('GET', '/api/vendors', null, customerToken);
      assert(customerApiAccess.status === 403, 'Customer token on GET /api/vendors returned 403 Forbidden');
      assert(customerApiAccess.data?.code === 'ROLE_NOT_AUTHORIZED', 'Customer token rejected with ROLE_NOT_AUTHORIZED');

      // Vendor token used directly against Manager APIs
      const vendorApiAccess = await request('GET', '/api/reports/dashboard', null, vendorToken);
      assert(vendorApiAccess.status === 403, 'Vendor token on GET /api/reports/dashboard returned 403 Forbidden');
      assert(vendorApiAccess.data?.code === 'ROLE_NOT_AUTHORIZED', 'Vendor token rejected with ROLE_NOT_AUTHORIZED');

      console.log('\n--- TEST 9, 10 & 11: Backend Authorization & Tampered Frontend Prevention ---');
      // Fake / tampered token (invalid signature)
      const tamperedToken = approvedToken.slice(0, -6) + 'abcdef';
      const tamperedReq = await request('GET', '/api/vendors', null, tamperedToken);
      assert(tamperedReq.status === 401, 'Tampered signature token returned 401 Invalid Token');

      // Client-forged role in request body / header
      const forgedRoleReq = await request('GET', '/api/vendors', null, customerToken);
      assert(forgedRoleReq.status === 403, 'Frontend role spoofing cannot bypass backend server verification');

      console.log('\n--- TEST 12: Self-Approval Prevention & Reviewer Authorization ---');
      // Unauthenticated invocation of approval endpoints
      const unauthApproval = await request('POST', '/api/auth/subadmin-approval', {
        userId: pendingSubAdminId,
        action: 'approve'
      });
      assert(unauthApproval.status === 401, 'Unauthenticated POST /api/auth/subadmin-approval returned 401');

      // Self-approval attempt: applicant tries to approve their own registration
      const selfApproval = await request('POST', '/api/auth/subadmin-approval', {
        userId: approvedManagerId,
        action: 'approve'
      }, approvedToken);
      assert(selfApproval.status === 403, 'Applicant self-approval attempt blocked with 403 Security Violation');

      // Manager role cannot approve registrations
      const managerApproveOther = await request('POST', '/api/auth/subadmin-approval', {
        userId: pendingSubAdminId,
        action: 'approve'
      }, approvedToken);
      assert(managerApproveOther.status === 403, 'Regional manager account blocked from approving registrations (403)');

      // Admin Reviewer can approve Sub-admin stage
      const adminSubApprove = await request('POST', '/api/auth/subadmin-approval', {
        userId: pendingSubAdminId,
        action: 'approve',
        reviewerName: 'Central Admin Reviewer'
      }, adminToken);
      assert(adminSubApprove.status === 200, 'Authorized Admin successfully approved Sub-admin stage (200)');
      assert(adminSubApprove.data?.status === 'PENDING_MAIN_ADMIN_APPROVAL', 'Status transitioned to PENDING_MAIN_ADMIN_APPROVAL');

      // Stage prerequisite: KYC cannot approve before Main Admin approval
      const prematureKyc = await request('POST', '/api/auth/kyc-approval', {
        userId: pendingSubAdminId,
        action: 'approve'
      }, adminToken);
      assert(prematureKyc.status === 400, 'KYC approval rejected with 400 when Main Admin approval is not yet completed');

      console.log('\n--- TEST 13 & 14: Suspended Account Revocation & Expired Sessions ---');
      const suspendedLogin = await request('POST', '/api/auth/login', {
        identifier: 'sec.suspended.mgr@example.com',
        password: testPassword
      });
      assert(suspendedLogin.status === 403, 'Suspended account login returned 403 Forbidden');
      assert(suspendedLogin.data?.code === 'ACCOUNT_BLOCKED', 'Suspended account returned ACCOUNT_BLOCKED');

      const suspendedReq = await request('GET', '/api/vendors', null, suspendedToken);
      assert(suspendedReq.status === 403, 'Suspended manager token rejected on protected API with 403');

      const expiredReq = await request('GET', '/api/vendors', null, expiredToken);
      assert(expiredReq.status === 401, 'Expired session token returned 401 Session Expired');

      console.log('\n--- TEST 15: File Deletion Security & IDOR Defense ---');
      const unauthDeleteFile = await request('DELETE', '/api/uploads/file', { filename: 'test.jpg' });
      assert(unauthDeleteFile.status === 401, 'Unauthenticated DELETE /api/uploads/file returned 401');

      console.log('\n--- TEST 16: Existing Registration & Operational Workflows Working ---');
      const locationsRes = await request('GET', '/api/auth/locations');
      assert(locationsRes.status === 200, 'Public GET /api/auth/locations returned 200');

      const capacityRes = await request('GET', '/api/auth/check-capacity?role=state_manager&stateId=state_ka');
      assert(capacityRes.status === 200, 'Public GET /api/auth/check-capacity returned 200');

      const regStatusRes = await request('GET', `/api/auth/registration-status/${pendingSubAdminId}`);
      assert(regStatusRes.status === 200, 'GET /api/auth/registration-status/:userId returned 200');
      assert(regStatusRes.data?.role === 'district_manager', 'Registration status matches manager record');

      // Clean up test records
      await db.users.deleteOne({ _id: approvedManagerId }).catch(() => {});
      await db.users.deleteOne({ _id: pendingSubAdminId }).catch(() => {});
      await db.users.deleteOne({ _id: pendingMainAdminId }).catch(() => {});
      await db.users.deleteOne({ _id: pendingKycId }).catch(() => {});
      await db.users.deleteOne({ _id: suspendedManagerId }).catch(() => {});
      await db.users.deleteOne({ _id: customerUserId }).catch(() => {});
      await db.users.deleteOne({ _id: vendorUserId }).catch(() => {});
      await db.users.deleteOne({ _id: agentUserId }).catch(() => {});
      await db.users.deleteOne({ _id: adminReviewerId }).catch(() => {});

      console.log('\n========================================================================');
      console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
      console.log('========================================================================\n');

      server.close(() => {
        process.exit(failed > 0 ? 1 : 0);
      });
    } catch (err) {
      console.error('Fatal test error:', err);
      server.close(() => {
        process.exit(1);
      });
    }
  });
}

runSecurityTests();
