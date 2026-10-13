const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const db = require('../src/config/db');
const vendorController = require('../src/controllers/vendorController');
const uploadRoutes = require('../src/routes/uploadRoutes');
const notificationRoutes = require('../src/routes/notificationRoutes');

async function runTests() {
  console.log('🧪 Starting Vendor & Notifications Bug Fix Tests...\n');

  // Test 1: Upload Routes Delete Endpoint
  console.log('--- TEST 1: Secure File Deletion & Traversal Defense ---');
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const dummyFileName = `dummy_test_${Date.now()}.pdf`;
  const dummyFilePath = path.join(uploadsDir, dummyFileName);
  fs.writeFileSync(dummyFilePath, 'dummy file content');
  assert(fs.existsSync(dummyFilePath), 'Dummy file created');

  const app = express();
  app.use(express.json());
  app.use('/api/uploads', uploadRoutes);

  const server = app.listen(0);
  const port = server.address().port;

  // 1a. Attempt path traversal
  const traversalRes = await fetch(`http://127.0.0.1:${port}/api/uploads/file`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: '../../package.json' })
  });
  const traversalData = await traversalRes.json();
  console.log('  Traversal defense status:', traversalRes.status, traversalData.message);
  assert(traversalRes.status === 404 || traversalRes.status === 400 || !traversalData.success, 'Traversal blocked');
  assert(fs.existsSync(path.join(__dirname, '../../package.json')), 'package.json intact');

  // 1b. Delete valid dummy file
  const deleteRes = await fetch(`http://127.0.0.1:${port}/api/uploads/file`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `/uploads/${dummyFileName}` })
  });
  const deleteData = await deleteRes.json();
  console.log('  Valid file deletion status:', deleteRes.status, deleteData.message);
  assert(deleteRes.status === 200 && deleteData.success, 'Valid file deletion succeeded');
  assert(!fs.existsSync(dummyFilePath), 'File was physically removed');

  // 1c. Permanent document deletion protection for approved vendors
  const approvedDocName = `approved_vendor_doc_${Date.now()}.pdf`;
  const approvedDocPath = path.join(uploadsDir, approvedDocName);
  fs.writeFileSync(approvedDocPath, 'important approved kyc document');

  // Insert mock approved vendor with this document
  const testVendorId = `test_v_${Date.now()}`;
  await db.vendors.insertOne({
    _id: testVendorId,
    id: testVendorId,
    name: 'Approved Merchant',
    status: 'Approved',
    documents: [{ url: `/uploads/${approvedDocName}`, name: approvedDocName }]
  });

  const protectedRes = await fetch(`http://127.0.0.1:${port}/api/uploads/file`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `/uploads/${approvedDocName}` })
  });
  const protectedData = await protectedRes.json();
  console.log('  Approved vendor protection status:', protectedRes.status, protectedData.message);
  assert(protectedRes.status === 403, 'Approved vendor file deletion prevented with HTTP 403');
  assert(fs.existsSync(approvedDocPath), 'Protected document file remains intact');

  // Cleanup approved doc and vendor
  if (fs.existsSync(approvedDocPath)) fs.unlinkSync(approvedDocPath);
  await db.vendors.deleteOne({ _id: testVendorId }).catch(() => {});

  server.close();
  console.log('✅ TEST 1 PASSED: File deletion secure and protected.\n');

  // Test 2: Assigned Field Manager Resolution
  console.log('--- TEST 2: Vendor Assigned Field Manager Population ---');
  // Create mock manager in db.users
  const mgrId = `mgr_test_${Date.now()}`;
  await db.users.insertOne({
    _id: mgrId,
    id: mgrId,
    name: 'Superman Pincode Admin',
    role: 'pincode_manager',
    mobile: '9876543210',
    email: 'superman@connect.org'
  });

  const vendorId2 = `vendor_test_${Date.now()}`;
  await db.vendors.insertOne({
    _id: vendorId2,
    id: vendorId2,
    businessName: 'Superman Grocery Store',
    name: 'Kumar Owner',
    assignedManagerId: mgrId,
    status: 'Pending'
  });

  const req = {
    targetVendor: await db.vendors.findById(vendorId2),
    query: {}
  };
  let sentData = null;
  const res = {
    json: (d) => { sentData = d; }
  };

  await vendorController.getVendorById(req, res);
  assert(sentData && sentData.success, 'Vendor details returned successfully');
  console.log('  Populated assignedFieldManager:', sentData.data.assignedFieldManager);
  assert(sentData.data.assignedFieldManager, 'assignedFieldManager populated');
  assert.strictEqual(sentData.data.assignedFieldManager.name, 'Superman Pincode Admin', 'Correct manager name retrieved');
  assert.strictEqual(sentData.data.assignedFieldManager.designation, 'Pincode Manager', 'Designation correctly formatted as Pincode Manager (not hardcoded Field Supervisor)');

  // Cleanup
  await db.users.deleteOne({ _id: mgrId }).catch(() => {});
  await db.vendors.deleteOne({ _id: vendorId2 }).catch(() => {});

  console.log('✅ TEST 2 PASSED: Assigned field manager correctly resolved without hardcoded fallbacks.\n');

  console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
  setTimeout(() => {
    process.exit(0);
  }, 100);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
