const assert = require('assert');
const { sendVendorPhoneOtp, verifyVendorPhoneOtp, vendorPhoneOtpStore } = require('../src/controllers/vendorController');

// Mock req and res helper
function createMockReqRes(body = {}) {
  const req = { body };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log('--- Starting Dummy OTP Backend Tests ---');

  // Test 1: Invalid phone number rejection (less than 10 digits or not starting with 6-9)
  {
    const { req, res, getStatus, getData } = createMockReqRes({ phone: '1234567890' });
    await sendVendorPhoneOtp(req, res);
    assert.strictEqual(getStatus(), 400, 'Should reject phone starting with 1');
    assert.strictEqual(getData().success, false);
    console.log('✓ Scenario 1: Rejects invalid mobile number starting with 1');
  }

  {
    const { req, res, getStatus, getData } = createMockReqRes({ phone: '98765' });
    await sendVendorPhoneOtp(req, res);
    assert.strictEqual(getStatus(), 400, 'Should reject phone with fewer than 10 digits');
    assert.strictEqual(getData().success, false);
    console.log('✓ Scenario 2: Rejects phone with fewer than 10 digits');
  }

  // Test 2: Valid mobile number generates a 6-digit OTP
  const testPhone = '9876543210';
  let firstOtp = null;
  {
    const { req, res, getStatus, getData } = createMockReqRes({ phone: testPhone });
    await sendVendorPhoneOtp(req, res);
    assert.strictEqual(getStatus(), 200, 'Should accept valid 10-digit mobile number');
    assert.strictEqual(getData().success, true);
    assert.strictEqual(typeof getData().otp, 'string');
    assert.strictEqual(getData().otp.length, 6, 'OTP must be exactly 6 digits');
    assert.match(getData().otp, /^\d{6}$/, 'OTP must be 6 numeric digits');
    firstOtp = getData().otp;
    console.log(`✓ Scenario 3: Valid mobile number generated 6-digit OTP: ${firstOtp}`);
  }

  // Test 3: Resend before cooldown expires returns 429 cooldown
  {
    const { req, res, getStatus, getData } = createMockReqRes({ phone: testPhone });
    await sendVendorPhoneOtp(req, res);
    assert.strictEqual(getStatus(), 429, 'Should return 429 cooldown');
    assert.strictEqual(getData().cooldown, true);
    console.log('✓ Scenario 4: Rate limit / cooldown prevents rapid resend spam');
  }

  // Test 4: Resend after cooldown produces a DIFFERENT OTP
  {
    // Simulate cooldown elapsed
    const record = vendorPhoneOtpStore.get(testPhone);
    record.createdAt = Date.now() - 35000; // 35 seconds ago

    const { req, res, getStatus, getData } = createMockReqRes({ phone: testPhone });
    await sendVendorPhoneOtp(req, res);
    assert.strictEqual(getStatus(), 200);
    const secondOtp = getData().otp;
    assert.notStrictEqual(secondOtp, firstOtp, 'Resent OTP must be different from previous OTP');
    assert.strictEqual(secondOtp.length, 6);
    console.log(`✓ Scenario 5: Resend OTP generated different 6-digit OTP: ${secondOtp} (prev: ${firstOtp})`);
  }

  // Test 5: Incorrect OTP verification rejection
  {
    const { req, res, getStatus, getData } = createMockReqRes({ phone: testPhone, otp: '000000' });
    await verifyVendorPhoneOtp(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
    assert.match(getData().message, /Incorrect OTP/i);
    console.log('✓ Scenario 6: Incorrect OTP rejected with remaining attempts message');
  }

  // Test 6: Expired OTP rejection
  {
    const record = vendorPhoneOtpStore.get(testPhone);
    record.expiresAt = Date.now() - 1000; // Expired 1 second ago

    const { req, res, getStatus, getData } = createMockReqRes({ phone: testPhone, otp: record.otp });
    await verifyVendorPhoneOtp(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
    assert.match(getData().message, /expired/i);
    console.log('✓ Scenario 7: Expired OTP rejected');
  }

  // Test 7: New OTP generation and successful verification
  {
    const freshPhone = '8765432109';
    const { req: sReq, res: sRes, getData: sData } = createMockReqRes({ phone: freshPhone });
    await sendVendorPhoneOtp(sReq, sRes);
    const validOtp = sData().otp;

    const { req: vReq, res: vRes, getStatus: vStatus, getData: vData } = createMockReqRes({ phone: freshPhone, otp: validOtp });
    await verifyVendorPhoneOtp(vReq, vRes);
    assert.strictEqual(vStatus(), 200);
    assert.strictEqual(vData().success, true);
    assert.strictEqual(vData().verified, true);
    console.log('✓ Scenario 8: Correct unexpired OTP verified successfully');
  }

  console.log('--- All Dummy OTP Backend Tests Passed Successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
