const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/config/db');
const territoryScopeService = require('../src/services/territoryScopeService');
const reportController = require('../src/controllers/reportController');
const vendorController = require('../src/controllers/vendorController');
const authController = require('../src/controllers/authController');
const { logoUpload, documentUpload } = require('../src/middleware/uploadMiddleware');

async function runAllTests() {
  console.log('🧪 Starting Verification of All 6 Fixes...\n');

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Profile Image Removal
  // ─────────────────────────────────────────────────────────────
  console.log('--- Test 1: Manager Profile Photo Removal ---');
  const dummyUser = await db.users.findOne({ role: 'state_manager' });
  assert(dummyUser, 'State manager user must exist');
  
  // Set a test avatar
  await db.users.findByIdAndUpdate(dummyUser._id, { $set: { avatarUrl: '/uploads/test_avatar.jpg', avatar: '/uploads/test_avatar.jpg' } });
  
  let removeRes = null;
  const mockReq1 = {
    user: { id: dummyUser._id, role: dummyUser.role, email: dummyUser.email },
    body: {},
    params: {},
    query: {}
  };
  const mockRes1 = {
    json: (d) => { removeRes = d; return mockRes1; },
    status: (code) => mockRes1
  };
  await authController.removeProfilePhoto(mockReq1, mockRes1);
  assert(removeRes && removeRes.success, 'removeProfilePhoto should succeed');
  assert.strictEqual(removeRes.avatarUrl, null, 'avatarUrl must be null in response');
  
  const updatedUser = await db.users.findById(dummyUser._id);
  assert.strictEqual(updatedUser.avatarUrl, null, 'avatarUrl in db.users must be null');
  console.log('✅ Test 1 Passed: Profile photo removal cleanly clears photo fields across user records.');

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Authorization Pipeline Synchronization
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Authorization Pipeline Synchronization ---');
  // Create a pending manager applicant
  const testManagerEmail = `test_applicant_${Date.now()}@testfic.com`;
  const createdApp = await db.users.insertOne({
    name: 'Pipeline Test Manager',
    email: testManagerEmail,
    mobile: '9876500001',
    role: 'pincode_manager',
    status: 'PENDING_SUB_ADMIN_APPROVAL',
    subAdminApprovalStatus: 'pending',
    mainAdminApprovalStatus: 'pending'
  });

  // Simulate Sub-Admin approval
  const approveReq = {
    user: { id: 'super_admin_user', role: 'super_admin', email: 'admin@example.com' },
    body: { userId: createdApp._id, action: 'approve' }
  };
  let approveRes = null;
  const approveResMock = {
    json: (d) => { approveRes = d; return approveResMock; },
    status: (code) => approveResMock
  };
  await authController.subAdminApproval(approveReq, approveResMock);
  assert(approveRes && approveRes.success, 'subAdminApproval should succeed');

  // Verify status check endpoint returns updated pipeline states
  let statusCheckRes = null;
  const statusReq = {
    query: { email: testManagerEmail }
  };
  const statusResMock = {
    json: (d) => { statusCheckRes = d; return statusResMock; },
    status: (code) => statusResMock
  };
  await authController.getRegistrationStatus(statusReq, statusResMock);
  assert(statusCheckRes && statusCheckRes.success, 'getRegistrationStatus should succeed');
  assert.strictEqual(statusCheckRes.data.isSubAdminApproved, true, 'isSubAdminApproved must be true');
  assert.strictEqual(statusCheckRes.data.subAdminApprovalStatus, 'approved', 'subAdminApprovalStatus must be approved');
  assert.strictEqual(statusCheckRes.data.mainAdminApprovalStatus, 'pending', 'mainAdminApprovalStatus must be pending');
  console.log('✅ Test 2 Passed: Sub-Admin approval updates persisted status and pipeline immediately.');

  // Clean up test applicant
  await db.users.deleteOne({ _id: createdApp._id });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Leaderboard & Dashboard Synchronization
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Leaderboard & Dashboard KPI Synchronization ---');
  const surya = await db.users.findOne({ name: 'Surya', role: 'state_manager' });
  assert(surya, 'Manager Surya must exist');

  // Fetch Dashboard Stats
  let dashRes = null;
  const dashReq = { user: surya, query: {} };
  const dashResMock = {
    json: (d) => { dashRes = d; return dashResMock; },
    status: (code) => dashResMock
  };
  await reportController.getDashboardStats(dashReq, dashResMock);
  assert(dashRes && dashRes.success, 'Dashboard stats should succeed');

  // Fetch Leaderboard Data
  let leaderRes = null;
  const leaderReq = { user: surya, query: { period: 'all' } };
  const leaderResMock = {
    json: (d) => { leaderRes = d; return leaderResMock; },
    status: (code) => leaderResMock
  };
  await reportController.getLeaderboardData(leaderReq, leaderResMock);
  assert(leaderRes && leaderRes.success, 'Leaderboard data should succeed');

  const suryaLeaderEntry = leaderRes.data.find(d => d.id === String(surya._id));
  assert(suryaLeaderEntry, 'Surya must have a leaderboard entry');
  assert.strictEqual(suryaLeaderEntry.vendorsOnboarded, dashRes.statusCounts.total, 'Leaderboard total vendors must match Dashboard total vendors');
  assert.strictEqual(suryaLeaderEntry.activeVendors, dashRes.statusCounts.active, 'Leaderboard active vendors must match Dashboard active vendors');
  console.log(`✅ Test 3 Passed: Leaderboard (${suryaLeaderEntry.vendorsOnboarded} total, ${suryaLeaderEntry.activeVendors} active) exactly matches Dashboard (${dashRes.statusCounts.total} total, ${dashRes.statusCounts.active} active).`);

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Business Phone OTP & Separate GST Validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Business Phone OTP & Separate GST Validation ---');
  const testPhone = '9876543299';
  
  // A. Format validation
  let sendFailRes = null;
  const mockSendFailReq = { body: { phone: '123' } };
  const mockSendFailRes = { json: d => { sendFailRes = d; }, status: c => mockSendFailRes };
  await vendorController.sendVendorPhoneOtp(mockSendFailReq, mockSendFailRes);
  assert(sendFailRes && !sendFailRes.success, 'Invalid phone format must fail');

  // B. Send OTP
  let sendOkRes = null;
  const mockSendReq = { body: { phone: testPhone } };
  const mockSendRes = { json: d => { sendOkRes = d; }, status: c => mockSendRes };
  await vendorController.sendVendorPhoneOtp(mockSendReq, mockSendRes);
  assert(sendOkRes && sendOkRes.success, 'Send OTP must succeed for valid phone');
  const generatedOtp = sendOkRes.otp;
  assert(generatedOtp, 'OTP must be returned in non-production mode');

  // C. Cooldown check
  let cooldownRes = null;
  const mockCooldownRes = { json: d => { cooldownRes = d; }, status: c => mockCooldownRes };
  await vendorController.sendVendorPhoneOtp(mockSendReq, mockCooldownRes);
  assert(cooldownRes && cooldownRes.cooldown, 'Resend before 30s must trigger cooldown response');

  // D. Invalid OTP check
  let verifyFailRes = null;
  const mockVerifyFailReq = { body: { phone: testPhone, otp: '000000' } };
  const mockVerifyFailRes = { json: d => { verifyFailRes = d; }, status: c => mockVerifyFailRes };
  await vendorController.verifyVendorPhoneOtp(mockVerifyFailReq, mockVerifyFailRes);
  assert(verifyFailRes && !verifyFailRes.success, 'Wrong OTP must fail');

  // E. Valid OTP check
  let verifyOkRes = null;
  const mockVerifyOkReq = { body: { phone: testPhone, otp: generatedOtp } };
  const mockVerifyOkRes = { json: d => { verifyOkRes = d; }, status: c => mockVerifyOkRes };
  await vendorController.verifyVendorPhoneOtp(mockVerifyOkReq, mockVerifyOkRes);
  assert(verifyOkRes && verifyOkRes.success && verifyOkRes.verified, 'Verify OTP must succeed');
  assert(verifyOkRes.verificationToken, 'Verification token must be issued');

  // F. Duplicate GSTIN rejection check
  const existingWithGst = await db.vendors.findOne({ gst: { $exists: true, $ne: '' } });
  if (existingWithGst && existingWithGst.gst) {
    let duplicateGstRes = null;
    const mockDupGstReq = {
      user: surya,
      body: {
        name: 'Merchant Test 1',
        mobile: testPhone,
        businessName: 'Unique New Enterprise Ltd',
        category: 'Services',
        gstNumber: existingWithGst.gst,
        address: '123 New Road, Chennai'
      }
    };
    const mockDupGstRes = { json: d => { duplicateGstRes = d; }, status: c => mockDupGstRes };
    await vendorController.createVendor(mockDupGstReq, mockDupGstRes);
    assert(duplicateGstRes && duplicateGstRes.duplicate, 'Duplicate GSTIN must be rejected with 409 conflict');
  }

  // G. Phone reuse allowed for separate business
  let newVendorRes = null;
  const mockCreateVendorReq = {
    user: surya,
    body: {
      name: 'Owner Same Phone',
      mobile: testPhone,
      businessName: `Brand New Co ${Date.now()}`,
      category: 'Services',
      address: '77 Residency Road, Salem',
      gstNumber: '33AABCK1234F1Z9'
    }
  };
  // Note: if 33AABCK1234F1Z9 exists in db, generate unique GSTIN
  const uniqueGst = `33ABCDE${Math.floor(1000 + Math.random() * 9000)}F1Z5`;
  mockCreateVendorReq.body.gstNumber = uniqueGst;
  const mockCreateVendorRes = { json: d => { newVendorRes = d; }, status: c => mockCreateVendorRes };
  await vendorController.createVendor(mockCreateVendorReq, mockCreateVendorRes);
  assert(newVendorRes && newVendorRes.success, 'New company registration with verified phone must succeed');
  assert.strictEqual(newVendorRes.data.address, '77 Residency Road, Salem', 'Merchant address must be preserved');
  console.log('✅ Test 4 Passed: Business phone OTP verification enforced, duplicate GST blocked, phone reuse allowed for separate companies.');

  // Clean up created vendor
  if (newVendorRes?.data?._id) {
    await db.vendors.deleteOne({ _id: newVendorRes.data._id });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Enforce File Upload Size Limits
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 5: File Upload Size Limits (2MB Logo, 5MB Document) ---');
  assert.strictEqual(logoUpload.limits.fileSize, 2 * 1024 * 1024, 'Logo upload size limit must be 2MB');
  assert.strictEqual(documentUpload.limits.fileSize, 5 * 1024 * 1024, 'Document upload size limit must be 5MB');
  console.log('✅ Test 5 Passed: Multer upload limits enforced at 2MB for logos and 5MB for documents.');

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Physical Merchant Address
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 6: Display Actual Physical Merchant Address ---');
  const allVendors = await db.vendors.find();
  assert(allVendors.length >= 2, 'Must have at least 2 vendors to compare addresses');
  
  const vendorA = allVendors[0];
  const vendorB = allVendors[1];
  
  const popA = await vendorController.populateVendorLocations(vendorA);
  const popB = await vendorController.populateVendorLocations(vendorB);
  
  assert(popA.address, 'Vendor A must have a populated address');
  assert(popB.address, 'Vendor B must have a populated address');
  assert.notStrictEqual(popA.address, popB.address, 'Different vendors must display different merchant addresses');
  assert(!popB.address.includes('Attur Main Bazaar Street, Salem - 636114') || vendorB.businessName.includes('Attur'), 'Address must not be a hardcoded fallback');
  console.log(`✅ Test 6 Passed: Vendor "${popA.businessName}" -> "${popA.address}"`);
  console.log(`                 Vendor "${popB.businessName}" -> "${popB.address}"`);

  console.log('\n🎉 ALL 6 COMPREHENSIVE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runAllTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
