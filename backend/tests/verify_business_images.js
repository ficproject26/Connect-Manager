const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/config/db');
const vendorController = require('../src/controllers/vendorController');

async function runBusinessImagesTests() {
  console.log('🧪 Starting Verification of Vendor Onboarding Business Images Flow...\n');

  const managerUser = await db.users.findOne({ role: { $in: ['state_manager', 'district_manager', 'division_manager'] } }) || {
    id: 'test_mgr_101',
    _id: 'test_mgr_101',
    name: 'Test Field Manager',
    role: 'district_manager'
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Save Multiple Business Images During Vendor Onboarding
  // ─────────────────────────────────────────────────────────────
  console.log('--- Test 1: Save Multiple Business Images During Vendor Onboarding ---');

  const testPhone1 = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  // Verify OTP for this phone in the controller's store
  vendorController.vendorPhoneOtpStore.set(testPhone1, {
    otp: '123456',
    verified: true,
    verifiedAt: Date.now()
  });

  const businessImagesData = [
    {
      url: '/uploads/1792000001_storefront_front.jpg',
      name: 'storefront_front.jpg',
      filename: '1792000001_storefront_front.jpg',
      size: 154200,
      type: 'image/jpeg'
    },
    {
      url: '/uploads/1792000002_interior_aisle.jpg',
      name: 'interior_aisle.jpg',
      filename: '1792000002_interior_aisle.jpg',
      size: 210800,
      type: 'image/jpeg'
    },
    {
      url: '/uploads/1792000003_billing_counter.jpg',
      name: 'billing_counter.jpg',
      filename: '1792000003_billing_counter.jpg',
      size: 98400,
      type: 'image/jpeg'
    }
  ];

  let createRes1 = null;
  const mockReq1 = {
    user: managerUser,
    body: {
      name: 'Karthik Raja',
      mobile: testPhone1,
      businessName: 'Raja Supermart & Spices',
      category: 'Food',
      description: 'Groceries, fresh vegetables, daily household supplies',
      address: '14 Gandhi Road, Salem - 636001',
      businessImages: businessImagesData,
      logo: '/uploads/1792000000_raja_logo.jpg',
      businessLicense: {
        url: '/uploads/1792000000_fssai_license.pdf',
        name: 'fssai_license.pdf',
        type: 'application/pdf'
      }
    }
  };
  const mockRes1 = {
    status: (code) => mockRes1,
    json: (d) => { createRes1 = d; return mockRes1; }
  };

  await vendorController.createVendor(mockReq1, mockRes1);
  assert(createRes1 && createRes1.success, 'Vendor creation must succeed');
  const createdVendor1 = createRes1.data;
  assert(createdVendor1, 'Created vendor data must be returned');
  assert.strictEqual(createdVendor1.businessImages.length, 3, 'Must save all 3 business images');
  assert.strictEqual(createdVendor1.businessImages[0].url, businessImagesData[0].url, 'Image 1 URL matches');
  assert.strictEqual(createdVendor1.businessImages[1].url, businessImagesData[1].url, 'Image 2 URL matches');
  assert.strictEqual(createdVendor1.businessImages[2].url, businessImagesData[2].url, 'Image 3 URL matches');
  assert.strictEqual(createdVendor1.storefrontPhoto, businessImagesData[0].url, 'Primary storefrontPhoto defaulted to first business image');
  console.log('✅ Test 1 Passed: Vendor created with 3 business images properly structured and persisted.');

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Retrieve Vendor Details & Verify Persistence
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Retrieve Vendor Details & Verify Persistence ---');

  let getRes1 = null;
  const mockGetReq1 = {
    user: managerUser,
    params: { id: String(createdVendor1._id || createdVendor1.id) },
    targetVendor: await db.vendors.findById(createdVendor1._id || createdVendor1.id),
    query: {}
  };
  const mockGetRes1 = {
    status: (code) => mockGetRes1,
    json: (d) => { getRes1 = d; return mockGetRes1; }
  };

  await vendorController.getVendorById(mockGetReq1, mockGetRes1);
  assert(getRes1 && getRes1.success, 'getVendorById must succeed');
  assert(getRes1.data, 'Vendor detail data must be returned');
  assert.strictEqual(getRes1.data.businessImages.length, 3, 'Retrieved vendor must retain all 3 business images');
  assert.strictEqual(getRes1.data.businessImages[0].name, 'storefront_front.jpg', 'Retains image 1 name');
  assert.strictEqual(getRes1.data.businessImages[2].filename, '1792000003_billing_counter.jpg', 'Retains image 3 filename');
  console.log('✅ Test 2 Passed: Vendor Details API returns all 3 saved business images with full metadata.');

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Vendor with 0 Business Images (Empty State)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Vendor with 0 Business Images (Empty State) ---');

  const testPhone2 = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
  vendorController.vendorPhoneOtpStore.set(testPhone2, {
    otp: '123456',
    verified: true,
    verifiedAt: Date.now()
  });

  let createRes2 = null;
  const mockReq2 = {
    user: managerUser,
    body: {
      name: 'Priya Sharma',
      mobile: testPhone2,
      businessName: 'Priya Beauty Studio',
      category: 'Services',
      address: '22 Cherry Road, Salem',
      businessImages: []
    }
  };
  const mockRes2 = {
    status: (code) => mockRes2,
    json: (d) => { createRes2 = d; return mockRes2; }
  };

  await vendorController.createVendor(mockReq2, mockRes2);
  assert(createRes2 && createRes2.success, 'Creation without images must succeed');
  const createdVendor2 = createRes2.data;
  assert.strictEqual(createdVendor2.businessImages.length, 0, 'businessImages array is empty');

  let getRes2 = null;
  const mockGetReq2 = {
    user: managerUser,
    params: { id: String(createdVendor2._id || createdVendor2.id) },
    targetVendor: await db.vendors.findById(createdVendor2._id || createdVendor2.id),
    query: {}
  };
  const mockGetRes2 = {
    status: (code) => mockGetRes2,
    json: (d) => { getRes2 = d; return mockGetRes2; }
  };
  await vendorController.getVendorById(mockGetReq2, mockGetRes2);
  assert(getRes2 && getRes2.success);
  assert.strictEqual(getRes2.data.businessImages.length, 0, 'Vendor 2 has 0 business images (ready for empty state)');
  console.log('✅ Test 3 Passed: 0-image vendor cleanly stored and returned as empty array.');

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Vendor Image Scoping & Isolation
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Vendor Image Scoping & Isolation ---');

  // Verify Vendor 1 still has 3 images and Vendor 2 still has 0 images
  const freshV1 = await db.vendors.findById(createdVendor1._id || createdVendor1.id);
  const freshV2 = await db.vendors.findById(createdVendor2._id || createdVendor2.id);

  assert.strictEqual(freshV1.businessImages.length, 3, 'Vendor 1 has 3 images');
  assert.strictEqual(freshV2.businessImages.length, 0, 'Vendor 2 has 0 images');
  assert(!freshV2.businessImages.some(i => i.url === businessImagesData[0].url), 'Vendor 2 does NOT share Vendor 1 images');
  console.log('✅ Test 4 Passed: Images are strictly scoped to their respective vendors without cross-contamination.');

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Normalization of Corrupted / Empty Legacy Objects
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 5: Normalization of Corrupted Legacy Objects ---');

  const testPhone3 = `96${Math.floor(10000000 + Math.random() * 90000000)}`;
  vendorController.vendorPhoneOtpStore.set(testPhone3, {
    otp: '123456',
    verified: true,
    verifiedAt: Date.now()
  });

  let createRes3 = null;
  const mockReq3 = {
    user: managerUser,
    body: {
      name: 'Legacy Clean Test',
      mobile: testPhone3,
      businessName: 'Legacy Test Enterprise',
      category: 'Daily Needs',
      address: '77 Old Market Road',
      // Simulating a mix of empty objects (from previous un-uploaded bug) and valid image
      businessImages: [
        {},
        null,
        '/uploads/1792000010_valid_photo.jpg',
        { url: '' }
      ]
    }
  };
  const mockRes3 = {
    status: (code) => mockRes3,
    json: (d) => { createRes3 = d; return mockRes3; }
  };
  await vendorController.createVendor(mockReq3, mockRes3);
  assert(createRes3 && createRes3.success);
  assert.strictEqual(createRes3.data.businessImages.length, 1, 'Sanitizes empty objects and keeps only valid image');
  assert.strictEqual(createRes3.data.businessImages[0].url, '/uploads/1792000010_valid_photo.jpg');
  console.log('✅ Test 5 Passed: Empty/corrupted legacy image objects are safely filtered out.');

  // ─────────────────────────────────────────────────────────────
  // CLEANUP TEST RECORDS
  // ─────────────────────────────────────────────────────────────
  await db.vendors.deleteOne({ _id: createdVendor1._id || createdVendor1.id });
  await db.vendors.deleteOne({ _id: createdVendor2._id || createdVendor2.id });
  await db.vendors.deleteOne({ _id: createRes3.data._id || createRes3.data.id });
  console.log('\n🧹 Cleaned up temporary test vendors.');

  console.log('\n🎉 ALL BUSINESS IMAGES VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runBusinessImagesTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  });
