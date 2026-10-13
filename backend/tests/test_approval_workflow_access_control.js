process.env.NODE_ENV = 'test';
const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('../src/config/db');
const app = require('../src/server');
const { JWT_SECRET } = require('../src/middleware/authMiddleware');

const TEST_PORT = 8019;

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
            resolve({ status: res.statusCode, headers: res.headers, data, raw });
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

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('🧪 CONNECT APP - MANAGER REGISTRATION APPROVAL & ACCESS CONTROL TEST SUITE');
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

  // Ensure DB is initialized
  if (db.initDatabase) {
    await db.initDatabase();
  }

  // Find existing territory fixtures from DB
  const tnState = await db.states.findOne({ name: 'Tamil Nadu' });
  const pondicherryState = await db.states.findOne({ name: 'Pondicherry' });
  const krishnagiriDist = await db.districts.findById('6aa10f71ca0932e6eaec1f5d');
  const dharmapuriDist = await db.districts.findById('6aa10fa8ca0932e6eaec1f5f');
  const salemDist = await db.districts.findById('6ab9f3e9bec0ef28c6e81405');
  const thalaivasalDiv = await db.divisions.findById('6aba302aaf9e0372e50b72b8');
  const hosurDiv = await db.divisions.findById('6aa10f71ca0932e6eaec1f5e');
  const hosurPin = await db.pincodes.findById('6aba0f82af9e0372e50b70d5');

  console.log(`📍 Territory Fixtures loaded:`);
  console.log(`   - State: ${tnState?.name} (${tnState?._id})`);
  console.log(`   - Krishnagiri District: ${krishnagiriDist?.name} (${krishnagiriDist?._id})`);
  console.log(`   - Dharmapuri District: ${dharmapuriDist?.name} (${dharmapuriDist?._id})`);
  console.log(`   - Thalaivasal Division: ${thalaivasalDiv?.name} (${thalaivasalDiv?._id})`);
  console.log(`   - Hosur PIN: ${hosurPin?.code} (${hosurPin?._id})`);
  console.log(`   - Pondicherry State: ${pondicherryState?.name} (${pondicherryState?._id})`);

  // Existing valid document files from uploads directory
  const validDocs = {
    aadharUrl: '/uploads/1789032744235_1000231966.jpg',
    panUrl: '/uploads/1789032744248_CamScanner_06-03-2021_12_40_5.jpg',
    bankUrl: '/uploads/1789032744259_Adhar_2.jpg',
    signatureUrl: '/uploads/1789032744264_6th_Sem.pdf'
  };

  const validBank = {
    accountHolderName: 'Kavitha Ramasamy',
    bankName: 'State Bank of India',
    branchName: 'Main Branch',
    city: 'Krishnagiri',
    accountNumber: '123456789012',
    ifscCode: 'SBIN0001234'
  };

  const createdTestUserIds = [];

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`🚀 Test server listening on http://127.0.0.1:${TEST_PORT}\n`);

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Newly registered Manager attempts login before Sub-admin approval -> Denied
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 1] Newly Registered Manager Login Before Sub-Admin Approval ---');
    const regTimestamp = Date.now();
    const testEmail1 = `manager.e2e.test1_${regTimestamp}@example.com`;
    const testMobile1 = `98765${String(regTimestamp).slice(-5)}`;

    const regRes1 = await request('POST', '/api/auth/register', {
      name: 'Kavitha Ramasamy',
      email: testEmail1,
      mobile: testMobile1,
      password: 'Password@123',
      role: 'district_manager',
      stateId: tnState?._id,
      districtId: krishnagiriDist?._id,
      dob: '1990-05-15',
      gender: 'female',
      address: '12 Gandhi Road, Krishnagiri',
      declarationAccepted: true,
      documents: validDocs,
      bankDetails: validBank,
      aadharNumber: '987654321012',
      panNumber: 'ABCDE1234F'
    });

    assert(regRes1.status === 201, `Manager registered successfully (HTTP 201). Got: ${regRes1.status}`);
    assert(regRes1.data?.status === 'PENDING_SUB_ADMIN_APPROVAL', `Initial status is PENDING_SUB_ADMIN_APPROVAL (Got: ${regRes1.data?.status})`);
    assert(regRes1.data?.isApproved === false, 'isApproved is explicitly false in registration response');
    assert(!regRes1.data?.token, 'No authentication token is granted at registration');

    const manager1Id = regRes1.data?.user?.id;
    if (manager1Id) createdTestUserIds.push(manager1Id);

    // Attempt login while pending Sub-admin approval
    const loginRes1 = await request('POST', '/api/auth/login', {
      identifier: testEmail1,
      password: 'Password@123'
    });

    assert(loginRes1.status === 403, `Login before Sub-admin approval rejected with HTTP 403 Forbidden (Got: ${loginRes1.status})`);
    assert(loginRes1.data?.code === 'APPROVAL_REQUIRED', `Response code is APPROVAL_REQUIRED (Got: ${loginRes1.data?.code})`);
    assert(loginRes1.data?.isApproved === false, 'Response confirms isApproved: false');
    assert(!loginRes1.data?.token, 'No session token issued on pending login attempt');
    assert(loginRes1.data?.approvalStatus === 'PENDING_SUB_ADMIN_APPROVAL', 'approvalStatus accurately reflects PENDING_SUB_ADMIN_APPROVAL');

    // -------------------------------------------------------------------------
    // SCENARIO 2 & 3: Direct Protected Dashboard APIs Access While Pending -> Blocked
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 2 & 3] Direct Protected Dashboard APIs Access While Pending ---');
    // Calling protected APIs without token
    const noTokenVendors = await request('GET', '/api/vendors');
    assert(noTokenVendors.status === 401, `Calling /api/vendors without token returns 401 Unauthorized (Got: ${noTokenVendors.status})`);

    const noTokenReports = await request('GET', '/api/reports/dashboard');
    assert(noTokenReports.status === 401, `Calling /api/reports/dashboard without token returns 401 Unauthorized (Got: ${noTokenReports.status})`);

    // Calling protected APIs with token for the pending user
    const pendingToken = jwt.sign(
      { id: manager1Id, role: 'district_manager', status: 'PENDING_SUB_ADMIN_APPROVAL' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const pendingApiRes1 = await request('GET', '/api/vendors', null, pendingToken);
    assert(pendingApiRes1.status === 403, `Protected API /api/vendors returns 403 Forbidden for pending user (Got: ${pendingApiRes1.status})`);
    assert(pendingApiRes1.data?.code === 'APPROVAL_REQUIRED', `Protected API error code is APPROVAL_REQUIRED (Got: ${pendingApiRes1.data?.code})`);

    const pendingApiRes2 = await request('GET', '/api/reports/dashboard', null, pendingToken);
    assert(pendingApiRes2.status === 403, `Protected API /api/reports/dashboard returns 403 Forbidden for pending user (Got: ${pendingApiRes2.status})`);

    const pendingApiRes3 = await request('GET', '/api/managers', null, pendingToken);
    assert(pendingApiRes3.status === 403, `Protected API /api/managers returns 403 Forbidden for pending user (Got: ${pendingApiRes3.status})`);

    // -------------------------------------------------------------------------
    // SCENARIO 4: Sub-admin Approves, but KYC is Pending -> Dashboard Access Remains Denied
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 4] Sub-admin Approves, KYC Pending -> Dashboard Access Remains Denied ---');
    const subAdminApprovalRes = await request('POST', '/api/auth/subadmin-approval', {
      userId: manager1Id,
      action: 'approve'
    });

    assert(subAdminApprovalRes.status === 200, `Sub-admin approval succeeded (HTTP 200). Got: ${subAdminApprovalRes.status}`);
    assert(subAdminApprovalRes.data?.status === 'PENDING_KYC_APPROVAL', `Status transitioned to PENDING_KYC_APPROVAL (Got: ${subAdminApprovalRes.data?.status})`);
    assert(subAdminApprovalRes.data?.isApproved === false, 'isApproved remains false when only Sub-admin has approved');
    assert(!subAdminApprovalRes.data?.token, 'No dashboard session token granted upon Sub-admin approval alone');

    // Attempt login when KYC is pending
    const loginRes2 = await request('POST', '/api/auth/login', {
      identifier: testEmail1,
      password: 'Password@123'
    });

    assert(loginRes2.status === 403, `Login rejected with HTTP 403 when KYC is pending (Got: ${loginRes2.status})`);
    assert(loginRes2.data?.code === 'APPROVAL_REQUIRED', `Response code is APPROVAL_REQUIRED (Got: ${loginRes2.data?.code})`);
    assert(loginRes2.data?.approvalStatus === 'PENDING_KYC_APPROVAL', `approvalStatus is PENDING_KYC_APPROVAL (Got: ${loginRes2.data?.approvalStatus})`);
    assert(loginRes2.data?.adminApprovalStatus === 'approved', 'adminApprovalStatus reflects approved');
    assert(loginRes2.data?.routingQueue === 'KYC_APPROVAL_QUEUE', 'routingQueue reflects KYC_APPROVAL_QUEUE');
    assert(!loginRes2.data?.token, 'No session token granted when KYC is pending');

    // Attempt API call with token for KYC-pending user
    const kycPendingToken = jwt.sign(
      { id: manager1Id, role: 'district_manager', status: 'PENDING_KYC_APPROVAL' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const kycPendingApiRes = await request('GET', '/api/vendors', null, kycPendingToken);
    assert(kycPendingApiRes.status === 403, `API /api/vendors blocked with HTTP 403 when KYC is pending (Got: ${kycPendingApiRes.status})`);

    // -------------------------------------------------------------------------
    // SCENARIO 5: Sub-admin Rejects Registration -> Access Denied & Reason Preserved
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 5] Sub-admin Rejects Registration -> Access Denied ---');
    const testEmail2 = `manager.rejected.sub_${regTimestamp}@example.com`;
    const testMobile2 = `98764${String(regTimestamp).slice(-5)}`;

    const regRes2 = await request('POST', '/api/auth/register', {
      name: 'Vijay Chandran',
      email: testEmail2,
      mobile: testMobile2,
      password: 'Password@123',
      role: 'division_manager',
      stateId: tnState?._id,
      districtId: salemDist?._id,
      divisionId: thalaivasalDiv?._id,
      documents: validDocs,
      bankDetails: validBank,
      declarationAccepted: true
    });
    const manager2Id = regRes2.data?.user?.id;
    if (manager2Id) createdTestUserIds.push(manager2Id);

    // Sub-admin rejects registration
    const subAdminRejectRes = await request('POST', '/api/auth/subadmin-approval', {
      userId: manager2Id,
      action: 'reject',
      rejectionReason: 'Territory already has allocated active manager. Quota exceeded.'
    });

    assert(subAdminRejectRes.status === 200, `Sub-admin reject processed (HTTP 200). Got: ${subAdminRejectRes.status}`);
    assert(subAdminRejectRes.data?.status === 'REJECTED_BY_SUB_ADMIN', `Status is REJECTED_BY_SUB_ADMIN (Got: ${subAdminRejectRes.data?.status})`);
    assert(subAdminRejectRes.data?.isApproved === false, 'isApproved is false');
    assert(Boolean(subAdminRejectRes.data?.rejectionReason && subAdminRejectRes.data?.rejectionReason.includes('Quota exceeded')), 'Rejection reason is recorded');

    // Attempt login when rejected by Sub-admin
    const loginRejectSub = await request('POST', '/api/auth/login', {
      identifier: testEmail2,
      password: 'Password@123'
    });

    assert(loginRejectSub.status === 403, `Login rejected with HTTP 403 for Sub-admin rejected account (Got: ${loginRejectSub.status})`);
    assert(loginRejectSub.data?.code === 'REGISTRATION_REJECTED', `Response code is REGISTRATION_REJECTED (Got: ${loginRejectSub.data?.code})`);
    assert(Boolean(loginRejectSub.data?.rejectionReason && loginRejectSub.data?.rejectionReason.includes('Quota exceeded')), 'Rejection reason returned to user');
    assert(!loginRejectSub.data?.token, 'No token granted to rejected account');

    // -------------------------------------------------------------------------
    // SCENARIO 6: KYC Rejects Documents -> Access Denied & Reason Preserved
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 6] KYC Rejects Documents -> Access Denied ---');
    const testEmail3 = `manager.rejected.kyc_${regTimestamp}@example.com`;
    const testMobile3 = `98763${String(regTimestamp).slice(-5)}`;

    const regRes3 = await request('POST', '/api/auth/register', {
      name: 'Anitha Selvam',
      email: testEmail3,
      mobile: testMobile3,
      password: 'Password@123',
      role: 'division_manager',
      stateId: tnState?._id,
      districtId: salemDist?._id,
      divisionId: thalaivasalDiv?._id,
      documents: validDocs,
      bankDetails: validBank,
      declarationAccepted: true
    });
    const manager3Id = regRes3.data?.user?.id;
    if (manager3Id) createdTestUserIds.push(manager3Id);

    // Sub-admin approves first
    await request('POST', '/api/auth/subadmin-approval', { userId: manager3Id, action: 'approve' });

    // KYC rejects
    const kycRejectRes = await request('POST', '/api/auth/kyc-approval', {
      userId: manager3Id,
      action: 'reject',
      rejectionReason: 'Aadhaar document image is blurred and unreadable. Re-upload required.'
    });

    assert(kycRejectRes.status === 200, `KYC reject processed (HTTP 200). Got: ${kycRejectRes.status}`);
    assert(kycRejectRes.data?.status === 'KYC_REJECTED', `Status is KYC_REJECTED (Got: ${kycRejectRes.data?.status})`);
    assert(Boolean(kycRejectRes.data?.rejectionReason && kycRejectRes.data?.rejectionReason.includes('blurred')), 'KYC rejection reason is recorded');

    // Attempt login when KYC rejected
    const loginRejectKyc = await request('POST', '/api/auth/login', {
      identifier: testEmail3,
      password: 'Password@123'
    });

    assert(loginRejectKyc.status === 403, `Login rejected with HTTP 403 for KYC rejected account (Got: ${loginRejectKyc.status})`);
    assert(loginRejectKyc.data?.code === 'REGISTRATION_REJECTED', `Response code is REGISTRATION_REJECTED (Got: ${loginRejectKyc.data?.code})`);
    assert(Boolean(loginRejectKyc.data?.rejectionReason && loginRejectKyc.data?.rejectionReason.includes('blurred')), 'Rejection reason returned to user');
    assert(!loginRejectKyc.data?.token, 'No token granted to KYC rejected account');

    // -------------------------------------------------------------------------
    // SCENARIO 7: Sub-admin Approval AND KYC Approval Completed -> Dashboard Access Granted
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 7] Sub-admin & KYC Approvals Completed -> Dashboard Access Granted ---');
    // Complete KYC approval for manager 1 (who already had Sub-admin approval in Scenario 4)
    const kycApprovalRes1 = await request('POST', '/api/auth/kyc-approval', {
      userId: manager1Id,
      action: 'approve'
    });

    assert(kycApprovalRes1.status === 200, `KYC approval completed (HTTP 200). Got: ${kycApprovalRes1.status}`);
    assert(kycApprovalRes1.data?.status === 'active', `Status is now active (Got: ${kycApprovalRes1.data?.status})`);
    assert(kycApprovalRes1.data?.isApproved === true, 'isApproved is true');
    assert(Boolean(kycApprovalRes1.data?.token), 'JWT token generated upon final activation');

    // Manager logs in now
    const loginResApproved = await request('POST', '/api/auth/login', {
      identifier: testEmail1,
      password: 'Password@123'
    });

    assert(loginResApproved.status === 200, `Approved manager logs in successfully (HTTP 200). Got: ${loginResApproved.status}`);
    assert(Boolean(loginResApproved.data?.token), 'JWT session token issued in login response');
    assert(loginResApproved.data?.user?.status === 'active', 'User status is active');

    const approvedToken = loginResApproved.data?.token;

    // Call protected dashboard APIs with approved token
    const approvedVendors = await request('GET', '/api/vendors', null, approvedToken);
    assert(approvedVendors.status === 200, `Approved manager calls /api/vendors successfully (HTTP 200). Got: ${approvedVendors.status}`);

    const approvedReports = await request('GET', '/api/reports/dashboard', null, approvedToken);
    assert(approvedReports.status === 200, `Approved manager calls /api/reports/dashboard successfully (HTTP 200). Got: ${approvedReports.status}`);

    const approvedManagers = await request('GET', '/api/managers', null, approvedToken);
    assert(approvedManagers.status === 200, `Approved manager calls /api/managers successfully (HTTP 200). Got: ${approvedManagers.status}`);

    // -------------------------------------------------------------------------
    // SCENARIO 8: Already Approved Managers Log In -> Existing Authorized Access Preserved
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 8] Existing Approved Managers Log In ---');
    // Ensure an existing approved manager fixture exists
    const existingApprovedEmail = 'existing.approved.manager@connect.com';
    let existingApproved = await db.users.findOne({ email: existingApprovedEmail });
    const bcrypt = require('bcryptjs');
    const existingPwHash = await bcrypt.hash('Password@123', 10);
    if (!existingApproved) {
      existingApproved = await db.users.insertOne({
        name: 'Existing Active Manager',
        email: existingApprovedEmail,
        mobile: '9899998888',
        passwordHash: existingPwHash,
        role: 'state_manager',
        level: 1,
        status: 'active',
        isApproved: true,
        adminApprovalStatus: 'approved',
        kycStatus: 'verified',
        stateId: tnState?._id,
        state: 'Tamil Nadu'
      });
      createdTestUserIds.push(existingApproved._id);
    } else {
      await db.users.findByIdAndUpdate(existingApproved._id, {
        status: 'active',
        isApproved: true,
        passwordHash: existingPwHash
      });
    }

    const existingManagerLogin = await request('POST', '/api/auth/login', {
      identifier: existingApprovedEmail,
      password: 'Password@123'
    });

    assert(existingManagerLogin.status === 200, `Existing State Manager logged in successfully (HTTP 200). Got: ${existingManagerLogin.status}`);
    assert(Boolean(existingManagerLogin.data?.token), 'Token issued to existing manager');
    const existingToken = existingManagerLogin.data?.token;

    const existingApiRes = await request('GET', '/api/reports/dashboard', null, existingToken);
    assert(existingApiRes.status === 200, `Existing manager can access /api/reports/dashboard (HTTP 200). Got: ${existingApiRes.status}`);

    // -------------------------------------------------------------------------
    // SCENARIO 9: Independent Testing for State, District, Division, and Pincode Managers
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 9] Independent Testing of All 4 Hierarchy Levels ---');
    const levels = [
      {
        role: 'state_manager',
        label: 'State Manager',
        payload: { stateId: tnState?._id },
        expectedSubAdminRole: 'State Admin'
      },
      {
        role: 'district_manager',
        label: 'District Manager',
        payload: { stateId: tnState?._id, districtId: dharmapuriDist?._id },
        expectedSubAdminRole: 'Admin'
      },
      {
        role: 'division_manager',
        label: 'Division Manager',
        payload: { stateId: tnState?._id, districtId: salemDist?._id, divisionId: thalaivasalDiv?._id },
        expectedSubAdminRole: 'Division Admin'
      },
      {
        role: 'pincode_manager',
        label: 'Pincode Manager',
        payload: { stateId: tnState?._id, districtId: krishnagiriDist?._id, divisionId: hosurDiv?._id, pincodeId: hosurPin?._id },
        expectedSubAdminRole: 'Pincode Admin'
      }
    ];

    for (const lvl of levels) {
      const ts = Date.now() + Math.floor(Math.random() * 1000);
      const email = `mgr.${lvl.role}_${ts}@example.com`;
      const mobile = `9810${String(ts).slice(-6)}`;

      const reg = await request('POST', '/api/auth/register', {
        name: `Tester ${lvl.label.replace(' ', '')}`,
        email,
        mobile,
        password: 'Password@123',
        role: lvl.role,
        documents: validDocs,
        bankDetails: validBank,
        declarationAccepted: true,
        ...lvl.payload
      });

      assert(reg.status === 201, `${lvl.label} registration returned 201. Status: ${reg.data?.status}`);
      assert(reg.data?.status === 'PENDING_SUB_ADMIN_APPROVAL', `${lvl.label} initial status is PENDING_SUB_ADMIN_APPROVAL`);

      const uid = reg.data?.user?.id;
      if (uid) createdTestUserIds.push(uid);

      // Pending login check
      const lPending = await request('POST', '/api/auth/login', { identifier: email, password: 'Password@123' });
      assert(lPending.status === 403, `${lvl.label} login blocked while pending (HTTP 403). Code: ${lPending.data?.code}`);

      // Sub-admin approve
      const subApp = await request('POST', '/api/auth/subadmin-approval', { userId: uid, action: 'approve' });
      assert(subApp.status === 200 && subApp.data?.status === 'PENDING_KYC_APPROVAL', `${lvl.label} Sub-admin approved -> PENDING_KYC_APPROVAL`);

      // KYC approve
      const kycApp = await request('POST', '/api/auth/kyc-approval', { userId: uid, action: 'approve' });
      assert(kycApp.status === 200 && kycApp.data?.status === 'active', `${lvl.label} KYC approved -> active`);

      // Approved login
      const lApproved = await request('POST', '/api/auth/login', { identifier: email, password: 'Password@123' });
      assert(lApproved.status === 200, `${lvl.label} final login successful (HTTP 200)`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 10: Stale/Forged Token with status: 'active' Rejected by Live DB Check
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 10] Stale/Forged Token with status: "active" Cannot Bypass Live DB Check ---');
    const tsStale = Date.now();
    const emailStale = `stale.user_${tsStale}@example.com`;
    const mobileStale = '9' + Math.floor(100000000 + Math.random() * 900000000);

    const regStale = await request('POST', '/api/auth/register', {
      name: 'Stale Token Tester',
      email: emailStale,
      mobile: mobileStale,
      password: 'Password@123',
      role: 'district_manager',
      stateId: 'state_ka',
      districtId: 'dist_bengaluru_urban',
      documents: validDocs,
      bankDetails: validBank,
      declarationAccepted: true
    });
    assert(regStale.status === 201, `Stale test user registered successfully (HTTP 201). Got: ${regStale.status}`);
    const staleUserId = regStale.data?.user?.id;
    if (staleUserId) createdTestUserIds.push(staleUserId);

    // Create a forged/stale token that fraudulently claims { status: 'active' }
    const forgedToken = jwt.sign(
      {
        id: staleUserId,
        role: 'district_manager',
        status: 'active' // Forged claim! Live DB is PENDING_SUB_ADMIN_APPROVAL
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Call protected API using forged token
    const bypassAttemptRes = await request('GET', '/api/vendors', null, forgedToken);
    assert(
      bypassAttemptRes.status === 403,
      `Forged/stale token claiming status: 'active' rejected with HTTP 403 Forbidden! (Got: ${bypassAttemptRes.status})`
    );
    assert(
      bypassAttemptRes.data?.code === 'APPROVAL_REQUIRED',
      `Live DB validation enforced APPROVAL_REQUIRED on protected API (Got: ${bypassAttemptRes.data?.code})`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 11: Direct URL / Page Refresh (/api/auth/me) Validates Live DB Status
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 11] Direct URL / Page Refresh (/api/auth/me) Enforces Approval Status ---');
    // Call /api/auth/me with forged token for pending user
    const meRes = await request('GET', '/api/auth/me', null, forgedToken);
    assert(
      meRes.status === 200,
      `GET /api/auth/me returns profile for status evaluation (HTTP 200)`
    );
    assert(
      meRes.data?.user?.status === 'PENDING_SUB_ADMIN_APPROVAL',
      `GET /api/auth/me returns real live DB status PENDING_SUB_ADMIN_APPROVAL (Got: ${meRes.data?.user?.status})`
    );
    assert(
      meRes.data?.user?.adminApprovalStatus === 'pending',
      `adminApprovalStatus is pending in live profile`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 12: Territory-Based Sub-admin Routing & Unassigned Fallback
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 12] Territory-Based Sub-admin Routing & Unassigned Territory Handling ---');
    // Check that notifications were placed in the Sub-admin's queue
    const allNotifs = await db.notifications.find({});
    const regNotifs = allNotifs.filter(n => n.type === 'sub_admin_approval_request');
    assert(
      regNotifs.length > 0,
      `Territory Sub-admin notification queue received registration requests (Found: ${regNotifs.length})`
    );

    // Test unmapped territory (Pondicherry has active state record but no assigned sub-admin)
    const tsUnmapped = Date.now();
    const regUnmapped = await request('POST', '/api/auth/register', {
      name: 'Unmapped Territory Tester',
      email: `unmapped_${tsUnmapped}@example.com`,
      mobile: '9' + Math.floor(100000000 + Math.random() * 900000000),
      password: 'Password@123',
      role: 'state_manager',
      stateId: pondicherryState?._id,
      documents: validDocs,
      bankDetails: validBank,
      declarationAccepted: true
    });

    assert(regUnmapped.status === 201, `Unmapped manager registration returned 201. Status: ${regUnmapped.status}`);
    assert(
      regUnmapped.data?.status === 'PENDING_SUB_ADMIN_APPROVAL',
      `Unmapped manager remains PENDING_SUB_ADMIN_APPROVAL (Never auto-approved!)`
    );
    assert(
      regUnmapped.data?.user?.subAdminRoutingStatus === 'UNASSIGNED_ROUTING_PENDING',
      `subAdminRoutingStatus set to UNASSIGNED_ROUTING_PENDING (Got: ${regUnmapped.data?.user?.subAdminRoutingStatus})`
    );
    const unmappedUserId = regUnmapped.data?.user?.id;
    if (unmappedUserId) createdTestUserIds.push(unmappedUserId);

    // Prerequisite Enforcement Test: Attempt KYC approval before Sub-admin approval
    console.log('\n--- [PREREQUISITE ENFORCEMENT] KYC Approval Before Sub-admin Approval Blocked ---');
    const prematureKycRes = await request('POST', '/api/auth/kyc-approval', {
      userId: unmappedUserId,
      action: 'approve'
    });

    assert(
      prematureKycRes.status === 400,
      `Premature KYC approval before Sub-admin approval rejected with HTTP 400 Bad Request! (Got: ${prematureKycRes.status})`
    );
    assert(
      Boolean(prematureKycRes.data?.message && prematureKycRes.data?.message.includes('Pre-requisite violation')),
      `Prerequisite violation message returned: "${prematureKycRes.data?.message}"`
    );

  } finally {
    // Clean up created test accounts so the database remains pristine
    console.log(`\n🧹 Cleaning up ${createdTestUserIds.length} temporary test records...`);
    for (const uid of createdTestUserIds) {
      try {
        await db.users.deleteOne({ _id: uid });
        await db.managers.deleteOne({ _id: uid });
      } catch (e) {}
    }
    server.close();
  }

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
