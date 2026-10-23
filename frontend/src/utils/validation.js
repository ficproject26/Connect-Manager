/**
 * Connect App Ecosystem - Global Validation Utility (Frontend ESM)
 * Standardized across Manager, Sub Admin, Vendor, Customer, Agent, and Admin portals.
 */

// ==============================================================================
// 1. BANK ACCOUNT CONFIGURATIONS & RULES
// ==============================================================================
export const BANK_ACCOUNT_LENGTHS = {
  sbi: { min: 11, max: 17, label: 'State Bank of India' },
  hdfc: { min: 14, max: 14, label: 'HDFC Bank' },
  icici: { min: 12, max: 12, label: 'ICICI Bank' },
  pnb: { min: 16, max: 16, label: 'Punjab National Bank' },
  axis: { min: 15, max: 15, label: 'Axis Bank' },
  canara: { min: 13, max: 13, label: 'Canara Bank' },
  bob: { min: 14, max: 14, label: 'Bank of Baroda' },
  union: { min: 15, max: 15, label: 'Union Bank of India' },
  indian: { min: 9, max: 17, label: 'Indian Bank' },
  kotak: { min: 10, max: 10, label: 'Kotak Mahindra Bank' },
  indusind: { min: 12, max: 12, label: 'IndusInd Bank' },
  yes: { min: 15, max: 15, label: 'Yes Bank' },
  federal: { min: 14, max: 14, label: 'Federal Bank' },
  central: { min: 10, max: 17, label: 'Central Bank of India' }
};

export function resolveBankRule(bankNameOrCode) {
  if (!bankNameOrCode) return null;
  const s = String(bankNameOrCode).toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('sbi') || s.includes('statebank')) return BANK_ACCOUNT_LENGTHS.sbi;
  if (s.includes('hdfc')) return BANK_ACCOUNT_LENGTHS.hdfc;
  if (s.includes('icici')) return BANK_ACCOUNT_LENGTHS.icici;
  if (s.includes('pnb') || s.includes('punjab')) return BANK_ACCOUNT_LENGTHS.pnb;
  if (s.includes('axis')) return BANK_ACCOUNT_LENGTHS.axis;
  if (s.includes('canara')) return BANK_ACCOUNT_LENGTHS.canara;
  if (s.includes('bob') || s.includes('baroda')) return BANK_ACCOUNT_LENGTHS.bob;
  if (s.includes('unionbank')) return BANK_ACCOUNT_LENGTHS.union;
  if (s.includes('kotak')) return BANK_ACCOUNT_LENGTHS.kotak;
  if (s.includes('indusind')) return BANK_ACCOUNT_LENGTHS.indusind;
  if (s.includes('yesbank')) return BANK_ACCOUNT_LENGTHS.yes;
  if (s.includes('federal')) return BANK_ACCOUNT_LENGTHS.federal;
  if (s.includes('centralbank')) return BANK_ACCOUNT_LENGTHS.central;
  if (s === 'indian' || s.includes('indianbank')) return BANK_ACCOUNT_LENGTHS.indian;
  return null;
}

// ==============================================================================
// 1. NAME FIELD VALIDATION & FORMATTING
// ==============================================================================
// Automatically capitalize the first alphabetic character of each name part
// Preserve appropriate spaces between words, strip leading spaces
export function formatName(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/^\s+/, '');
  return str.replace(/(?:^|[\s.'’\-])\p{L}/gu, (match) => match.toUpperCase());
}

export function validateName(name, isRequired = true, fieldLabel = 'Name') {
  if (!name || !String(name).trim()) {
    return isRequired ? `${fieldLabel} is required.` : null;
  }
  const clean = String(name).trim();
  if (clean.length < 2) {
    return `${fieldLabel} must be at least 2 characters long.`;
  }
  if (clean.length > 70) {
    return `${fieldLabel} must not exceed 70 characters.`;
  }
  // Allow letters (including international / regional language Unicode letters & marks), spaces, hyphens, apostrophes, and dots
  const hasLetter = /[\p{L}]/u.test(clean);
  const validChars = /^[\p{L}\p{M}\s.'’\-]+$/u.test(clean);
  if (!hasLetter || !validChars) {
    return `${fieldLabel} contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.`;
  }
  return null;
}

// ==============================================================================
// 2. EMAIL VALIDATION & NORMALIZATION
// ==============================================================================
// Standard email structure: localpart@domain.extension
// Exactly one '@', valid domain, valid extension (at least 2 letters), trimmed, lowercase
export function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : '';
}

export function validateEmail(email, isRequired = true) {
  if (!email || !String(email).trim()) {
    return isRequired ? 'Email address is required.' : null;
  }
  const clean = String(email).trim();
  if (clean.length > 100) {
    return 'Email address must not exceed 100 characters.';
  }
  if (/\s/.test(clean)) {
    return 'Email address must not contain spaces.';
  }
  const atParts = clean.split('@');
  if (atParts.length !== 2) {
    return 'Email address must contain exactly one "@" symbol.';
  }
  const [localPart, domainPart] = atParts;
  if (!localPart || !domainPart) {
    return 'Invalid email address structure.';
  }
  const domainParts = domainPart.split('.');
  if (domainParts.length < 2 || domainParts.some(p => !p)) {
    return 'Email domain is invalid or missing.';
  }
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[A-Za-z]{2,}$/.test(tld)) {
    return 'Email address must have a valid domain extension (e.g., .com, .in).';
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return 'Please enter a valid email address (e.g., name@domain.com).';
  }
  return null;
}

// ==============================================================================
// 3. INDIAN MOBILE NUMBER VALIDATION
// ==============================================================================
// Exactly 10 digits, starts with 6, 7, 8, or 9.
// Rejects numbers starting with 0, 1, 2, 3, 4, or 5.
export function cleanMobile(mobile) {
  if (!mobile) return '';
  let clean = String(mobile).trim().replace(/[\s\-()]/g, '');
  if (clean.startsWith('+91')) {
    clean = clean.slice(3);
  }
  return clean;
}

export function validateMobile(mobile, isRequired = true, fieldLabel = 'Mobile number') {
  if (!mobile || !String(mobile).trim()) {
    return isRequired ? `${fieldLabel} is required.` : null;
  }
  const clean = cleanMobile(mobile);
  if (!/^\d+$/.test(clean)) {
    return `${fieldLabel} must contain numeric digits only.`;
  }
  if (clean.length !== 10) {
    return `${fieldLabel} must be exactly 10 digits.`;
  }
  if (!/^[6-9]/.test(clean)) {
    return `${fieldLabel} must start with 6, 7, 8, or 9. Numbers starting with 0–5 are not permitted.`;
  }
  return null;
}

// ==============================================================================
// 4. PASSWORD VALIDATION
// ==============================================================================
// Minimum length: 6 characters
// At least one uppercase letter, at least one numeric digit, at least one special character
// Pattern: ^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{6,}$
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{6,}$/;

export function validatePassword(password, isRequired = true) {
  if (!password) {
    return isRequired ? 'Password is required.' : null;
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one numeric digit (0-9).';
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return 'Password must contain at least one special character (e.g. @, #, $, !).';
  }
  return null;
}

export function validatePasswordMatch(password, confirmPassword) {
  if (!confirmPassword) {
    return 'Please confirm your password.';
  }
  if (password !== confirmPassword) {
    return 'Password and Confirm Password do not match.';
  }
  return null;
}

// ==============================================================================
// 5. AADHAAR NUMBER VALIDATION
// ==============================================================================
// Exactly 12 numeric digits
export function cleanAadhaar(aadhaar) {
  if (aadhaar === null || aadhaar === undefined) return '';
  if (typeof aadhaar !== 'string' && typeof aadhaar !== 'number') return '';
  return String(aadhaar).trim().replace(/[\s-]/g, '');
}

// Alias for backwards-compatibility and typo safety
export const cleanAadhar = cleanAadhaar;

export function validateAadhaar(aadhaar, isRequired = false) {
  if (aadhaar === null || aadhaar === undefined || (typeof aadhaar === 'string' && !aadhaar.trim())) {
    return isRequired ? 'Aadhaar number is required.' : null;
  }
  if (typeof aadhaar !== 'string' && typeof aadhaar !== 'number') {
    return 'Aadhaar number must contain numeric digits only.';
  }
  const rawStr = String(aadhaar).trim();
  if (/[^\d\s-]/.test(rawStr)) {
    return 'Aadhaar number must contain numeric digits only.';
  }
  const clean = cleanAadhaar(rawStr);
  if (!clean) {
    return isRequired ? 'Aadhaar number is required.' : null;
  }
  if (!/^\d+$/.test(clean)) {
    return 'Aadhaar number must contain numeric digits only.';
  }
  if (clean.length !== 12) {
    return 'Aadhaar number must be exactly 12 numeric digits.';
  }
  return null;
}

export const validateAadhar = validateAadhaar;

export function maskAadhaar(aadhaar) {
  const clean = cleanAadhaar(aadhaar);
  if (!clean || clean.length < 4) return clean || '';
  return `•••• •••• ${clean.slice(-4)}`;
}

export const maskAadhar = maskAadhaar;

// ==============================================================================
// 6. PAN CARD VALIDATION
// ==============================================================================
// Pattern: ^[A-Z]{5}[0-9]{4}[A-Z]$ (total length: 10)
export function cleanPan(pan) {
  return pan ? String(pan).trim().toUpperCase().replace(/\s/g, '') : '';
}

export function validatePan(pan, isRequired = false) {
  const clean = cleanPan(pan);
  if (!clean) {
    return isRequired ? 'PAN card number is required.' : null;
  }
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) {
    return 'PAN must be exactly 10 characters (5 uppercase letters, 4 digits, 1 letter, e.g. ABCDE1234F).';
  }
  return null;
}

export function maskPan(pan) {
  const clean = cleanPan(pan);
  if (!clean || clean.length < 5) return clean || '';
  return `XXXXX${clean.slice(5)}`;
}

// ==============================================================================
// 7. BANK ACCOUNT NUMBER VALIDATION
// ==============================================================================
export function cleanAccountNumber(acc) {
  return acc ? String(acc).trim().replace(/\s/g, '') : '';
}

export function validateAccountNumber(acc, isRequired = true, bankNameOrCode = null) {
  const clean = cleanAccountNumber(acc);
  if (!clean) {
    return isRequired ? 'Account Number is required.' : null;
  }
  if (!/^\d+$/.test(clean)) {
    return 'Account Number must contain numeric digits only.';
  }
  const bankRule = resolveBankRule(bankNameOrCode);
  if (bankRule) {
    if (clean.length < bankRule.min || clean.length > bankRule.max) {
      const allowedStr = bankRule.min === bankRule.max ? `${bankRule.min}` : `${bankRule.min}–${bankRule.max}`;
      return `${bankRule.label} account number must be ${allowedStr} digits.`;
    }
  } else {
    // Default safe configurable range for Indian banks
    if (clean.length < 9 || clean.length > 18) {
      return 'Account Number must contain between 9 and 18 digits.';
    }
  }
  return null;
}

export function validateAccountNumberMatch(acc, confirmAcc) {
  if (!confirmAcc) {
    return 'Please confirm your account number.';
  }
  if (cleanAccountNumber(acc) !== cleanAccountNumber(confirmAcc)) {
    return 'Account Number and Confirm Account Number do not match.';
  }
  return null;
}

export function maskAccountNumber(acc) {
  const clean = cleanAccountNumber(acc);
  if (!clean || clean.length < 4) return clean || '';
  return `•••• •••• •••• ${clean.slice(-4)}`;
}

// ==============================================================================
// 8. IFSC CODE VALIDATION
// ==============================================================================
// Exactly 11 characters: 4 uppercase letters, 0, 6 alphanumeric (e.g. SBIN0001234)
export function cleanIfsc(ifsc) {
  return ifsc ? String(ifsc).trim().toUpperCase().replace(/\s/g, '') : '';
}

export function validateIfsc(ifsc, isRequired = true) {
  const clean = cleanIfsc(ifsc);
  if (!clean) {
    return isRequired ? 'IFSC Code is required.' : null;
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean)) {
    return 'IFSC Code must be valid (e.g. SBIN0001234: 4 letters, 0, followed by 6 alphanumeric characters).';
  }
  return null;
}

// ==============================================================================
// 9. DATE OF BIRTH AND MINIMUM AGE (18+)
// ==============================================================================
// Calculate age from actual date of birth accounting for month, day, leap years
export function calculateAge(dobDate) {
  const today = new Date();
  const birth = new Date(dobDate);
  if (isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function validateDob(dob, minAge = 18, isRequired = true) {
  if (!dob) {
    return isRequired ? 'Date of birth is required.' : null;
  }
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) {
    return 'Please enter a valid date of birth.';
  }
  const today = new Date();
  if (birth > today) {
    return 'Date of birth cannot be in the future.';
  }
  const age = calculateAge(birth);
  if (age === null || age < minAge) {
    return `You must be at least ${minAge} years old to register.`;
  }
  return null;
}

export function getEighteenYearsAgoDateString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split('T')[0];
}

// ==============================================================================
// 10. LOCATION NAME VALIDATION (VILLAGE/TOWN, POST OFFICE, TALUK, DISTRICT, STATE)
// ==============================================================================
export function validateLocationName(val, isRequired = true, fieldLabel = 'Location Name') {
  if (val === null || val === undefined || !String(val).trim()) {
    return isRequired ? `${fieldLabel} is required.` : null;
  }
  const clean = String(val).trim();
  if (clean.length < 2) {
    return `${fieldLabel} must be at least 2 characters long.`;
  }
  if (clean.length > 70) {
    return `${fieldLabel} must not exceed 70 characters.`;
  }
  // Reject numeric-only strings (PDF Page 1 Bug 1)
  if (/^\d+$/.test(clean) || !/[\p{L}]/u.test(clean)) {
    return `${fieldLabel} cannot be numeric-only. Please enter a valid location name.`;
  }
  // Allowed characters: letters (including regional Unicode), digits (e.g. Sector 4), spaces, hyphens, dots, apostrophes, commas, slashes
  const validChars = /^[\p{L}\p{M}\p{N}\s.'’\-,/()]+$/u.test(clean);
  if (!validChars) {
    return `${fieldLabel} contains invalid characters.`;
  }
  return null;
}
