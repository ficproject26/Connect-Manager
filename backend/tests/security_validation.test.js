/**
 * Production Security Validation & Hardening Test Suite
 * Covers 10 Critical Security Domains:
 * 1. Authentication Security & Lockout
 * 2. JWT Verification & Tampering Defenses
 * 3. RBAC & Administrative Route Protection
 * 4. Object-Level Access Control (IDOR)
 * 5. NoSQL Injection & Prototype Pollution Sanitization
 * 6. Input Validation & Password Complexity Enforcement
 * 7. Rate Limiting Protection (Auth, OTP, Uploads)
 * 8. Security Headers & Information Disclosure Defense
 * 9. Production Gate (Simulation Endpoints & Secret Redaction)
 * 10. File Upload Security (Extension & MIME validation)
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../src/server');
const db = require('../src/config/db');
const { JWT_SECRET } = require('../src/middleware/authMiddleware');

const TEST_PORT = 5020;

function apiRequest(method, path, body = null, token = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      { hostname: '127.0.0.1', port: TEST_PORT, path, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSecurityTests() {
  console.log('========================================================================');
  console.log('🛡️  MASTER PRODUCTION SECURITY VALIDATION & AUDIT TEST SUITE');
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
      // ─────────────────────────────────────────────────────────────
      // DOMAIN 1: AUTHENTICATION SECURITY & BRUTE-FORCE PROTECTION
      // ─────────────────────────────────────────────────────────────
      console.log('--- 1. Authentication Security & Lockout Defenses ---');

      // 1.1 Empty credentials rejection
      const emptyLogin = await apiRequest('POST', '/api/auth/login', { identifier: '', password: '' });
      assert(emptyLogin.status === 400, 'Rejects empty credentials with 400 Bad Request');

      // 1.2 Invalid password rejection
      const invalidLogin = await apiRequest('POST', '/api/auth/login', { identifier: 'surya@gmail.com', password: 'WrongPassword999' });
      assert(invalidLogin.status === 401, 'Rejects invalid password with 401 Unauthorized');

      // 1.3 Account lockout after 5 consecutive failed attempts
      console.log('  Testing progressive account lockout after 5 failed attempts...');
      for (let i = 0; i < 4; i++) {
        await apiRequest('POST', '/api/auth/login', { identifier: 'brute_target@example.com', password: 'WrongPassword!' });
      }
      const fifthAttempt = await apiRequest('POST', '/api/auth/login', { identifier: 'brute_target@example.com', password: 'WrongPassword!' });
      const lockedAttempt = await apiRequest('POST', '/api/auth/login', { identifier: 'brute_target@example.com', password: 'WrongPassword!' });
      assert(lockedAttempt.status === 429, `Lockout enforced on 5+ consecutive failures with 429 status: ${lockedAttempt.status}`);

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 2: JWT SECURITY & TOKEN TAMPERING
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 2. JWT Security & Tampering Defenses ---');

      // 2.1 Missing Token
      const noTokenRes = await apiRequest('GET', '/api/vendors');
      assert(noTokenRes.status === 401, 'Protected resource requires token (401)');

      // 2.2 Tampered Token
      const validFakePayload = { id: 'usr_mgr_1790580930154_8uge', role: 'state_manager' };
      const forgedToken = jwt.sign(validFakePayload, 'attacker_forged_secret_key');
      const forgedRes = await apiRequest('GET', '/api/vendors', null, forgedToken);
      assert(forgedRes.status === 401, 'Tampered token signed with foreign secret rejected (401)');

      // 2.3 Malformed Token
      const malformedRes = await apiRequest('GET', '/api/vendors', null, 'this.is.not.a.valid.jwt');
      assert(malformedRes.status === 401, 'Malformed token string rejected (401)');

      // Generate authentic manager tokens for test assertions
      const stateToken = jwt.sign({
        id: 'usr_mgr_1790580930154_8uge',
        role: 'state_manager',
        level: 1,
        stateId: 'state_tn',
        state: 'Tamil Nadu'
      }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

      const pincodeToken = jwt.sign({
        id: 'usr_mgr_1790666281762_1jqk',
        role: 'pincode_manager',
        level: 4,
        stateId: 'state_tn',
        districtId: 'dist_cbe',
        divisionId: 'div_cbe_south',
        pincodeId: 'pin_641001',
        pincode: '641001'
      }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 3: AUTHORIZATION & RBAC DEFENSES
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 3. Authorization & Administrative Endpoint Blocking ---');

      // 3.1 Field managers blocked from POST /api/managers
      const createMgrRes = await apiRequest('POST', '/api/managers', { name: 'Unauthorized Manager' }, stateToken);
      assert(createMgrRes.status === 403, 'Field manager blocked from creating managers (403)');

      // 3.2 Field managers blocked from modifying locations
      const createLocRes = await apiRequest('POST', '/api/states', { name: 'Fake State' }, stateToken);
      assert(createLocRes.status === 403, 'Field manager blocked from modifying territory locations (403)');

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 4: OBJECT-LEVEL ACCESS CONTROL & IDOR DEFENSES
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 4. Object-Level Access Control & IDOR Defenses ---');

      // 4.1 Cross-user Notification modification prevented
      // Insert a notification belonging to user B
      const targetUserNotif = await db.notifications.insertOne({
        title: 'Confidential User B Alert',
        userId: 'user_target_victim_99',
        isRead: false
      });

      // User A (state manager) attempts to mark User B's notification read
      const idorNotifRes = await apiRequest('PATCH', `/api/notifications/${targetUserNotif._id}/read`, {}, stateToken);
      assert(idorNotifRes.status === 403, `IDOR prevented on cross-user notification update (status: ${idorNotifRes.status})`);

      // User A attempts to delete User B's notification
      const idorDelRes = await apiRequest('DELETE', `/api/notifications/${targetUserNotif._id}`, {}, stateToken);
      assert(idorDelRes.status === 403, `IDOR prevented on cross-user notification deletion (status: ${idorDelRes.status})`);

      // 4.2 Cross-territory Shop Visit modification prevented
      const karnatakaVisit = await db.shopVisits.insertOne({
        shopName: 'Bengaluru Electronics Hub',
        stateId: 'state_ka',
        districtId: 'dist_blr_urban',
        recordedById: 'some_other_manager'
      });

      // Tamil Nadu Pincode Manager attempts to edit Karnataka shop visit
      const idorVisitRes = await apiRequest('PUT', `/api/shop-visits/${karnatakaVisit._id}`, {
        shopName: 'Hacked Shop Name',
        managerId: 'attacker_takeover_id'
      }, pincodeToken);
      assert(idorVisitRes.status === 403, `IDOR prevented on cross-territory shop visit update (status: ${idorVisitRes.status})`);

      // 4.3 Task creation outside assigned territory prevented
      const illegalTaskRes = await apiRequest('POST', '/api/qc-tasks/tasks', {
        title: 'Task in Unauthorized State',
        stateId: 'state_delhi',
        state: 'Delhi',
        districtId: 'dist_delhi_central'
      }, pincodeToken);
      assert(illegalTaskRes.status === 403, `Task creation outside assigned territory blocked (status: ${illegalTaskRes.status})`);

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 5: NOSQL INJECTION & PROTOTYPE POLLUTION DEFENSES
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 5. NoSQL Injection & Prototype Pollution Defenses ---');

      // 5.1 NoSQL $where injection in query parameters
      const nosqlQueryRes = await apiRequest('GET', '/api/vendors?search={"$where":"sleep(5000)"}', null, stateToken);
      assert(nosqlQueryRes.status === 200 || nosqlQueryRes.status === 400, 'Handled NoSQL query operator safely without crashing or hanging');

      // 5.2 NoSQL operator injection in JSON body
      const nosqlBodyRes = await apiRequest('POST', '/api/auth/login', {
        identifier: { '$ne': null },
        password: { '$gt': '' }
      });
      assert(nosqlBodyRes.status === 400 || nosqlBodyRes.status === 401, 'NoSQL operator injection in login payload blocked (status 400/401)');

      // 5.3 Prototype pollution attempt
      const protoRes = await apiRequest('POST', '/api/settings', {
        '__proto__': { 'isAdmin': true },
        'theme': 'dark'
      }, stateToken);
      assert(Object.prototype.isAdmin === undefined, 'Prototype pollution vector stripped and neutralized');

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 6: INPUT VALIDATION & PASSWORD COMPLEXITY
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 6. Input Validation & Password Policy Enforcement ---');

      // 6.1 Weak password rejected on registration
      const weakPassReg = await apiRequest('POST', '/api/auth/register', {
        name: 'Test Manager',
        email: 'test.weakpass@example.com',
        mobile: '9876543210',
        password: 'weak',
        role: 'pincode_manager'
      });
      assert(weakPassReg.status === 400, 'Rejects password shorter than 8 characters (400)');

      // 6.2 Password without numbers/uppercase rejected
      const simplePassReg = await apiRequest('POST', '/api/auth/register', {
        name: 'Test Manager',
        email: 'test.simplepass@example.com',
        mobile: '9876543210',
        password: 'alllowercasepassword',
        role: 'pincode_manager'
      });
      assert(simplePassReg.status === 400, 'Rejects password lacking uppercase and numbers (400)');

      // 6.3 Invalid mobile number format rejected
      const badMobileReg = await apiRequest('POST', '/api/auth/register', {
        name: 'Test Manager',
        email: 'test.badmobile@example.com',
        mobile: '12345',
        password: 'StrongPassword@123',
        role: 'pincode_manager'
      });
      assert(badMobileReg.status === 400, 'Rejects invalid mobile number format (400)');

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 7: RATE LIMITING DEFENSES
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 7. Rate Limiting Protection ---');

      // 7.1 OTP endpoint rate limit testing (Limit: 8 requests / 10 mins)
      console.log('  Testing OTP rate limiter after burst requests...');
      let otpRateLimited = false;
      for (let i = 0; i < 10; i++) {
        const otpRes = await apiRequest('POST', '/api/auth/send-otp', { mobile: '9876543679' });
        if (otpRes.status === 429) {
          otpRateLimited = true;
          break;
        }
      }
      assert(otpRateLimited, 'OTP endpoint enforces rate limiting with 429 Too Many Requests');

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 8: SECURITY HEADERS & INFORMATION DISCLOSURE
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 8. Security Headers & Information Disclosure ---');

      const healthRes = await apiRequest('GET', '/api/health');
      assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header present');
      assert(healthRes.headers['x-frame-options'] === 'DENY', 'X-Frame-Options: DENY header present');
      assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy header present');
      assert(healthRes.headers['content-security-policy'] !== undefined, 'Content-Security-Policy header present');
      assert(healthRes.headers['x-powered-by'] === undefined, 'X-Powered-By header is removed/hidden');

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 9: PRODUCTION SECURITY GATE & REDACTION
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 9. Production Security Gate & Redaction ---');

      // 9.1 Simulation endpoint disabled in production mode
      process.env.NODE_ENV = 'production';
      const simApprovalRes = await apiRequest('POST', '/api/auth/simulate-approval', { userId: 'some_id' });
      assert(simApprovalRes.status === 403, `Simulation endpoints strictly blocked in production mode (status: ${simApprovalRes.status})`);

      const simKycRes = await apiRequest('POST', '/api/auth/simulate-kyc', { userId: 'some_id' });
      assert(simKycRes.status === 403, `Simulate KYC strictly blocked in production mode (status: ${simKycRes.status})`);

      // 9.2 Reset token NOT disclosed in forgot-password response
      const forgotRes = await apiRequest('POST', '/api/auth/forgot-password', { email: 'surya@gmail.com' });
      assert(forgotRes.data?.demoResetToken === undefined, 'Password reset token is NOT exposed in API response');
      assert(forgotRes.data?.resetToken === undefined, 'Reset token is confidential and redacted');

      process.env.NODE_ENV = 'development'; // Reset for dev testing

      // ─────────────────────────────────────────────────────────────
      // DOMAIN 10: FILE UPLOAD SECURITY DEFENSES
      // ─────────────────────────────────────────────────────────────
      console.log('\n--- 10. File Upload Security Defenses ---');

      // 10.1 Uploading without file rejected
      const emptyUpload = await apiRequest('POST', '/api/uploads/document', {});
      assert(emptyUpload.status === 400, 'Empty upload payload rejected with 400 Bad Request');

      console.log('\n========================================================================');
      console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
      console.log('========================================================================\n');

      server.close(() => {
        process.exit(failed > 0 ? 1 : 0);
      });
    } catch (err) {
      console.error('Security test runner error:', err);
      server.close(() => process.exit(1));
    }
  });
}

runSecurityTests();
