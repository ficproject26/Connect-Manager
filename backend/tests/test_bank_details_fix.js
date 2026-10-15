const http = require('http');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const handler = require('../../api/auth/bank-details');

const JWT_SECRET = 'agent_manager_secret_key_2026';
const MONGODB_URI = 'mongodb+srv://Connect-app:Connect123@cluster0.fzj1k5l.mongodb.net/test?retryWrites=true&w=majority';

// Helper to simulate Vercel serverless request
function invokeHandler(method, headers, body) {
  return new Promise((resolve) => {
    const req = {
      method,
      headers: headers || {},
      body: body || {}
    };

    let statusCode = 200;
    let responseHeaders = {};
    let responseBody = null;

    const res = {
      setHeader(k, v) {
        responseHeaders[k] = v;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      end() {
        resolve({ status: statusCode, headers: responseHeaders, body: responseBody });
      },
      json(data) {
        responseBody = data;
        resolve({ status: statusCode, headers: responseHeaders, body: responseBody });
      }
    };

    handler(req, res).catch(err => {
      resolve({ status: 500, headers: responseHeaders, body: { success: false, message: err.message } });
    });
  });
}

async function runTests() {
  console.log('--- STARTING BANK DETAILS API TEST SUITE ---');

  // Connect to DB to check records
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Test Manager ID for Superman
  const testManagerId = '599bef8d-4392-43bd-b015-ac5371e15842';
  const testEmail = 'superman@gmail.com';

  const validToken = jwt.sign(
    { id: testManagerId, email: testEmail, role: 'pincode_manager', status: 'active' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Test 1: Unauthorized request (no token) -> 401
  console.log('\n[TEST 1] Unauthorized request without Authorization header...');
  const res1 = await invokeHandler('GET', {});
  console.log('Result:', res1.status, res1.body?.message);
  if (res1.status !== 401) throw new Error('Expected 401 for unauthorized request');

  // Test 2: Validation failure - missing required fields -> 400
  console.log('\n[TEST 2] Missing required fields (no Bank Name)...');
  const res2 = await invokeHandler('PUT', { Authorization: 'Bearer ' + validToken }, {
    accountHolderName: 'Superman',
    bankName: '',
    branchName: 'Madurai',
    city: 'Madurai',
    accountNumber: '123456789012',
    ifscCode: 'SBIN0001234'
  });
  console.log('Result:', res2.status, res2.body?.message);
  if (res2.status !== 400) throw new Error('Expected 400 for missing bank name');

  // Test 3: Validation failure - invalid Account Number (< 9 digits) -> 400
  console.log('\n[TEST 3] Invalid Account Number (too short)...');
  const res3 = await invokeHandler('PUT', { Authorization: 'Bearer ' + validToken }, {
    accountHolderName: 'Superman',
    bankName: 'State Bank of India',
    branchName: 'Madurai Main',
    city: 'Madurai',
    accountNumber: '12345',
    ifscCode: 'SBIN0001234'
  });
  console.log('Result:', res3.status, res3.body?.message);
  if (res3.status !== 400) throw new Error('Expected 400 for short account number');

  // Test 4: Validation failure - invalid IFSC code -> 400
  console.log('\n[TEST 4] Invalid IFSC Code...');
  const res4 = await invokeHandler('PUT', { Authorization: 'Bearer ' + validToken }, {
    accountHolderName: 'Superman',
    bankName: 'State Bank of India',
    branchName: 'Madurai Main',
    city: 'Madurai',
    accountNumber: '987654321098',
    ifscCode: 'INVALID_IFSC'
  });
  console.log('Result:', res4.status, res4.body?.message);
  if (res4.status !== 400) throw new Error('Expected 400 for invalid IFSC code');

  // Test 5: Successful Save (PUT) with optional address field
  console.log('\n[TEST 5] Successful Save Bank Details (PUT)...');
  const testBankData = {
    accountHolderName: 'Superman',
    bankName: 'HDFC Bank',
    branchName: 'Madurai Bypass',
    city: 'Madurai',
    street: 'Plot 45, North Bypass Road',
    accountNumber: '50100456789012',
    ifscCode: 'HDFC0001234'
  };

  const res5 = await invokeHandler('PUT', { Authorization: 'Bearer ' + validToken }, testBankData);
  console.log('Result:', res5.status, res5.body);
  if (res5.status !== 200 || !res5.body?.success) {
    throw new Error('Expected 200 success for valid bank details submission');
  }

  // Test 6: Verify in MongoDB Atlas directly
  console.log('\n[TEST 6] Verify persistence in MongoDB Atlas users & managers...');
  const savedUser = await db.collection('users').findOne({ email: testEmail });
  console.log('Persisted bankDetails in Atlas:', JSON.stringify(savedUser.bankDetails, null, 2));
  if (savedUser.bankDetails?.accountNumber !== '50100456789012' || savedUser.bankDetails?.bankName !== 'HDFC Bank') {
    throw new Error('Database record does not match submitted bank details!');
  }

  // Test 7: Verify Audit Log created with MASKED account number
  console.log('\n[TEST 7] Verify Audit Log created with masked account number...');
  const latestAudit = await db.collection('auditLogs')
    .find({ action: 'BANK_DETAILS_UPDATED', userId: testManagerId })
    .sort({ _id: -1 })
    .limit(1)
    .toArray();

  if (!latestAudit || latestAudit.length === 0) {
    throw new Error('Audit log was not created!');
  }
  console.log('Audit log details:', latestAudit[0].details);
  if (!latestAudit[0].details.includes('Account ending in 9012')) {
    throw new Error('Audit log does not properly mask account number!');
  }
  if (latestAudit[0].details.includes('50100456789012')) {
    throw new Error('SECURITY VIOLATION: Full account number exposed in audit log!');
  }

  // Test 8: GET Bank Details endpoint
  console.log('\n[TEST 8] Retrieve Bank Details (GET)...');
  const res8 = await invokeHandler('GET', { Authorization: 'Bearer ' + validToken });
  console.log('Result:', res8.status, res8.body);
  if (res8.status !== 200 || res8.body?.bankDetails?.bankName !== 'HDFC Bank') {
    throw new Error('GET bank-details failed to return persisted data!');
  }

  // Test 9: Preflight OPTIONS request for CORS
  console.log('\n[TEST 9] CORS Preflight OPTIONS check...');
  const res9 = await invokeHandler('OPTIONS', {});
  console.log('OPTIONS status:', res9.status, 'Allow-Methods:', res9.headers['Access-Control-Allow-Methods']);
  if (res9.status !== 200) throw new Error('Expected 200 for OPTIONS preflight');

  console.log('\n=============================================');
  console.log('>>> ALL 9 BANK DETAILS TESTS PASSED! <<<');
  console.log('=============================================\n');

  await client.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
