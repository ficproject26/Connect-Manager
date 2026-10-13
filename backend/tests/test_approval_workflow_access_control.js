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
  console.log('🧪 CONNECT APP - MANAGER MULTI-STAGE APPROVAL & ACCESS CONTROL TEST SUITE');
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
    // SCENARIO 1: Manager Registration -> Initial Status PENDING_SUB_ADMIN_APPROVAL
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
    assert(regRes1.data?.overallRegistrationStatus === 'PENDING_SUB_ADMIN_APPROVAL', `overallRegistrationStatus is PENDING_SUB_ADMIN_APPROVAL`);
    assert(regRes1.data?.subAdminApprovalStatus === 'pending', `subAdminApprovalStatus is pending`);
    assert(regRes1.data?.mainAdminApprovalStatus === 'waiting_subadmin', `mainAdminApprovalStatus is waiting_subadmin`);
    assert(regRes1.data?.kycVerificationStatus === 'not_started', `kycVerificationStatus is not_started`);
    assert(regRes1.data?.isApproved === false, 'isApproved is explicitly false in registration response');
    assert(!regRes1.data?.token, 'No authentication token is granted at registration');

    const manager1Id = regRes1.data?.user?.id;
    if (manager1Id) createdTestUserIds.push(manager1Id);

    // Live status route check (no token needed)
    const statusRes1 = await request('GET', `/api/auth/registration-status/${manager1Id}`);
    assert(statusRes1.status === 200, `Live registration status fetched without token (HTTP 200)`);
    assert(statusRes1.data?.data?.overallRegistrationStatus === 'PENDING_SUB_ADMIN_APPROVAL', `Live status reflects PENDING_SUB_ADMIN_APPROVAL`);
    assert(statusRes1.data?.data?.subAdminApprovalStatus === 'pending', `Live subAdminApprovalStatus is pending`);

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
    // SCENARIO 2: Prerequisite Enforcements Before Sub-admin Approval
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 2] Premature Main Admin and KYC Approvals Blocked ---');
    // Main Admin attempts premature approval before Sub-admin
    const prematureMainRes = await request('POST', '/api/auth/mainadmin-approval', {
      userId: manager1Id,
      action: 'approve'
    });
    assert(prematureMainRes.status === 400, `Premature Main Admin approval rejected with HTTP 400 (Got: ${prematureMainRes.status})`);
    assert(prematureMainRes.data?.code === 'SUBADMIN_APPROVAL_REQUIRED', `Premature Main Admin code is SUBADMIN_APPROVAL_REQUIRED`);

    // KYC attempts premature approval before Sub-admin and Main Admin
    const prematureKycRes = await request('POST', '/api/auth/kyc-approval', {
      userId: manager1Id,
      action: 'approve'
    });
    assert(prematureKycRes.status === 400, `Premature KYC approval rejected with HTTP 400 (Got: ${prematureKycRes.status})`);

    // Simulation routes are permanently blocked / removed (HTTP 404)
    const simApproveRes = await request('POST', '/api/auth/simulate-approval', { userId: manager1Id });
    assert(simApproveRes.status === 404, `simulate-approval route is deleted (HTTP 404). Got: ${simApproveRes.status}`);
    const simKycRes = await request('POST', '/api/auth/simulate-kyc', { userId: manager1Id });
    assert(simKycRes.status === 404, `simulate-kyc route is deleted (HTTP 404). Got: ${simKycRes.status}`);

    // -------------------------------------------------------------------------
    // SCENARIO 3: Sub-admin Approves -> Transitions to PENDING_MAIN_ADMIN_APPROVAL
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 3] Sub-admin Approves -> Transitions to PENDING_MAIN_ADMIN_APPROVAL ---');
    const subAdminApprovalRes = await request('POST', '/api/auth/subadmin-approval', {
      userId: manager1Id,
      action: 'approve'
    });

    assert(subAdminApprovalRes.status === 200, `Sub-admin approval succeeded (HTTP 200). Got: ${subAdminApprovalRes.status}`);
    assert(subAdminApprovalRes.data?.status === 'PENDING_MAIN_ADMIN_APPROVAL', `Status transitioned to PENDING_MAIN_ADMIN_APPROVAL (Got: ${subAdminApprovalRes.data?.status})`);
    assert(subAdminApprovalRes.data?.subAdminApprovalStatus === 'approved', 'subAdminApprovalStatus is approved');
    assert(subAdminApprovalRes.data?.mainAdminApprovalStatus === 'pending', 'mainAdminApprovalStatus is now pending');
    assert(subAdminApprovalRes.data?.isApproved === false, 'isApproved remains false');
    assert(!subAdminApprovalRes.data?.token, 'No session token granted upon Sub-admin approval alone');

    // Live status check shows Main Admin review stage
    const statusRes2 = await request('GET', `/api/auth/registration-status/${manager1Id}`);
    assert(statusRes2.data?.data?.overallRegistrationStatus === 'PENDING_MAIN_ADMIN_APPROVAL', `Live status is PENDING_MAIN_ADMIN_APPROVAL`);
    assert(statusRes2.data?.data?.subAdminApprovalStatus === 'approved', `Live subAdminApprovalStatus is approved`);
    assert(statusRes2.data?.data?.mainAdminApprovalStatus === 'pending', `Live mainAdminApprovalStatus is pending`);

    // Login still strictly blocked
    const loginResStage2 = await request('POST', '/api/auth/login', {
      identifier: testEmail1,
      password: 'Password@123'
    });
    assert(loginResStage2.status === 403, `Login blocked at PENDING_MAIN_ADMIN_APPROVAL stage (HTTP 403). Got: ${loginResStage2.status}`);
    assert(loginResStage2.data?.code === 'APPROVAL_REQUIRED', `Code is APPROVAL_REQUIRED`);

    // KYC approval still premature (Main Admin has not approved yet)
    const prematureKycRes2 = await request('POST', '/api/auth/kyc-approval', {
      userId: manager1Id,
      action: 'approve'
    });
    assert(prematureKycRes2.status === 400, `KYC approval rejected while Main Admin approval is pending (HTTP 400). Got: ${prematureKycRes2.status}`);

    // -------------------------------------------------------------------------
    // SCENARIO 4: Main Admin Approves -> Transitions to PENDING_KYC_VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 4] Main Admin Approves -> Transitions to PENDING_KYC_VERIFICATION ---');
    const mainAdminApprovalRes = await request('POST', '/api/auth/mainadmin-approval', {
      userId: manager1Id,
      action: 'approve'
    });

    assert(mainAdminApprovalRes.status === 200, `Main Admin approval succeeded (HTTP 200). Got: ${mainAdminApprovalRes.status}`);
    assert(mainAdminApprovalRes.data?.status === 'PENDING_KYC_VERIFICATION', `Status transitioned to PENDING_KYC_VERIFICATION (Got: ${mainAdminApprovalRes.data?.status})`);
    assert(mainAdminApprovalRes.data?.mainAdminApprovalStatus === 'approved', 'mainAdminApprovalStatus is approved');
    assert(mainAdminApprovalRes.data?.kycVerificationStatus === 'pending', 'kycVerificationStatus is now pending');
    assert(mainAdminApprovalRes.data?.isApproved === false, 'isApproved remains false');
    assert(!mainAdminApprovalRes.data?.token, 'No session token granted upon Main Admin approval alone');

    // Login still strictly blocked
    const loginResStage3 = await request('POST', '/api/auth/login', {
      identifier: testEmail1,
      password: 'Password@123'
    });
    assert(loginResStage3.status === 403, `Login blocked at PENDING_KYC_VERIFICATION stage (HTTP 403). Got: ${loginResStage3.status}`);

    // -------------------------------------------------------------------------
    // SCENARIO 5: KYC Verification Clearance -> Manager Account Activated!
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 5] KYC Clearance -> Manager Account Activated ---');
    const kycApprovalRes = await request('POST', '/api/auth/kyc-approval', {
      userId: manager1Id,
      action: 'approve'
    });

    assert(kycApprovalRes.status === 200, `KYC clearance succeeded (HTTP 200). Got: ${kycApprovalRes.status}`);
    assert(kycApprovalRes.data?.status === 'active', `Status transitioned to active (Got: ${kycApprovalRes.data?.status})`);
    assert(kycApprovalRes.data?.isApproved === true, 'isApproved is true');
    assert(kycApprovalRes.data?.isActive === true, 'isActive is true');
    assert(kycApprovalRes.data?.kycVerificationStatus === 'approved', 'kycVerificationStatus is approved');

    // Live status reflects fully active
    const statusResActive = await request('GET', `/api/auth/registration-status/${manager1Id}`);
    assert(statusResActive.data?.data?.overallRegistrationStatus === 'active', `Live status reflects active`);
    assert(statusResActive.data?.data?.isActive === true, `Live isActive is true`);

    // Manager can now log in successfully!
    const loginResApproved = await request('POST', '/api/auth/login', {
      identifier: testEmail1,
      password: 'Password@123'
    });

    assert(loginResApproved.status === 200, `Activated manager logs in successfully (HTTP 200). Got: ${loginResApproved.status}`);
    assert(Boolean(loginResApproved.data?.token), 'JWT session token issued in login response');
    assert(loginResApproved.data?.user?.status === 'active', 'User status is active');

    const approvedToken = loginResApproved.data?.token;

    // Call protected dashboard APIs with approved token
    const approvedVendors = await request('GET', '/api/vendors', null, approvedToken);
    assert(approvedVendors.status === 200, `Approved manager calls /api/vendors successfully (HTTP 200). Got: ${approvedVendors.status}`);

    const approvedReports = await request('GET', '/api/reports/dashboard', null, approvedToken);
    assert(approvedReports.status === 200, `Approved manager calls /api/reports/dashboard successfully (HTTP 200). Got: ${approvedReports.status}`);

    // -------------------------------------------------------------------------
    // SCENARIO 6: Sub-admin Rejection -> REJECTED_BY_SUB_ADMIN & Reason Required
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 6] Sub-admin Rejection ---');
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

    // Reject without reason fails
    const noReasonSubReject = await request('POST', '/api/auth/subadmin-approval', {
      userId: manager2Id,
      action: 'reject',
      rejectionReason: ''
    });
    assert(noReasonSubReject.status === 400, `Sub-admin reject without reason rejected (HTTP 400)`);

    // Reject with reason succeeds
    const subAdminRejectRes = await request('POST', '/api/auth/subadmin-approval', {
      userId: manager2Id,
      action: 'reject',
      rejectionReason: 'Jurisdiction quota exceeded for this division.'
    });

    assert(subAdminRejectRes.status === 200, `Sub-admin reject processed (HTTP 200). Got: ${subAdminRejectRes.status}`);
    assert(subAdminRejectRes.data?.status === 'REJECTED_BY_SUB_ADMIN', `Status is REJECTED_BY_SUB_ADMIN (Got: ${subAdminRejectRes.data?.status})`);
    assert(subAdminRejectRes.data?.subAdminApprovalStatus === 'rejected', `subAdminApprovalStatus is rejected`);

    // Login blocked with reason
    const loginRejectSub = await request('POST', '/api/auth/login', {
      identifier: testEmail2,
      password: 'Password@123'
    });
    assert(loginRejectSub.status === 403, `Login blocked for Sub-admin rejected user (HTTP 403)`);
    assert(loginRejectSub.data?.code === 'REGISTRATION_REJECTED', `Code is REGISTRATION_REJECTED`);
    assert(loginRejectSub.data?.rejectionReason?.includes('quota exceeded'), `Rejection reason returned in login error`);

    // -------------------------------------------------------------------------
    // SCENARIO 7: Main Admin Rejection -> REJECTED_BY_MAIN_ADMIN & Reason Required
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 7] Main Admin Rejection ---');
    const testEmail3 = `manager.rejected.main_${regTimestamp}@example.com`;
    const testMobile3 = `98763${String(regTimestamp).slice(-5)}`;

    const regRes3 = await request('POST', '/api/auth/register', {
      name: 'Ramesh Sundaram',
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

    // Sub-admin approves
    await request('POST', '/api/auth/subadmin-approval', { userId: manager3Id, action: 'approve' });

    // Main Admin rejects
    const mainAdminRejectRes = await request('POST', '/api/auth/mainadmin-approval', {
      userId: manager3Id,
      action: 'reject',
      rejectionReason: 'Background check discrepancies noted by executive panel.'
    });

    assert(mainAdminRejectRes.status === 200, `Main Admin reject processed (HTTP 200). Got: ${mainAdminRejectRes.status}`);
    assert(mainAdminRejectRes.data?.status === 'REJECTED_BY_MAIN_ADMIN', `Status is REJECTED_BY_MAIN_ADMIN (Got: ${mainAdminRejectRes.data?.status})`);
    assert(mainAdminRejectRes.data?.mainAdminApprovalStatus === 'rejected', `mainAdminApprovalStatus is rejected`);

    const loginRejectMain = await request('POST', '/api/auth/login', {
      identifier: testEmail3,
      password: 'Password@123'
    });
    assert(loginRejectMain.status === 403, `Login blocked for Main Admin rejected user (HTTP 403)`);
    assert(loginRejectMain.data?.rejectionReason?.includes('discrepancies'), `Main Admin rejection reason returned`);

    // -------------------------------------------------------------------------
    // SCENARIO 8: KYC Rejection -> KYC_REJECTED & Reason Required
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 8] KYC Rejection ---');
    const testEmail4 = `manager.rejected.kyc_${regTimestamp}@example.com`;
    const testMobile4 = `98762${String(regTimestamp).slice(-5)}`;

    const regRes4 = await request('POST', '/api/auth/register', {
      name: 'Anitha Selvam',
      email: testEmail4,
      mobile: testMobile4,
      password: 'Password@123',
      role: 'division_manager',
      stateId: tnState?._id,
      districtId: salemDist?._id,
      divisionId: thalaivasalDiv?._id,
      documents: validDocs,
      bankDetails: validBank,
      declarationAccepted: true
    });
    const manager4Id = regRes4.data?.user?.id;
    if (manager4Id) createdTestUserIds.push(manager4Id);

    // Sub-admin approves
    await request('POST', '/api/auth/subadmin-approval', { userId: manager4Id, action: 'approve' });
    // Main Admin approves
    await request('POST', '/api/auth/mainadmin-approval', { userId: manager4Id, action: 'approve' });

    // KYC rejects
    const kycRejectRes = await request('POST', '/api/auth/kyc-approval', {
      userId: manager4Id,
      action: 'reject',
      rejectionReason: 'Aadhaar document image is blurred and unreadable.'
    });

    assert(kycRejectRes.status === 200, `KYC reject processed (HTTP 200). Got: ${kycRejectRes.status}`);
    assert(kycRejectRes.data?.status === 'KYC_REJECTED', `Status is KYC_REJECTED (Got: ${kycRejectRes.data?.status})`);
    assert(kycRejectRes.data?.kycVerificationStatus === 'rejected', `kycVerificationStatus is rejected`);

    const loginRejectKyc = await request('POST', '/api/auth/login', {
      identifier: testEmail4,
      password: 'Password@123'
    });
    assert(loginRejectKyc.status === 403, `Login blocked for KYC rejected user (HTTP 403)`);
    assert(loginRejectKyc.data?.rejectionReason?.includes('blurred'), `KYC rejection reason returned`);

    // -------------------------------------------------------------------------
    // SCENARIO 9: Full Multi-Stage Workflow for All 4 Manager Levels
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 9] Independent Testing of All 4 Hierarchy Levels Through Full Workflow ---');
    const levels = [
      {
        role: 'state_manager',
        label: 'State Manager',
        payload: { stateId: tnState?._id }
      },
      {
        role: 'district_manager',
        label: 'District Manager',
        payload: { stateId: tnState?._id, districtId: dharmapuriDist?._id }
      },
      {
        role: 'division_manager',
        label: 'Division Manager',
        payload: { stateId: tnState?._id, districtId: salemDist?._id, divisionId: thalaivasalDiv?._id }
      },
      {
        role: 'pincode_manager',
        label: 'Pincode Manager',
        payload: { stateId: tnState?._id, districtId: krishnagiriDist?._id, divisionId: hosurDiv?._id, pincodeId: hosurPin?._id }
      }
    ];

    for (const lvl of levels) {
      const ts = Date.now() + Math.floor(Math.random() * 1000);
      const email = `mgr.full.${lvl.role}_${ts}@example.com`;
      const mobile = `9811${String(ts).slice(-6)}`;

      // 1. Registration
      const reg = await request('POST', '/api/auth/register', {
        name: `MultiStage ${lvl.label.replace(' ', '')}`,
        email,
        mobile,
        password: 'Password@123',
        role: lvl.role,
        documents: validDocs,
        bankDetails: validBank,
        declarationAccepted: true,
        ...lvl.payload
      });

      assert(reg.status === 201 && reg.data?.status === 'PENDING_SUB_ADMIN_APPROVAL', `${lvl.label} registered -> PENDING_SUB_ADMIN_APPROVAL`);
      const uid = reg.data?.user?.id;
      if (uid) createdTestUserIds.push(uid);

      // 2. Sub-admin Approval
      const subRes = await request('POST', '/api/auth/subadmin-approval', { userId: uid, action: 'approve' });
      assert(subRes.status === 200 && subRes.data?.status === 'PENDING_MAIN_ADMIN_APPROVAL', `${lvl.label} Sub-admin approved -> PENDING_MAIN_ADMIN_APPROVAL`);

      // 3. Main Admin Approval
      const mainRes = await request('POST', '/api/auth/mainadmin-approval', { userId: uid, action: 'approve' });
      assert(mainRes.status === 200 && mainRes.data?.status === 'PENDING_KYC_VERIFICATION', `${lvl.label} Main Admin approved -> PENDING_KYC_VERIFICATION`);

      // 4. KYC Clearance
      const kycRes = await request('POST', '/api/auth/kyc-approval', { userId: uid, action: 'approve' });
      assert(kycRes.status === 200 && kycRes.data?.status === 'active', `${lvl.label} KYC approved -> active`);

      // 5. Final Login
      const logRes = await request('POST', '/api/auth/login', { identifier: email, password: 'Password@123' });
      assert(logRes.status === 200 && Boolean(logRes.data?.token), `${lvl.label} login successful with active session`);
    }

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
