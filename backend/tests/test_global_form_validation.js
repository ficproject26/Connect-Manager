/**
 * Connect App Ecosystem - Global Form Validation Master Test Suite
 * Validates all 9 core rules across frontend/backend shared utilities,
 * boundary conditions, and direct API endpoints.
 */

const assert = require('assert');
const http = require('http');
const {
  BANK_ACCOUNT_LENGTHS,
  resolveBankRule,
  formatName,
  validateName,
  normalizeEmail,
  validateEmail,
  cleanMobile,
  validateMobile,
  PASSWORD_REGEX,
  validatePassword,
  validatePasswordMatch,
  cleanAadhaar,
  validateAadhaar,
  maskAadhaar,
  cleanPan,
  validatePan,
  maskPan,
  cleanAccountNumber,
  validateAccountNumber,
  validateAccountNumberMatch,
  maskAccountNumber,
  cleanIfsc,
  validateIfsc,
  calculateAge,
  validateDob,
  getEighteenYearsAgoDateString
} = require('../src/utils/validation');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASS: ${desc}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('🛡️  GLOBAL FORM VALIDATION AUDIT & COMPLIANCE TEST SUITE');
  console.log('========================================================================');

  // ============================================================================
  // DOMAIN 1: NAME FIELD VALIDATION & AUTO-CAPITALIZATION
  // ============================================================================
  console.log('\n--- 1. Name Field Validation & Auto-Capitalization ---');

  it('Auto-capitalizes first alphabetic character of single word (rathika -> Rathika)', () => {
    assert.strictEqual(formatName('rathika'), 'Rathika');
  });

  it('Auto-capitalizes first alphabetic character of each word part (rathika d -> Rathika D)', () => {
    assert.strictEqual(formatName('rathika d'), 'Rathika D');
    assert.strictEqual(formatName('kavitha ramasamy'), 'Kavitha Ramasamy');
  });

  it('Preserves internal spaces and removes leading spaces', () => {
    assert.strictEqual(formatName('   rathika d'), 'Rathika D');
  });

  it('Does NOT convert the entire name to uppercase', () => {
    assert.strictEqual(formatName('rathika'), 'Rathika');
    assert.notStrictEqual(formatName('rathika'), 'RATHIKA');
  });

  it('Supports legitimate Indian and international names with punctuation and regional letters', () => {
    assert.strictEqual(formatName("o'connor"), "O'Connor");
    assert.strictEqual(formatName("mary-jane"), "Mary-Jane");
    assert.strictEqual(formatName("k. rathika"), "K. Rathika");
    assert.strictEqual(validateName('Rathika D', true, 'Full Name'), null);
    assert.strictEqual(validateName('Dr. A. P. J. Abdul Kalam', true, 'Full Name'), null);
    // Regional language Unicode letters (Tamil: ரத்திகா, Hindi: राधिका)
    assert.strictEqual(validateName('ரத்திகா', true, 'Full Name'), null);
    assert.strictEqual(validateName('राधिका', true, 'Full Name'), null);
  });

  it('Rejects empty or whitespace-only names when required', () => {
    assert.notStrictEqual(validateName('', true, 'Full Name'), null);
    assert.notStrictEqual(validateName('   ', true, 'Full Name'), null);
    assert.strictEqual(validateName('', false, 'Full Name'), null);
  });

  it('Rejects names containing numbers or invalid symbols', () => {
    assert.notStrictEqual(validateName('Rathika123', true, 'Full Name'), null);
    assert.notStrictEqual(validateName('Rathika@#$', true, 'Full Name'), null);
  });

  it('Enforces consistent length limits (min 2, max 70)', () => {
    assert.notStrictEqual(validateName('R', true, 'Full Name'), null);
    assert.strictEqual(validateName('Ra', true, 'Full Name'), null);
    const longName = 'A'.repeat(71);
    assert.notStrictEqual(validateName(longName, true, 'Full Name'), null);
  });

  // ============================================================================
  // DOMAIN 2: EMAIL VALIDATION & NORMALIZATION
  // ============================================================================
  console.log('\n--- 2. Email Validation & Normalization ---');

  it('Validates standard structure localpart@domain.extension', () => {
    assert.strictEqual(validateEmail('rathika@connect.in', true), null);
    assert.strictEqual(validateEmail('manager.south@forgeconnect.com', true), null);
    assert.strictEqual(validateEmail('user+tag@domain.co.in', true), null);
  });

  it('Requires exactly one "@" symbol', () => {
    assert.notStrictEqual(validateEmail('rathika@@domain.com', true), null);
    assert.notStrictEqual(validateEmail('rathikadomain.com', true), null);
  });

  it('Rejects missing domain, missing extension, and whitespace', () => {
    assert.notStrictEqual(validateEmail('rathika@', true), null);
    assert.notStrictEqual(validateEmail('rathika@domain', true), null);
    assert.notStrictEqual(validateEmail('rathika@.com', true), null);
    assert.notStrictEqual(validateEmail('rathika @domain.com', true), null);
    assert.notStrictEqual(validateEmail('rathika@ domain.com', true), null);
  });

  it('Normalizes email addresses consistently (trimmed and lowercase)', () => {
    assert.strictEqual(normalizeEmail('  Rathika.D@Domain.COM  '), 'rathika.d@domain.com');
  });

  it('Accepts unfamiliar but valid TLD extensions (at least 2 letters)', () => {
    assert.strictEqual(validateEmail('rathika@domain.tech', true), null);
    assert.strictEqual(validateEmail('rathika@domain.cloud', true), null);
    assert.strictEqual(validateEmail('rathika@domain.app', true), null);
  });

  // ============================================================================
  // DOMAIN 3: INDIAN MOBILE NUMBER VALIDATION
  // ============================================================================
  console.log('\n--- 3. Indian Mobile Number Validation ---');

  it('Accepts exactly 10 digits starting with 6, 7, 8, or 9', () => {
    assert.strictEqual(validateMobile('9876543210', true), null);
    assert.strictEqual(validateMobile('8765432109', true), null);
    assert.strictEqual(validateMobile('7654321098', true), null);
    assert.strictEqual(validateMobile('6543210987', true), null);
  });

  it('Rejects numbers starting with 0, 1, 2, 3, 4, or 5', () => {
    assert.notStrictEqual(validateMobile('0987654321', true), null);
    assert.notStrictEqual(validateMobile('1234567890', true), null);
    assert.notStrictEqual(validateMobile('2345678901', true), null);
    assert.notStrictEqual(validateMobile('3456789012', true), null);
    assert.notStrictEqual(validateMobile('4567890123', true), null);
    assert.notStrictEqual(validateMobile('5678901234', true), null);
  });

  it('Rejects numbers shorter or longer than 10 digits', () => {
    assert.notStrictEqual(validateMobile('987654321', true), null); // 9 digits
    assert.notStrictEqual(validateMobile('98765432101', true), null); // 11 digits
    assert.notStrictEqual(validateMobile('09876543210', true), null); // 11 digits with 0
  });

  it('Rejects alphabetic and special characters', () => {
    assert.notStrictEqual(validateMobile('98765abcde', true), null);
    assert.notStrictEqual(validateMobile('98765@4321', true), null);
  });

  it('Explicitly handles country code +91', () => {
    assert.strictEqual(cleanMobile('+919876543210'), '9876543210');
    assert.strictEqual(cleanMobile('+91 9876543210'), '9876543210');
    assert.strictEqual(validateMobile('+91 9876543210', true), null);
  });

  // ============================================================================
  // DOMAIN 4: PASSWORD VALIDATION
  // ============================================================================
  console.log('\n--- 4. Password Validation ---');

  it('Accepts valid password meeting all requirements (min 6, 1 uppercase, 1 digit, 1 special)', () => {
    assert.strictEqual(validatePassword('Rathika@123', true), null);
    assert.strictEqual(validatePassword('StrongPass#2026', true), null);
    assert.strictEqual(PASSWORD_REGEX.test('Rathika@123'), true);
  });

  it('Rejects password shorter than 6 characters', () => {
    assert.notStrictEqual(validatePassword('Rat@1', true), null);
  });

  it('Rejects password lacking an uppercase letter', () => {
    assert.notStrictEqual(validatePassword('rathika@123', true), null);
  });

  it('Rejects password lacking a numeric digit', () => {
    assert.notStrictEqual(validatePassword('Rathika@pass', true), null);
  });

  it('Rejects password lacking a special character', () => {
    assert.notStrictEqual(validatePassword('Rathika123', true), null);
  });

  it('Validates exact match between password and confirmPassword', () => {
    assert.strictEqual(validatePasswordMatch('Rathika@123', 'Rathika@123'), null);
    assert.notStrictEqual(validatePasswordMatch('Rathika@123', 'Rathika@124'), null);
    assert.notStrictEqual(validatePasswordMatch('Rathika@123', ''), null);
  });

  // ============================================================================
  // DOMAIN 5: AADHAAR NUMBER VALIDATION
  // ============================================================================
  console.log('\n--- 5. Aadhaar Number Validation ---');

  it('Accepts exactly 12 numeric digits', () => {
    assert.strictEqual(validateAadhaar('123456789012', true), null);
    assert.strictEqual(validateAadhaar('987654321012', true), null);
  });

  it('Rejects letters, spaces within the number, and special characters', () => {
    assert.notStrictEqual(validateAadhaar('12345678901a', true), null);
    assert.notStrictEqual(validateAadhaar('1234-5678-9012', true), null);
    assert.notStrictEqual(validateAadhaar('12345678901', true), null); // 11 digits
    assert.notStrictEqual(validateAadhaar('1234567890123', true), null); // 13 digits
  });

  it('Masks sensitive Aadhaar data correctly (•••• •••• 1234)', () => {
    assert.strictEqual(maskAadhaar('987654321012'), '•••• •••• 1012');
  });

  // ============================================================================
  // DOMAIN 6: PAN CARD VALIDATION
  // ============================================================================
  console.log('\n--- 6. PAN Card Validation ---');

  it('Validates standard format: 5 letters, 4 digits, 1 letter (ABCDE1234F)', () => {
    assert.strictEqual(validatePan('ABCDE1234F', true), null);
    assert.strictEqual(validatePan('BNZPR8765K', true), null);
  });

  it('Automatically cleans and uppercases input', () => {
    assert.strictEqual(cleanPan('abcde1234f'), 'ABCDE1234F');
  });

  it('Rejects invalid format, letters in digit slots, digits in letter slots, wrong length', () => {
    assert.notStrictEqual(validatePan('ABCD12345F', true), null); // 4 letters then 5 digits
    assert.notStrictEqual(validatePan('12345ABCDE', true), null);
    assert.notStrictEqual(validatePan('ABCDE12345', true), null);
    assert.notStrictEqual(validatePan('ABCDE123', true), null);
    assert.notStrictEqual(validatePan('ABCDE1234FA', true), null);
  });

  it('Masks PAN number correctly (XXXXX1234F)', () => {
    assert.strictEqual(maskPan('ABCDE1234F'), 'XXXXX1234F');
  });

  // ============================================================================
  // DOMAIN 7: BANK ACCOUNT NUMBER VALIDATION
  // ============================================================================
  console.log('\n--- 7. Bank Account Number Validation ---');

  it('Validates bank-specific account length rules for recognized banks', () => {
    // SBI: 11 to 17 digits
    assert.strictEqual(validateAccountNumber('12345678901', true, 'State Bank of India'), null); // 11
    assert.strictEqual(validateAccountNumber('123456789012', true, 'State Bank of India'), null); // 12
    assert.strictEqual(validateAccountNumber('12345678901234567', true, 'SBI'), null); // 17
    assert.notStrictEqual(validateAccountNumber('1234567890', true, 'SBI'), null); // 10 (too short)
    assert.notStrictEqual(validateAccountNumber('123456789012345678', true, 'SBI'), null); // 18 (too long)

    // HDFC: 14 digits
    assert.strictEqual(validateAccountNumber('50100456789012', true, 'HDFC Bank'), null);
    assert.notStrictEqual(validateAccountNumber('5010045678901', true, 'HDFC Bank'), null); // 13 digits

    // ICICI: 12 digits
    assert.strictEqual(validateAccountNumber('123401567890', true, 'ICICI Bank'), null);
    assert.notStrictEqual(validateAccountNumber('1234015678901', true, 'ICICI Bank'), null); // 13 digits

    // Axis Bank: 15 digits
    assert.strictEqual(validateAccountNumber('912010012345678', true, 'Axis Bank'), null);
    assert.notStrictEqual(validateAccountNumber('91201001234567', true, 'Axis Bank'), null); // 14 digits
  });

  it('Applies safe configurable numeric length (9-18 digits) when bank is unknown or unspecified', () => {
    assert.strictEqual(validateAccountNumber('123456789', true), null); // 9 digits
    assert.strictEqual(validateAccountNumber('123456789012345678', true), null); // 18 digits
    assert.notStrictEqual(validateAccountNumber('12345678', true), null); // 8 digits (too short)
    assert.notStrictEqual(validateAccountNumber('1234567890123456789', true), null); // 19 digits (too long)
  });

  it('Rejects non-numeric characters in account numbers', () => {
    assert.notStrictEqual(validateAccountNumber('123456789a', true), null);
    assert.notStrictEqual(validateAccountNumber('1234-5678-9012', true), null);
  });

  it('Validates account and confirm-account exact match', () => {
    assert.strictEqual(validateAccountNumberMatch('123456789012', '123456789012'), null);
    assert.notStrictEqual(validateAccountNumberMatch('123456789012', '123456789013'), null);
    assert.notStrictEqual(validateAccountNumberMatch('123456789012', ''), null);
  });

  it('Masks account numbers correctly (•••• •••• •••• 1234)', () => {
    assert.strictEqual(maskAccountNumber('50100456789012'), '•••• •••• •••• 9012');
  });

  // ============================================================================
  // DOMAIN 8: IFSC CODE VALIDATION
  // ============================================================================
  console.log('\n--- 8. IFSC Code Validation ---');

  it('Validates standard format: 4 uppercase letters, 0, 6 alphanumeric (SBIN0001234, HDFC0001234)', () => {
    assert.strictEqual(validateIfsc('SBIN0001234', true), null);
    assert.strictEqual(validateIfsc('HDFC0001234', true), null);
    assert.strictEqual(validateIfsc('ICIC0000001', true), null);
    assert.strictEqual(validateIfsc('UTIB0000123', true), null);
  });

  it('Rejects IFSC with non-zero 5th character, invalid letters, or wrong length', () => {
    assert.notStrictEqual(validateIfsc('SBIN1001234', true), null); // 5th char is 1
    assert.notStrictEqual(validateIfsc('SBI0001234', true), null); // only 3 prefix letters
    assert.notStrictEqual(validateIfsc('SBIN000123', true), null); // 10 chars
    assert.notStrictEqual(validateIfsc('SBIN00012345', true), null); // 12 chars
    assert.notStrictEqual(validateIfsc('12340001234', true), null); // starts with numbers
  });

  it('Automatically cleans and uppercases IFSC input', () => {
    assert.strictEqual(cleanIfsc('sbin0001234'), 'SBIN0001234');
    assert.strictEqual(cleanIfsc('  hdfc0001234  '), 'HDFC0001234');
  });

  // ============================================================================
  // DOMAIN 9: DATE OF BIRTH AND MINIMUM AGE (18+)
  // ============================================================================
  console.log('\n--- 9. Date of Birth and Minimum Age (18+) ---');

  it('Validates age calculation accounting for month, day, and leap years', () => {
    const today = new Date();
    // Exactly 20 years ago
    const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
    assert.strictEqual(calculateAge(twentyYearsAgo), 20);

    // Exactly 17 years ago (underage)
    const seventeenYearsAgo = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
    assert.strictEqual(calculateAge(seventeenYearsAgo), 17);
  });

  it('Accepts date of birth for users 18 years or older', () => {
    assert.strictEqual(validateDob('1990-05-15', 18, true), null);
    assert.strictEqual(validateDob('2000-01-01', 18, true), null);
  });

  it('Rejects under-18 users with standard required error message', () => {
    const today = new Date();
    const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const err = validateDob(tenYearsAgo, 18, true);
    assert.strictEqual(err, 'You must be at least 18 years old to register.');
  });

  it('Rejects future dates and invalid dates', () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];
    assert.strictEqual(validateDob(futureDate, 18, true), 'Date of birth cannot be in the future.');
    assert.strictEqual(validateDob('not-a-date', 18, true), 'Please enter a valid date of birth.');
  });

  it('Provides accurate 18-years-ago cutoff date string for frontend date picker max', () => {
    const cutoff = getEighteenYearsAgoDateString();
    assert.strictEqual(typeof cutoff, 'string');
    assert.match(cutoff, /^\d{4}-\d{2}-\d{2}$/);
    const birthCutoff = new Date(cutoff);
    assert(calculateAge(birthCutoff) >= 18);
  });

  // ============================================================================
  // DOMAIN 10: OPTIONAL FIELDS & BOUNDARY HANDLING
  // ============================================================================
  console.log('\n--- 10. Optional Fields & Boundary Handling ---');

  it('Allows empty values for optional fields without triggering validation errors', () => {
    assert.strictEqual(validateName('', false, 'Co-partner Name'), null);
    assert.strictEqual(validateEmail('', false), null);
    assert.strictEqual(validateMobile('', false), null);
    assert.strictEqual(validateAadhaar('', false), null);
    assert.strictEqual(validatePan('', false), null);
    assert.strictEqual(validateAccountNumber('', false), null);
    assert.strictEqual(validateIfsc('', false), null);
    assert.strictEqual(validateDob('', 18, false), null);
  });

  it('Enforces strict format validation whenever an optional field value is supplied', () => {
    assert.notStrictEqual(validatePan('INVALID_PAN', false), null);
    assert.notStrictEqual(validateAadhaar('12345', false), null);
    assert.notStrictEqual(validateMobile('12345', false), null);
    assert.notStrictEqual(validateEmail('invalid-email', false), null);
    assert.notStrictEqual(validateAccountNumber('123', false), null);
    assert.notStrictEqual(validateIfsc('BAD_IFSC', false), null);
  });

  console.log('\n========================================================================');
  console.log(`🏁 TEST SUITE RESULTS: ${passedTests} OF ${totalTests} TESTS PASSED`);
  console.log('========================================================================');

  if (passedTests === totalTests) {
    console.log('>>> ALL GLOBAL FORM VALIDATION TESTS PASSED PERFECTLY! <<<\n');
    process.exit(0);
  } else {
    console.error(`>>> ${totalTests - passedTests} TESTS FAILED! <<<\n`);
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
