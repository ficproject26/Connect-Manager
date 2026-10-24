const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const {
  ALLOWED_MANAGER_ROLES,
  ADMIN_ROLES,
  isAllowedManagerRole,
  isAdminRole,
  isApprovedStatus,
  isRejectedOrBlockedStatus
} = require('../middleware/roleMiddleware');
const {
  formatName,
  validateName,
  normalizeEmail,
  validateEmail,
  cleanMobile,
  validateMobile,
  validatePassword,
  cleanAadhaar,
  validateAadhaar,
  cleanPan,
  validatePan,
  cleanAccountNumber,
  validateAccountNumber,
  cleanIfsc,
  validateIfsc,
  validateDob,
  validateLocationName
} = require('../utils/validation');

const ROLE_LIMITS = {
  state_manager: 8,      // 8 managers per State
  district_manager: 2,   // 2 managers per District
  division_manager: 2,   // 2 managers per Division
  pincode_manager: 2     // 2 managers per PIN Code
};

const ROLE_LEVELS = {
  state_manager: 1,
  district_manager: 2,
  division_manager: 3,
  pincode_manager: 4
};

// Helper: Calculate occupancy for a location and role
const getOccupancy = async (role, { stateId, districtId, divisionId, pincodeId }) => {
  const [users, managers] = await Promise.all([
    db.users.find().catch(() => []),
    db.managers.find().catch(() => [])
  ]);

  // Merge and deduplicate by _id, id, and email
  const seen = new Set();
  const allAccounts = [];
  for (const u of [...(users || []), ...(managers || [])]) {
    if (!u) continue;
    const key = String(u._id || u.id || u.email || '');
    if (seen.has(key)) continue;
    seen.add(key);
    allAccounts.push(u);
  }

  // Count active and pending accounts across both legacy and new approval workflow statuses
  const pendingStatuses = [
    'active',
    'approved',
    'under_review',
    'kyc_pending',
    'pending_sub_admin_approval',
    'pending_main_admin_approval',
    'pending_kyc_verification',
    'pending_kyc_approval'
  ];
  const occupiedUsers = allAccounts.filter(u => {
    const s = String(u.status || '').toLowerCase().trim();
    const ost = String(u.overallRegistrationStatus || '').toLowerCase().trim();
    return pendingStatuses.includes(s) || pendingStatuses.includes(ost) || u.isApproved === true;
  });
  const limit = ROLE_LIMITS[role] || 2;
  const normId = (id) => (id ? String(id).trim().toLowerCase() : '');

  if (role === 'state_manager') {
    if (!stateId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'state_manager' && (normId(u.stateId) === normId(stateId) || normId(u.state) === normId(stateId)));
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'district_manager') {
    if (!districtId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'district_manager' && (normId(u.districtId) === normId(districtId) || normId(u.district) === normId(districtId)));
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'division_manager') {
    if (!divisionId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'division_manager' && (normId(u.divisionId) === normId(divisionId) || normId(u.division) === normId(divisionId)));
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'pincode_manager') {
    if (!pincodeId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'pincode_manager' && (normId(u.pincodeId) === normId(pincodeId) || normId(u.pincode) === normId(pincodeId) || normId(u.pincodeCode) === normId(pincodeId)));
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  return { count: 0, limit, isFull: false, remaining: limit };
};


// Helper: Safely resolve and populate saved manager bank details from users, managers, or top-level fields
const resolveUserBankDetails = async (user) => {
  if (!user) return null;
  let bd = user.bankDetails || user.bankAccount || null;
  let mgrDoc = null;
  if (!bd || !bd.accountNumber) {
    mgrDoc = await db.managers.findOne({
      $or: [
        ...(user._id ? [{ _id: user._id }] : []),
        ...(user.id ? [{ id: user.id }] : []),
        ...(user.email ? [{ email: user.email }] : []),
        ...(user.mobile ? [{ mobile: user.mobile }, { phone: user.mobile }] : []),
        ...(user.phone ? [{ phone: user.phone }, { mobile: user.phone }] : [])
      ]
    }).catch(() => null);
    if (mgrDoc?.bankDetails) {
      bd = { ...(bd || {}), ...mgrDoc.bankDetails };
    }
  }

  const accountHolderName = bd?.accountHolderName || bd?.accountHolder || user.accountHolderName || mgrDoc?.accountHolderName || user.name || '';
  const bankName = bd?.bankName || bd?.bank || user.bankName || mgrDoc?.bankName || '';
  const branchName = bd?.branchName || bd?.branch || user.branchName || user.bankBranch || mgrDoc?.branchName || '';
  const city = bd?.city || bd?.bankCity || user.city || user.bankCity || mgrDoc?.city || '';
  const street = bd?.street || bd?.bankStreet || user.street || user.bankStreet || mgrDoc?.street || null;
  const accountNumber = bd?.accountNumber || bd?.accountNo || bd?.bankAccount || user.accountNumber || user.accountNo || mgrDoc?.accountNumber || mgrDoc?.accountNo || '';
  const ifscCode = bd?.ifscCode || bd?.ifsc || user.ifscCode || user.ifsc || mgrDoc?.ifscCode || mgrDoc?.ifsc || '';

  if (accountNumber || bankName || ifscCode) {
    return {
      accountHolderName: accountHolderName || user.name || '',
      bankName: bankName || '',
      branchName: branchName || '',
      city: city || '',
      street: street || null,
      accountNumber: accountNumber || '',
      ifscCode: ifscCode || ''
    };
  }
  return bd || null;
};

// Helper: Identify responsible Sub-admin according to hierarchy level and assigned territory
const findTerritorySubAdmin = async ({ role, stateId, stateName, districtId, districtName, divisionId, divisionName, pincodeId, pincodeCode }) => {
  let resolvedStateName = stateName;
  if (!resolvedStateName && stateId) {
    const sDoc = await db.states.findById(stateId);
    if (sDoc) resolvedStateName = sDoc.name;
  }

  let resolvedDistrictName = districtName;
  if (!resolvedDistrictName && districtId) {
    const dDoc = await db.districts.findById(districtId);
    if (dDoc) resolvedDistrictName = dDoc.name;
  }

  let resolvedDivisionName = divisionName;
  if (!resolvedDivisionName && divisionId) {
    const vDoc = await db.divisions.findById(divisionId);
    if (vDoc) resolvedDivisionName = vDoc.name;
  }

  let resolvedPincodeCode = pincodeCode;
  if (!resolvedPincodeCode && pincodeId) {
    const pDoc = await db.pincodes.findById(pincodeId);
    if (pDoc) resolvedPincodeCode = pDoc.code;
  }

  const allUsers = await db.users.find();

  if (role === 'state_manager') {
    // State Manager -> State Admin
    return allUsers.find(u => {
      const uRole = String(u.role || '').toLowerCase().trim();
      const isAdmin = uRole === 'state admin' || uRole === 'state_admin' || String(u.adminLevel || '').toLowerCase() === 'state';
      if (!isAdmin) return false;
      if (stateId && (u.stateId === stateId || u.regionId === stateId)) return true;
      if (resolvedStateName && (String(u.state || u.stateName || '').toLowerCase().trim() === String(resolvedStateName).toLowerCase().trim())) return true;
      return false;
    }) || null;
  }

  if (role === 'district_manager') {
    // District Manager -> District Admin
    return allUsers.find(u => {
      const uRole = String(u.role || '').toLowerCase().trim();
      const isAdmin = uRole === 'district admin' || uRole === 'district_admin' || String(u.adminLevel || '').toLowerCase() === 'district';
      if (!isAdmin) return false;
      if (districtId && (u.districtId === districtId || u.assignedDistrictId === districtId)) return true;
      if (resolvedDistrictName && (String(u.district || u.districtName || '').toLowerCase().trim() === String(resolvedDistrictName).toLowerCase().trim())) return true;
      return false;
    }) || null;
  }

  if (role === 'division_manager') {
    // Division Manager -> Division Admin / Divisional Admin
    return allUsers.find(u => {
      const uRole = String(u.role || '').toLowerCase().trim();
      const isAdmin = uRole.includes('divis') && uRole.includes('admin');
      if (!isAdmin) return false;
      if (divisionId && (u.divisionId === divisionId || u.assignedDivisionId === divisionId)) return true;
      if (resolvedDivisionName && (String(u.division || u.divisionName || '').toLowerCase().trim() === String(resolvedDivisionName).toLowerCase().trim())) return true;
      return false;
    }) || null;
  }

  if (role === 'pincode_manager') {
    // Pincode Manager -> Pincode Admin
    return allUsers.find(u => {
      const uRole = String(u.role || '').toLowerCase().trim();
      const isAdmin = uRole === 'pincode admin' || uRole === 'pincode_admin' || String(u.adminLevel || '').toLowerCase() === 'pincode';
      if (!isAdmin) return false;
      if (pincodeId && (u.pincodeId === pincodeId || u.assignedPincodeId === pincodeId)) return true;
      if (resolvedPincodeCode && (String(u.pincode || u.pincodeCode || '').trim() === String(resolvedPincodeCode).trim())) return true;
      return false;
    }) || null;
  }

  return null;
};

// Brute force protection tracker for login attempts
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const login = async (req, res) => {
  try {
    const rawIdentifier = String(req.body.identifier || req.body.email || req.body.mobile || '').trim();
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email or mobile number, and password.' });
    }

    const lockKey = rawIdentifier.toLowerCase();
    const attemptRecord = failedLoginAttempts.get(lockKey);
    if (attemptRecord) {
      if (attemptRecord.lockedUntil && Date.now() < attemptRecord.lockedUntil) {
        const remainingMins = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Account is temporarily locked due to repeated failed login attempts. Please try again in ${remainingMins} minute(s).`
        });
      } else if (attemptRecord.lockedUntil && Date.now() >= attemptRecord.lockedUntil) {
        failedLoginAttempts.delete(lockKey);
      }
    }

    const registerFailure = () => {
      const current = failedLoginAttempts.get(lockKey) || { count: 0, lockedUntil: 0 };
      current.count += 1;
      if (current.count >= MAX_FAILED_ATTEMPTS) {
        current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        failedLoginAttempts.set(lockKey, current);
        return { locked: true, remaining: 0 };
      }
      failedLoginAttempts.set(lockKey, current);
      return { locked: false, remaining: MAX_FAILED_ATTEMPTS - current.count };
    };

    const isEmail = rawIdentifier.includes('@');
    const normalizedEmail = isEmail ? rawIdentifier.toLowerCase() : null;
    const digitsOnly = rawIdentifier.replace(/\D/g, '');
    const cleanMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

    // Live MongoDB lookup for manager by email, mobile, phone, loginId, or managerId
    // Multi-Website Cross-Role Isolation:
    // First, search for an explicitly authorized regional Manager account
    let user = null;
    let crossRoleMatch = null;

    if (normalizedEmail) {
      const safeEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const emailFilter = { email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } };
      
      user = (await db.users.findOne({ ...emailFilter, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
             (await db.managers.findOne({ ...emailFilter, role: { $in: ALLOWED_MANAGER_ROLES } }));

      if (!user) {
        // Check if an account exists under another role in the shared ecosystem
        crossRoleMatch = (await db.users.findOne(emailFilter)) || (await db.managers.findOne(emailFilter));
      }
    }

    if (!user && cleanMobile) {
      const mobileFilter = {
        $or: [
          { mobile: cleanMobile },
          { phone: cleanMobile },
          { mobile: rawIdentifier },
          { phone: rawIdentifier }
        ]
      };
      
      user = (await db.users.findOne({ ...mobileFilter, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
             (await db.managers.findOne({ ...mobileFilter, role: { $in: ALLOWED_MANAGER_ROLES } }));

      if (!user && !crossRoleMatch) {
        crossRoleMatch = (await db.users.findOne(mobileFilter)) || (await db.managers.findOne(mobileFilter));
      }
    }

    if (!user) {
      const idFilter = {
        $or: [
          { loginId: rawIdentifier.toLowerCase() },
          { managerId: rawIdentifier },
          { _id: rawIdentifier },
          { id: rawIdentifier }
        ]
      };
      
      user = (await db.users.findOne({ ...idFilter, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
             (await db.managers.findOne({ ...idFilter, role: { $in: ALLOWED_MANAGER_ROLES } }));

      if (!user && !crossRoleMatch) {
        crossRoleMatch = (await db.users.findOne(idFilter)) || (await db.managers.findOne(idFilter));
      }
    }

    // Role verification: If an account was found under another non-manager role, reject with explicit role isolation error
    if (!user && crossRoleMatch) {
      const crossRole = String(crossRoleMatch.role || '').toLowerCase().trim();
      const isCrossAdmin = isAdminRole(crossRole) || crossRoleMatch.email === 'admin@example.com' || crossRoleMatch._id === 'user_admin' || crossRoleMatch.id === 'user_admin';
      if (isCrossAdmin) {
        user = crossRoleMatch;
      } else {
        return res.status(403).json({
          success: false,
          code: 'ROLE_NOT_AUTHORIZED',
          message: `Access denied. The account associated with '${rawIdentifier}' has the role '${crossRoleMatch.role}', which is not authorized for the Connect Manager portal. Please sign in to your dedicated application.`
        });
      }
    }

    if (!user) {
      const failStatus = registerFailure();
      if (failStatus.locked) {
        return res.status(429).json({
          success: false,
          message: 'Account temporarily locked due to 5 consecutive failed attempts. Please try again after 15 minutes.'
        });
      }
      return res.status(401).json({
        success: false,
        message: `Invalid credentials. Please verify your email/mobile and password. (${failStatus.remaining} attempts remaining before lockout)`
      });
    }

    // Role check: Only regional Managers are authorized
    const userRole = String(user.role || '').toLowerCase().trim();
    const isManagerRole = isAllowedManagerRole(userRole);
    const isGlobalAdmin = isAdminRole(userRole) || user.email === 'admin@example.com' || user._id === 'user_admin' || user.id === 'user_admin';

    if (!isManagerRole && !isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        code: 'ROLE_NOT_AUTHORIZED',
        message: `Access denied. Role '${user.role}' is not authorized for the Connect Manager portal.`
      });
    }

    // Password comparison
    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } else if (user.password && typeof user.password === 'string') {
      if (user.password === password) {
        isMatch = true;
        const newHash = await bcrypt.hash(password, 12);
        await db.users.findByIdAndUpdate(user._id, { passwordHash: newHash, password: null });
      }
    }

    if (!isMatch) {
      const failStatus = registerFailure();
      if (failStatus.locked) {
        return res.status(429).json({
          success: false,
          message: 'Account temporarily locked due to 5 consecutive failed attempts. Please try again after 15 minutes.'
        });
      }
      return res.status(401).json({
        success: false,
        message: `Invalid credentials. Please verify your email/mobile and password. (${failStatus.remaining} attempts remaining before lockout)`
      });
    }

    // Clear failed attempts on successful credentials
    failedLoginAttempts.delete(lockKey);

    // Account status check
    const rawStatus = String(user.status || '').trim();
    const statusLower = rawStatus.toLowerCase();

    if (statusLower === 'suspended') {
      return res.status(403).json({ success: false, code: 'ACCOUNT_BLOCKED', message: 'Account is suspended. Please contact your administrator.' });
    }
    if (statusLower === 'inactive' || statusLower === 'deactivated') {
      return res.status(403).json({ success: false, code: 'ACCOUNT_BLOCKED', message: 'Account is inactive. Please contact your administrator.' });
    }

    if (!isGlobalAdmin) {
      if (statusLower === 'rejected') {
        return res.status(403).json({ success: false, code: 'REGISTRATION_REJECTED', message: 'Manager registration was rejected. Please contact your administrator.' });
      }

      const isApproved = (statusLower === 'active' || statusLower === 'approved') && user.isActive !== false && user.isApproved !== false;
      const rawKycStatus = String(user.kycStatus || user.kycVerificationStatus || '').toLowerCase();
      const isKycApproved = rawKycStatus === 'approved' || rawKycStatus === 'verified' || user.isKycVerified === true || (statusLower === 'active' && user.isApproved === true && !user.kycStatus);

      if (!isApproved || !isKycApproved) {
        if (statusLower === 'kyc_pending' || statusLower === 'kyc_review' || rawKycStatus === 'pending' || rawKycStatus === 'pending_verification' || rawKycStatus === 'under_verification') {
          return res.status(403).json({
            success: false,
            code: 'KYC_PENDING',
            message: 'Your application has passed Admin review and is pending final KYC verification. You will gain access once verified.'
          });
        }
        return res.status(403).json({
          success: false,
          code: 'APPROVAL_PENDING',
          message: 'Your Manager application is under review. You will be able to log in once approved by Main Admin.'
        });
      }
    }

    // Populate geographic and regional scope for response
    const stateObj = user.stateId ? await db.states.findById(user.stateId) : null;
    const districtObj = user.districtId ? await db.districts.findById(user.districtId) : null;
    const divisionObj = user.divisionId ? await db.divisions.findById(user.divisionId) : null;
    const pincodeObj = user.pincodeId ? await db.pincodes.findById(user.pincodeId) : null;

    const resolvedState = user.state || user.assignedState || stateObj?.name || null;
    const resolvedDistrict = user.district || user.assignedDistrict || districtObj?.name || null;
    const resolvedDivision = user.division || user.assignedDivision || divisionObj?.name || null;
    const resolvedPincode = user.pincode || user.assignedPincode || pincodeObj?.code || null;

    const rolePrefix = user.role === 'state_manager' ? 'STM'
      : user.role === 'district_manager' ? 'DTM'
      : user.role === 'division_manager' ? 'DIV'
      : 'PIN';
    let managerId = user.managerId;
    if (!managerId) {
      managerId = `MGR-${rolePrefix}-${String(user._id || user.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
      try {
        await db.users.findByIdAndUpdate(user._id || user.id, { managerId });
      } catch (e) {
        console.warn('Could not persist managerId on login:', e.message);
      }
    }

    const safeUser = {
      id: user._id,
      _id: user._id,
      managerId,
      name: user.name,
      email: user.email,
      mobile: user.mobile || user.phone,
      phone: user.phone || user.mobile,
      role: user.role,
      managerType: user.role,
      level: user.level,
      status: user.status,
      overallRegistrationStatus: user.overallRegistrationStatus || user.status || 'PENDING_SUB_ADMIN_APPROVAL',
      subAdminApprovalStatus: user.subAdminApprovalStatus || (['pending_main_admin_approval', 'pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending', 'active', 'approved'].includes(statusLower) ? 'approved' : 'pending'),
      mainAdminApprovalStatus: user.mainAdminApprovalStatus || (['pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending', 'active', 'approved'].includes(statusLower) ? 'approved' : ((user.subAdminApprovalStatus === 'approved' || statusLower === 'pending_main_admin_approval') ? 'pending' : 'waiting_subadmin')),
      kycVerificationStatus: user.kycVerificationStatus || (['active', 'approved'].includes(statusLower) ? 'approved' : 'not_started'),
      state: resolvedState,
      stateId: user.stateId || null,
      district: resolvedDistrict,
      districtId: user.districtId || null,
      division: resolvedDivision,
      divisionId: user.divisionId || null,
      pincode: resolvedPincode,
      pincodeId: user.pincodeId || null,
      adminApprovalStatus: user.adminApprovalStatus || (['active', 'approved'].includes(statusLower) ? 'approved' : 'pending'),
      kycStatus: user.kycStatus || (['active', 'approved'].includes(statusLower) ? 'verified' : 'pending'),
      rejectionReason: user.rejectionReason || null,
      assignedSubAdminId: user.assignedSubAdminId || null,
      assignedSubAdminName: user.assignedSubAdminName || null,
      assignedSubAdminRole: user.assignedSubAdminRole || null,
      routingQueue: user.routingQueue || null,
      subAdminRoutingStatus: user.subAdminRoutingStatus || null,
      dob: user.dob || null,
      gender: user.gender || null,
      address: user.address || (user.residentialAddress ? [user.residentialAddress.doorNumberStreet, user.residentialAddress.villageTown, user.residentialAddress.taluk, user.residentialAddress.district, user.residentialAddress.state, user.residentialAddress.pincode].filter(Boolean).join(', ') : null),
      residentialAddress: user.residentialAddress || (typeof user.address === 'object' ? user.address : null),
      activeSince: user.activatedAt || user.approvedAt || user.adminApprovedAt || user.subAdminApprovedAt || (['active', 'approved'].includes(statusLower) ? (user.updatedAt || user.createdAt) : null),
      aadharNumber: user.aadharNumber || user.documents?.aadharNumber || null,
      panNumber: user.panNumber || user.documents?.panNumber || null,
      documents: user.documents || {},
      avatarUrl: user.avatarUrl || null,
      bankDetails: await resolveUserBankDetails(user),
      scope: {
        regionId: user.stateId || null,
        regionName: resolvedState,
        stateId: user.stateId || null,
        stateName: resolvedState,
        districtId: user.role === 'state_manager' ? null : (user.districtId || null),
        districtName: user.role === 'state_manager' ? null : resolvedDistrict,
        divisionId: (user.role === 'state_manager' || user.role === 'district_manager') ? null : (user.divisionId || null),
        divisionName: (user.role === 'state_manager' || user.role === 'district_manager') ? null : resolvedDivision,
        pincodeId: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : (user.pincodeId || null),
        pincodeCode: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : resolvedPincode,
        pincodeArea: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : (pincodeObj?.areaName || null)
      }
    };

    // Rejection handling
    const isRejected = ['rejected', 'rejected_by_sub_admin', 'rejected_by_main_admin', 'kyc_rejected'].includes(statusLower);
    if (isRejected) {
      return res.status(403).json({
        success: false,
        code: 'REGISTRATION_REJECTED',
        isApproved: false,
        approvalStatus: user.status,
        overallRegistrationStatus: user.overallRegistrationStatus || user.status,
        rejectionReason: user.rejectionReason || 'Manager registration was rejected.',
        message: `Manager registration was rejected: ${user.rejectionReason || 'Please contact your administrator.'}`,
        user: safeUser
      });
    }

    // Pending approval handling (CRITICAL: NEVER grant session token for unapproved manager)
    const isApproved = statusLower === 'active' || statusLower === 'approved';
    if (!isApproved) {
      let stageMsg = 'Application is awaiting Sub-admin approval. Dashboard access is locked.';
      if (user.status === 'PENDING_MAIN_ADMIN_APPROVAL') {
        stageMsg = 'Sub-admin approval granted. Application is awaiting Main Admin clearance. Dashboard access is locked.';
      } else if (user.status === 'PENDING_KYC_VERIFICATION' || user.status === 'PENDING_KYC_APPROVAL' || user.status === 'kyc_pending') {
        stageMsg = 'Both Sub-admin and Main Admin approvals granted. Application is awaiting KYC compliance clearance. Dashboard access is locked.';
      }

      return res.status(403).json({
        success: false,
        code: 'APPROVAL_REQUIRED',
        isApproved: false,
        approvalStatus: user.status,
        overallRegistrationStatus: user.overallRegistrationStatus || user.status,
        subAdminApprovalStatus: (user.subAdminApprovalStatus === 'approved' || ['pending_main_admin_approval', 'pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending', 'active', 'approved'].includes(statusLower)) ? 'approved' : (user.subAdminApprovalStatus === 'rejected' || statusLower.includes('rejected') ? 'rejected' : 'pending'),
        mainAdminApprovalStatus: (user.mainAdminApprovalStatus === 'approved' || ['pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending', 'active', 'approved'].includes(statusLower)) ? 'approved' : (user.mainAdminApprovalStatus === 'rejected' ? 'rejected' : ((user.subAdminApprovalStatus === 'approved' || statusLower === 'pending_main_admin_approval') ? (user.mainAdminApprovalStatus || 'pending') : 'waiting_subadmin')),
        kycVerificationStatus: (user.kycVerificationStatus === 'approved' || user.kycStatus === 'verified' || ['active', 'approved'].includes(statusLower)) ? 'approved' : (user.kycStatus === 'rejected' ? 'rejected' : ((user.mainAdminApprovalStatus === 'approved' || ['pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending'].includes(statusLower)) ? 'pending' : 'not_started')),
        adminApprovalStatus: (user.subAdminApprovalStatus === 'approved' || ['pending_main_admin_approval', 'pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending', 'active', 'approved'].includes(statusLower)) ? 'approved' : 'pending',
        kycStatus: user.kycStatus || (['pending_kyc_verification', 'pending_kyc_approval'].includes(statusLower) ? 'pending' : 'pending_verification'),
        assignedSubAdminName: user.assignedSubAdminName || null,
        assignedSubAdminRole: user.assignedSubAdminRole || null,
        routingQueue: user.routingQueue || (user.status === 'PENDING_MAIN_ADMIN_APPROVAL' ? 'MAIN_ADMIN_APPROVAL_QUEUE' : user.status === 'PENDING_KYC_VERIFICATION' ? 'KYC_APPROVAL_QUEUE' : 'SUB_ADMIN_APPROVAL_QUEUE'),
        message: stageMsg,
        user: safeUser
      });
    }

    // Authorized Manager Session Generation
    const tokenPayload = {
      id: user._id,
      managerId,
      role: user.role,
      level: user.level,
      status: 'active',
      stateId: user.stateId || null,
      districtId: user.districtId || null,
      divisionId: user.divisionId || null,
      pincodeId: user.pincodeId || null
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('[Manager Auth] Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during login' });
  }
};

const register = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      role,
      dob,
      gender,
      address,
      documents,
      declarationAccepted,
      stateId,
      zone,
      districtId,
      divisionId,
      pincodeId,
      avatarUrl,
      aadharNumber,
      panNumber,
      bankDetails
    } = req.body;

    if (!name || !email || !mobile || !password || !role) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields: Full Name, Email, Mobile, Password, and Role.' });
    }

    const nameErr = validateName(name, true, 'Full Name');
    if (nameErr) {
      return res.status(400).json({ success: false, message: nameErr });
    }
    const formattedName = formatName(name);

    const emailErr = validateEmail(email, true);
    if (emailErr) {
      return res.status(400).json({ success: false, message: emailErr });
    }
    const emailStr = normalizeEmail(email);

    // Parse & Validate Residential / Operational Address (7 Fields or legacy single string)
    let addressObj = null;
    let formattedAddressStr = '';

    if (typeof address === 'object' && address !== null) {
      addressObj = {
        doorNumberStreet: String(address.doorNumberStreet || address.doorNo || address.street || '').trim(),
        villageTown: String(address.villageTown || address.village || address.town || '').trim(),
        postOffice: String(address.postOffice || address.po || '').trim(),
        taluk: String(address.taluk || address.tehsil || '').trim(),
        district: String(address.district || '').trim(),
        state: String(address.state || '').trim(),
        pincode: String(address.pincode || address.pin || '').trim()
      };
    } else if (req.body.doorNumberStreet || req.body.villageTown || req.body.pincode) {
      addressObj = {
        doorNumberStreet: String(req.body.doorNumberStreet || '').trim(),
        villageTown: String(req.body.villageTown || '').trim(),
        postOffice: String(req.body.postOffice || '').trim(),
        taluk: String(req.body.taluk || '').trim(),
        district: String(req.body.district || '').trim(),
        state: String(req.body.state || '').trim(),
        pincode: String(req.body.pincode || '').trim()
      };
    } else if (typeof address === 'string' && address.trim()) {
      formattedAddressStr = address.trim();
      // Safe backward compatibility for legacy single-string address
      addressObj = {
        doorNumberStreet: formattedAddressStr,
        villageTown: '',
        postOffice: '',
        taluk: '',
        district: '',
        state: '',
        pincode: ''
      };
    }

    if (!addressObj || (!addressObj.doorNumberStreet && !formattedAddressStr)) {
      return res.status(400).json({ success: false, message: 'Residential / Operational address is mandatory. Please enter Door Number / Street Name.' });
    }

    // Ensure email is not mistakenly passed as address
    if (addressObj.doorNumberStreet && addressObj.doorNumberStreet.toLowerCase() === emailStr.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Email address cannot be used as a residential address.' });
    }

    // Validate location names rejecting numeric-only values (PDF Page 1 Bug 1)
    if (addressObj.villageTown) {
      const vtErr = validateLocationName(addressObj.villageTown, true, 'Village / Town Name');
      if (vtErr) return res.status(400).json({ success: false, message: vtErr });
    }
    if (addressObj.postOffice) {
      const poErr = validateLocationName(addressObj.postOffice, true, 'Post Office');
      if (poErr) return res.status(400).json({ success: false, message: poErr });
    }
    if (addressObj.taluk) {
      const talukErr = validateLocationName(addressObj.taluk, true, 'Taluk');
      if (talukErr) return res.status(400).json({ success: false, message: talukErr });
    }
    if (addressObj.district) {
      const distErr = validateLocationName(addressObj.district, true, 'District');
      if (distErr) return res.status(400).json({ success: false, message: distErr });
    }
    if (addressObj.state) {
      const stateErr = validateLocationName(addressObj.state, true, 'State');
      if (stateErr) return res.status(400).json({ success: false, message: stateErr });
    }

    // Validate 6-digit Indian PIN Code starting with 1-9 if present
    if (addressObj.pincode) {
      const cleanPin = addressObj.pincode.replace(/\D/g, '');
      if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
        return res.status(400).json({ success: false, message: 'PIN Code must be exactly 6 numeric digits starting with 1–9.' });
      }
      addressObj.pincode = cleanPin;
    }

    // Generate formattedAddressStr if not already set
    if (!formattedAddressStr) {
      const parts = [
        addressObj.doorNumberStreet,
        addressObj.villageTown,
        addressObj.postOffice ? `PO: ${addressObj.postOffice}` : '',
        addressObj.taluk ? `Taluk: ${addressObj.taluk}` : '',
        addressObj.district,
        addressObj.state,
        addressObj.pincode ? `PIN: ${addressObj.pincode}` : ''
      ].filter(Boolean);
      formattedAddressStr = parts.join(', ');
    }

    const aadharVal = aadharNumber || documents?.aadharNumber || '';
    const cleanAadhar = cleanAadhaar(aadharVal);
    if (cleanAadhar) {
      const aadharErr = validateAadhaar(cleanAadhar, false);
      if (aadharErr) {
        return res.status(400).json({ success: false, message: aadharErr });
      }
    }

    const panVal = panNumber || documents?.panNumber || '';
    const cleanPanVal = cleanPan(panVal);
    if (cleanPanVal) {
      const panErr = validatePan(cleanPanVal, false);
      if (panErr) {
        return res.status(400).json({ success: false, message: panErr });
      }
    }

    const mobileErr = validateMobile(mobile, true, 'Mobile number');
    if (mobileErr) {
      return res.status(400).json({ success: false, message: mobileErr });
    }
    const cleanMobileNum = cleanMobile(mobile);

    const passErr = validatePassword(password, true);
    if (passErr) {
      return res.status(400).json({ success: false, message: passErr });
    }

    const dobErr = validateDob(dob, 18, true);
    if (dobErr) {
      return res.status(400).json({ success: false, message: dobErr });
    }

    if (!['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid manager role selected.' });
    }

    // Mandatory 4 KYC Document Uploads Backend Validation
    if (!documents || typeof documents !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'KYC documents are mandatory for manager registration. Please upload all 4 required documents.'
      });
    }

    const aadharDocUrl = documents.aadharUrl || documents.aadharCard || documents.aadhar;
    const panDocUrl = documents.panUrl || documents.panCard || documents.pan;
    const bankDocUrl = documents.bankUrl || documents.bankPassbook || documents.bank;
    const sigDocUrl = documents.signatureUrl || documents.digitalSignature || documents.signature;

    const docItems = [
      { name: 'Aadhaar Card', url: aadharDocUrl },
      { name: 'PAN Card', url: panDocUrl },
      { name: 'Bank Passbook', url: bankDocUrl },
      { name: 'Digital Signature', url: sigDocUrl }
    ];

    const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];

    for (const item of docItems) {
      if (!item.url || typeof item.url !== 'string' || !item.url.trim()) {
        return res.status(400).json({
          success: false,
          message: `${item.name} document is mandatory. Please upload your ${item.name}.`
        });
      }

      const filename = path.basename(item.url.trim());
      const filePath = path.join(UPLOAD_DIR, filename);

      // Verify file existence in storage
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({
          success: false,
          message: `${item.name} file was not found in storage. Mock or unuploaded files are not permitted.`
        });
      }

      // Verify file extension
      const ext = path.extname(filename).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: `${item.name} has an invalid format (${ext}). Only PDF, JPG, and PNG files are accepted.`
        });
      }

      // Verify file size (max 5MB)
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            message: `${item.name} exceeds the 5MB size limit (${Math.round(stats.size / 1024 / 1024)}MB).`
          });
        }
      } catch (statErr) {
        return res.status(400).json({
          success: false,
          message: `Could not verify ${item.name} file details.`
        });
      }
    }

    // Bank Details Validation (mandatory fields)
    if (!bankDetails || typeof bankDetails !== 'object') {
      return res.status(400).json({ success: false, message: 'Bank details are required for manager registration.' });
    }
    const bd = bankDetails;
    const requiredBankFields = [
      { key: 'accountHolderName', label: 'Account Holder Name' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'branchName', label: 'Bank Branch' },
      { key: 'city', label: 'Bank City' },
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'ifscCode', label: 'IFSC Code' }
    ];
    for (const { key, label } of requiredBankFields) {
      if (!bd[key] || !String(bd[key]).trim()) {
        return res.status(400).json({ success: false, message: `${label} is required in Bank Details.` });
      }
    }
    const holderErr = validateName(bd.accountHolderName, true, 'Account Holder Name');
    if (holderErr) {
      return res.status(400).json({ success: false, message: holderErr });
    }
    const ifscErr = validateIfsc(bd.ifscCode, true);
    if (ifscErr) {
      return res.status(400).json({ success: false, message: ifscErr });
    }
    const accErr = validateAccountNumber(bd.accountNumber, true, bd.bankName);
    if (accErr) {
      return res.status(400).json({ success: false, message: accErr });
    }
    const cleanIfscCode = cleanIfsc(bd.ifscCode);
    const cleanAccount = cleanAccountNumber(bd.accountNumber);
    const sanitizedBankDetails = {
      accountHolderName: formatName(bd.accountHolderName),
      bankName: String(bd.bankName).trim(),
      branchName: String(bd.branchName).trim(),
      street: bd.street ? String(bd.street).trim() : null,
      city: String(bd.city).trim(),
      accountNumber: cleanAccount,
      ifscCode: cleanIfscCode
    };

    // Role-specific location validation
    if (role === 'state_manager' && !stateId) {
      return res.status(400).json({ success: false, message: 'State selection is required for State Manager.' });
    }
    if (role === 'district_manager' && (!stateId || !districtId)) {
      return res.status(400).json({ success: false, message: 'State and District selections are required for District Manager.' });
    }
    if (role === 'division_manager' && (!stateId || !districtId || !divisionId)) {
      return res.status(400).json({ success: false, message: 'State, District, and Division selections are required for Division Manager.' });
    }
    if (role === 'pincode_manager' && (!stateId || !districtId || !divisionId || !pincodeId)) {
      return res.status(400).json({ success: false, message: 'State, District, Division, and PIN Code selections are required for PIN Code Manager.' });
    }

    // Mandatory Backend Territory Hierarchy Validation against Single Source of Truth
    let stateDoc = null;
    let distDoc = null;
    let divDoc = null;
    let pinDoc = null;

    if (stateId) {
      stateDoc = await db.states.findOne({ _id: stateId, status: 'Active' });
      if (!stateDoc) {
        return res.status(400).json({ success: false, message: 'Selected State does not exist or is not active in Admin Territory Management.' });
      }
    }

    if (districtId) {
      distDoc = await db.districts.findOne({ _id: districtId, stateId: stateDoc ? (stateDoc._id || stateId) : stateId, status: 'Active' });
      if (!distDoc) {
        return res.status(400).json({ success: false, message: 'Selected District does not belong to the selected State or is not active.' });
      }
    }

    if (divisionId) {
      divDoc = await db.divisions.findOne({ _id: divisionId, districtId: distDoc ? (distDoc._id || districtId) : districtId, status: 'Active' });
      if (!divDoc) {
        return res.status(400).json({ success: false, message: 'Selected Division does not belong to the selected District or is not active.' });
      }
    }

    if (pincodeId) {
      pinDoc = await db.pincodes.findOne({ _id: pincodeId, divisionId: divDoc ? (divDoc._id || divisionId) : divisionId, status: 'Active' });
      if (!pinDoc) {
        return res.status(400).json({ success: false, message: 'Selected PIN Code does not belong to the selected Division or is not active.' });
      }
    }

    // Check duplicate email or mobile
    const existingEmail = await db.users.findOne({ email: emailStr });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists. Please sign in or use another email.' });
    }

    const existingMobile = await db.users.findOne({
      $or: [
        { mobile: cleanMobileNum },
        { phone: cleanMobileNum },
        { mobile: mobile.trim() }
      ]
    });
    if (existingMobile) {
      return res.status(400).json({ success: false, message: 'An account with this mobile number already exists. Please sign in or use another mobile number.' });
    }

    // Check location capacity / exclusivity
    const occupancy = await getOccupancy(role, { stateId, districtId, divisionId, pincodeId });
    if (occupancy.isFull) {
      const roleTitle = role === 'state_manager' ? 'State' : role === 'district_manager' ? 'District' : role === 'division_manager' ? 'Division' : 'PIN Code';
      return res.status(400).json({
        success: false,
        limitReached: true,
        message: `This location has reached its maximum manager capacity (${occupancy.count}/${occupancy.limit} ${roleTitle} Managers). Registration not allowed for this location.`
      });
    }


    // Hash password with strong cost factor
    const passwordHash = await bcrypt.hash(password, 12);
    const level = ROLE_LEVELS[role] || 1;

    const rolePrefix = role === 'state_manager' ? 'STM'
      : role === 'district_manager' ? 'DTM'
      : role === 'division_manager' ? 'DIV'
      : 'PIN';

    // Generate unique, collision-free persistent Manager ID
    let managerId;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 15) {
      attempts++;
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const testId = `MGR-${rolePrefix}-${randomSuffix}`;
      const existingInUsers = await db.users.findOne({ managerId: testId });
      const existingInManagers = await db.managers.findOne({ managerId: testId });
      if (!existingInUsers && !existingInManagers) {
        managerId = testId;
        isUnique = true;
      }
    }
    if (!managerId) {
      managerId = `MGR-${rolePrefix}-${Date.now().toString().slice(-6)}`;
    }

    // Step 1: Territory-Based Sub-admin Identification & Routing
    const territorySubAdmin = await findTerritorySubAdmin({
      role,
      stateId: stateDoc?._id || stateId,
      stateName: stateDoc?.name,
      districtId: distDoc?._id || districtId,
      districtName: distDoc?.name,
      divisionId: divDoc?._id || divisionId,
      divisionName: divDoc?.name,
      pincodeId: pinDoc?._id || pincodeId,
      pincodeCode: pinDoc?.code
    });

    const subAdminRoutingStatus = territorySubAdmin ? 'ROUTED_TO_SUB_ADMIN' : 'UNASSIGNED_ROUTING_PENDING';
    const assignedSubAdminId = territorySubAdmin ? (territorySubAdmin._id || territorySubAdmin.id) : null;
    const assignedSubAdminName = territorySubAdmin ? territorySubAdmin.name : null;
    const assignedSubAdminRole = territorySubAdmin ? territorySubAdmin.role : null;

    const newUser = await db.users.insertOne({
      managerId,
      name: formattedName,
      email: emailStr,
      mobile: cleanMobileNum,
      passwordHash,
      role,
      level,
      status: 'PENDING_SUB_ADMIN_APPROVAL',
      overallRegistrationStatus: 'PENDING_SUB_ADMIN_APPROVAL',
      subAdminApprovalStatus: 'pending',
      mainAdminApprovalStatus: 'waiting_subadmin',
      kycVerificationStatus: 'not_started',
      adminApprovalStatus: 'pending',
      kycStatus: 'not_started',
      approvalStage: 'subadmin_review',
      routingQueue: 'SUB_ADMIN_APPROVAL_QUEUE',
      isApproved: false,
      isActive: false,
      assignedSubAdminId,
      assignedSubAdminName,
      assignedSubAdminRole,
      subAdminRoutingStatus,
      dob: dob || null,
      gender: gender || null,
      address: formattedAddressStr || (address ? String(address).trim() : null),
      residentialAddress: addressObj || null,
      aadharNumber: cleanAadhar || null,
      panNumber: cleanPanVal || null,
      documents: {
        aadharNumber: cleanAadhar || null,
        panNumber: cleanPanVal || null,
        aadharUrl: aadharDocUrl,
        panUrl: panDocUrl,
        bankUrl: bankDocUrl,
        signatureUrl: sigDocUrl,
        aadharCard: aadharDocUrl,
        panCard: panDocUrl,
        bankPassbook: bankDocUrl,
        digitalSignature: sigDocUrl,
        aadharFileName: documents?.aadharFileName || path.basename(aadharDocUrl),
        panFileName: documents?.panFileName || path.basename(panDocUrl),
        bankFileName: documents?.bankFileName || path.basename(bankDocUrl),
        signatureFileName: documents?.signatureFileName || path.basename(sigDocUrl)
      },
      declarationAccepted: !!declarationAccepted,
      stateId: stateId || null,
      zone: zone || null,
      districtId: role === 'state_manager' ? null : (districtId || null),
      divisionId: (role === 'state_manager' || role === 'district_manager') ? null : (divisionId || null),
      pincodeId: (role === 'state_manager' || role === 'district_manager' || role === 'division_manager') ? null : (pincodeId || null),
      state: stateDoc?.name || null,
      district: distDoc?.name || null,
      division: divDoc?.name || null,
      pincode: pinDoc?.code || null,
      stateName: stateDoc?.name || null,
      districtName: distDoc?.name || null,
      divisionName: divDoc?.name || null,
      pincodeCode: pinDoc?.code || null,
      regionId: stateId || null,
      avatarUrl: avatarUrl || null,
      bankDetails: sanitizedBankDetails
    });

    const territoryDescription = [
      stateDoc?.name,
      distDoc?.name,
      divDoc?.name,
      pinDoc?.code ? `PIN ${pinDoc.code}` : null
    ].filter(Boolean).join(' › ');

    // Route request to the Sub-admin approval queue via persistent notification
    if (territorySubAdmin) {
      try {
        await db.notifications.insertOne({
          receiver: assignedSubAdminId,
          userId: assignedSubAdminId,
          title: 'New Manager Registration Pending Approval',
          message: `New registration submitted for ${formattedName} (${role.replace('_', ' ')}). Territory: ${territoryDescription}. Action required: Review and approve/reject manager request.`,
          category: 'registration_approval',
          type: 'sub_admin_approval_request',
          read: false,
          isRead: false,
          priority: 'high',
          recordId: newUser._id,
          createdAt: new Date().toISOString()
        });
      } catch (notifErr) {
        console.warn('Could not dispatch Sub-admin notification:', notifErr.message);
      }
    }

    // Record audit log
    await db.auditLogs.insertOne({
      action: 'MANAGER_REGISTERED_PENDING_SUB_ADMIN_APPROVAL',
      userId: newUser._id,
      userName: newUser.name,
      userRole: newUser.role,
      details: `New ${role.replace('_', ' ')} registration submitted for approval. Status: PENDING_SUB_ADMIN_APPROVAL. Assigned Sub-admin: ${assignedSubAdminName || 'Unassigned (routing pending)'}. Territory: ${territoryDescription}.`,
      ip: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    const state = stateId ? await db.states.findById(stateId) : null;
    const district = districtId ? await db.districts.findById(districtId) : null;
    const division = divisionId ? await db.divisions.findById(divisionId) : null;
    const pincode = pincodeId ? await db.pincodes.findById(pincodeId) : null;

    res.status(201).json({
      success: true,
      status: 'PENDING_SUB_ADMIN_APPROVAL',
      overallRegistrationStatus: 'PENDING_SUB_ADMIN_APPROVAL',
      subAdminApprovalStatus: 'pending',
      mainAdminApprovalStatus: 'waiting_subadmin',
      kycVerificationStatus: 'not_started',
      isApproved: false,
      isActive: false,
      message: territorySubAdmin
        ? `Manager registration submitted successfully. Application routed to assigned Sub-admin (${assignedSubAdminName}) for review.`
        : 'Manager registration submitted successfully. Application is pending Sub-admin territory routing.',
      user: {
        id: newUser._id,
        managerId: newUser.managerId || managerId,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        role: newUser.role,
        level: newUser.level,
        status: newUser.status,
        overallRegistrationStatus: 'PENDING_SUB_ADMIN_APPROVAL',
        subAdminApprovalStatus: 'pending',
        mainAdminApprovalStatus: 'waiting_subadmin',
        kycVerificationStatus: 'not_started',
        adminApprovalStatus: 'pending',
        kycStatus: 'not_started',
        approvalStage: 'subadmin_review',
        assignedSubAdminId,
        assignedSubAdminName,
        assignedSubAdminRole,
        subAdminRoutingStatus,
        routingQueue: 'SUB_ADMIN_APPROVAL_QUEUE',
        dob: newUser.dob || null,
        gender: newUser.gender || null,
        address: newUser.address || null,
        residentialAddress: newUser.residentialAddress || addressObj || null,
        aadharNumber: newUser.aadharNumber || null,
        panNumber: newUser.panNumber || null,
        documents: newUser.documents || {},
        avatarUrl: newUser.avatarUrl || null,
        bankDetails: sanitizedBankDetails,
        scope: {
          stateName: state?.name || null,
          zone: zone || district?.zone || null,
          districtName: role === 'state_manager' ? null : (district?.name || null),
          divisionName: (role === 'state_manager' || role === 'district_manager') ? null : (division?.name || null),
          pincodeCode: (role === 'state_manager' || role === 'district_manager' || role === 'division_manager') ? null : (pincode?.code || null),
          pincodeArea: (role === 'state_manager' || role === 'district_manager' || role === 'division_manager') ? null : (pincode?.areaName || null)
        }
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during registration' });
  }
};

const checkCapacity = async (req, res) => {
  try {
    const { role, stateId, districtId, divisionId, pincodeId } = req.query;

    if (!role) {
      return res.status(400).json({ success: false, message: 'Role parameter is required.' });
    }

    const occupancy = await getOccupancy(role, { stateId, districtId, divisionId, pincodeId });

    res.json({
      success: true,
      role,
      limit: occupancy.limit,
      currentCount: occupancy.count,
      remaining: occupancy.remaining,
      isFull: occupancy.isFull,
      isAllowed: !occupancy.isFull
    });
  } catch (err) {
    console.error('Check capacity error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify location capacity' });
  }
};

// Step 1B: Get live registration status for applicant review tracking
const getRegistrationStatus = async (req, res) => {
  try {
    const userId = req.params?.userId || req.query?.userId || req.query?.email || req.body?.userId || req.body?.email;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID or email is required.' });
    }

    let user = (await db.users.findOne({ _id: userId, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
               (await db.managers.findOne({ _id: userId, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
               (await db.users.findById(userId)) ||
               (await db.managers.findById(userId));
    if (!user) {
      const emailTrim = String(userId).toLowerCase().trim();
      user = (await db.users.findOne({ managerId: userId, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
             (await db.users.findOne({ email: emailTrim, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
             (await db.managers.findOne({ managerId: userId, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
             (await db.managers.findOne({ email: emailTrim, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
             (await db.users.findOne({ managerId: userId })) ||
             (await db.users.findOne({ email: emailTrim })) ||
             (await db.managers.findOne({ managerId: userId })) ||
             (await db.managers.findOne({ email: emailTrim }));
    }

    if (!user || !isAllowedManagerRole(user.role)) {
      return res.status(404).json({ success: false, message: 'Manager registration not found.' });
    }

    const stateObj = user.stateId ? await db.states.findById(user.stateId) : null;
    const districtObj = user.districtId ? await db.districts.findById(user.districtId) : null;
    const divisionObj = user.divisionId ? await db.divisions.findById(user.divisionId) : null;
    const pincodeObj = user.pincodeId ? await db.pincodes.findById(user.pincodeId) : null;

    const resolvedState = user.state || user.assignedState || stateObj?.name || null;
    const resolvedDistrict = user.district || user.assignedDistrict || districtObj?.name || null;
    const resolvedDivision = user.division || user.assignedDivision || divisionObj?.name || null;
    const resolvedPincode = user.pincode || user.assignedPincode || pincodeObj?.code || null;

    const stUpper = String(user.status || user.overallRegistrationStatus || '').toUpperCase();
    const isSubAdminApproved = user.subAdminApprovalStatus === 'approved' || 
      user.adminApprovalStatus === 'approved' ||
      ['PENDING_MAIN_ADMIN_APPROVAL', 'PENDING_KYC_VERIFICATION', 'PENDING_KYC_APPROVAL', 'KYC_PENDING', 'ACTIVE', 'APPROVED'].includes(stUpper);
    const subAdminApprovalStatus = isSubAdminApproved ? 'approved' : (user.subAdminApprovalStatus || 'pending');

    const isMainAdminApproved = user.mainAdminApprovalStatus === 'approved' ||
      ['PENDING_KYC_VERIFICATION', 'PENDING_KYC_APPROVAL', 'KYC_PENDING', 'ACTIVE', 'APPROVED'].includes(stUpper);
    const mainAdminApprovalStatus = isMainAdminApproved
      ? 'approved'
      : (subAdminApprovalStatus === 'approved' ? (user.mainAdminApprovalStatus || 'pending') : 'waiting_subadmin');

    const isKycApproved = user.kycVerificationStatus === 'approved' || user.kycStatus === 'verified' || ['ACTIVE', 'APPROVED'].includes(stUpper);
    const kycVerificationStatus = isKycApproved 
      ? 'approved' 
      : (user.status === 'KYC_REJECTED' ? 'rejected' : (mainAdminApprovalStatus === 'approved' ? 'pending' : 'not_started'));

    const overallRegistrationStatus = user.overallRegistrationStatus || user.status || (isSubAdminApproved ? 'PENDING_MAIN_ADMIN_APPROVAL' : 'PENDING_SUB_ADMIN_APPROVAL');

    const statusPayload = {
      id: user._id || user.id,
      managerId: user.managerId,
      name: user.name,
      email: user.email,
      mobile: user.mobile || user.phone,
      role: user.role,
      level: user.level,
      status: user.status,
      overallRegistrationStatus,
      isSubAdminApproved,
      isMainAdminApproved,
      isKycApproved,
      subAdminApprovalStatus,
      mainAdminApprovalStatus,
      kycVerificationStatus,
      isApproved: !!user.isApproved,
      isActive: user.isActive !== undefined ? !!user.isActive : (overallRegistrationStatus === 'active' || user.status === 'active'),
      rejectionReason: user.rejectionReason || null,
      subadminApprovedByName: user.subadminApprovedByName || null,
      subadminApprovedAt: user.subadminApprovedAt || null,
      mainAdminApprovedByName: user.mainAdminApprovedByName || null,
      mainAdminApprovedAt: user.mainAdminApprovedAt || null,
      kycVerifiedAt: user.kycVerifiedAt || null,
      dob: user.dob || null,
      gender: user.gender || null,
      address: user.address || null,
      aadharNumber: user.aadharNumber || user.documents?.aadharNumber || null,
      panNumber: user.panNumber || user.documents?.panNumber || null,
      documents: {
        aadharUrl: user.documents?.aadharUrl || user.documents?.aadharCard || null,
        panUrl: user.documents?.panUrl || user.documents?.panCard || null,
        bankUrl: user.documents?.bankUrl || user.documents?.bankPassbook || null,
        signatureUrl: user.documents?.signatureUrl || user.documents?.digitalSignature || null
      },
      bankDetails: await resolveUserBankDetails(user),
      scope: {
        stateName: resolvedState,
        districtName: resolvedDistrict,
        divisionName: resolvedDivision,
        pincodeCode: resolvedPincode
      }
    };

    res.json({
      success: true,
      ...statusPayload,
      data: statusPayload,
      user: statusPayload
    });
  } catch (err) {
    console.error('getRegistrationStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch registration status.' });
  }
};

// Step 2: Sub-admin Approval Workflow (Stage A: Approve or Reject)
const subAdminApproval = async (req, res) => {
  try {
    const { userId, action, rejectionReason } = req.body;
    const targetId = userId || req.body.id || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Manager User ID is required.' });
    }

    // Disallow applicants from self-approving their own registration
    if (req.user && String(req.user.id || req.user._id) === String(targetId)) {
      return res.status(403).json({ success: false, message: 'Security Violation: Applicants cannot approve or modify their own registration status.' });
    }

    // Disallow manager roles from approving registrations
    if (req.user && ['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'].includes(String(req.user.role).toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Security Violation: Manager accounts do not have permission to approve registrations.' });
    }

    const normalizedAction = String(action || 'approve').toLowerCase().trim();
    if (!['approve', 'reject'].includes(normalizedAction)) {
      return res.status(400).json({ success: false, message: "Action must be either 'approve' or 'reject'." });
    }

    let user = (await db.users.findById(targetId)) || (await db.managers.findById(targetId));
    if (!user) {
      user = (await db.users.findOne({ managerId: targetId })) || (await db.managers.findOne({ managerId: targetId }));
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Manager account not found.' });
    }

    // Disallow modifying administrative accounts
    if (['admin', 'super_admin', 'super-admin'].includes(String(user.role).toLowerCase()) || user.email === 'admin@example.com') {
      return res.status(403).json({ success: false, message: 'Administrative accounts cannot be modified via approval endpoints.' });
    }

    // Territorial reviewer validation if req.user context is available
    if (req.user) {
      const reviewerRole = String(req.user.role || '').toLowerCase();
      const isSuperAdmin = ['admin', 'super_admin', 'super-admin', 'superadmin', 'central_admin'].includes(reviewerRole) || req.user.email === 'admin@example.com';
      if (!isSuperAdmin) {
        const userRole = String(user.role || '').toLowerCase();
        if (userRole === 'state_manager') {
          if (!reviewerRole.includes('state') && !(reviewerRole === 'admin' && req.user.state)) {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Only the authorized State-level admin can review a State Manager request.' });
          }
          if (req.user.stateId && user.stateId && String(req.user.stateId) !== String(user.stateId)) {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Reviewer is not assigned to the requested State territory.' });
          }
        } else if (userRole === 'district_manager') {
          if (!reviewerRole.includes('district') && reviewerRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Only the authorized District-level admin can review a District Manager request.' });
          }
          if (req.user.districtId && user.districtId && String(req.user.districtId) !== String(user.districtId)) {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Reviewer is not assigned to the requested District territory.' });
          }
        } else if (userRole === 'division_manager') {
          if (!reviewerRole.includes('division') && !reviewerRole.includes('divisional')) {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Only the authorized Division-level admin can review a Divisional Manager request.' });
          }
          if (req.user.divisionId && user.divisionId && String(req.user.divisionId) !== String(user.divisionId)) {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Reviewer is not assigned to the requested Division territory.' });
          }
        } else if (userRole === 'pincode_manager') {
          if (!reviewerRole.includes('pincode') && !reviewerRole.includes('pin_')) {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Only the authorized Pincode-level admin for this exact PIN code can review a Pincode Manager request.' });
          }
          if (req.user.pincodeId && user.pincodeId && String(req.user.pincodeId) !== String(user.pincodeId)) {
            return res.status(403).json({ success: false, message: 'Jurisdiction Violation: Reviewer is not assigned to the requested PIN code territory.' });
          }
        }
      }
    }

    const reviewerId = req.user?.id || req.user?._id || 'subadmin_reviewer';
    const reviewerName = req.user?.name || req.body.reviewerName || 'Sub-Admin Reviewer';
    const reviewerRole = req.user?.role || req.body.reviewerRole || 'Sub-Admin';
    const now = new Date().toISOString();

    if (normalizedAction === 'reject') {
      const reason = rejectionReason ? String(rejectionReason).trim() : '';
      if (!reason) {
        return res.status(400).json({ success: false, message: 'A rejection reason is strictly mandatory when rejecting a manager request.' });
      }

      await db.users.findByIdAndUpdate(user._id, {
        status: 'REJECTED_BY_SUB_ADMIN',
        overallRegistrationStatus: 'REJECTED_BY_SUB_ADMIN',
        subAdminApprovalStatus: 'rejected',
        adminApprovalStatus: 'rejected',
        rejectionReason: reason,
        subadminRejectedBy: reviewerId,
        subadminRejectedByName: reviewerName,
        subadminRejectedByRole: reviewerRole,
        subadminRejectedAt: now,
        routingQueue: 'REJECTED',
        rejectedAt: now,
        isApproved: false,
        isActive: false
      });
      const updatedUser = await db.users.findById(user._id);

      if (db.managerrequests) {
        await db.managerrequests.updateOne(
          { $or: [{ userId: String(user._id) }, { email: user.email }] },
          {
            $set: {
              status: 'Rejected',
              approvalStage: 'rejected',
              subAdminApprovalStatus: 'rejected',
              overallRegistrationStatus: 'REJECTED_BY_SUB_ADMIN',
              rejectionReason: reason,
              reviewedBy: reviewerId,
              reviewedAt: now
            }
          }
        ).catch(() => {});
      }

      await db.auditLogs.insertOne({
        action: 'SUB_ADMIN_APPROVAL_REJECTED',
        userId: updatedUser._id,
        userName: updatedUser.name,
        userRole: updatedUser.role,
        details: `Sub-admin (${reviewerName}, ${reviewerRole}) rejected registration for ${updatedUser.name} (${updatedUser.role}). Reason: ${reason}`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      });

      return res.json({
        success: true,
        status: 'REJECTED_BY_SUB_ADMIN',
        overallRegistrationStatus: 'REJECTED_BY_SUB_ADMIN',
        subAdminApprovalStatus: 'rejected',
        isApproved: false,
        rejectionReason: reason,
        message: `Registration rejected by Sub-admin: ${reason}`,
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          overallRegistrationStatus: updatedUser.overallRegistrationStatus,
          subAdminApprovalStatus: updatedUser.subAdminApprovalStatus,
          adminApprovalStatus: 'rejected',
          rejectionReason: reason,
          subadminRejectedByName: reviewerName,
          subadminRejectedAt: now
        }
      });
    }

    // Action: Approve -> Transition to PENDING_MAIN_ADMIN_APPROVAL
    await db.users.findByIdAndUpdate(user._id, {
      status: 'PENDING_MAIN_ADMIN_APPROVAL',
      overallRegistrationStatus: 'PENDING_MAIN_ADMIN_APPROVAL',
      subAdminApprovalStatus: 'approved',
      mainAdminApprovalStatus: 'pending',
      kycVerificationStatus: 'not_started',
      adminApprovalStatus: 'approved',
      approvalStage: 'mainadmin_review',
      subadminApprovedBy: reviewerId,
      subadminApprovedByName: reviewerName,
      subadminApprovedByRole: reviewerRole,
      subadminApprovedAt: now,
      adminApprovedAt: now,
      routingQueue: 'MAIN_ADMIN_APPROVAL_QUEUE',
      isApproved: false,
      isActive: false
    });
    if (db.managers) {
      await db.managers.findByIdAndUpdate(user._id, {
        status: 'PENDING_MAIN_ADMIN_APPROVAL',
        overallRegistrationStatus: 'PENDING_MAIN_ADMIN_APPROVAL',
        subAdminApprovalStatus: 'approved',
        mainAdminApprovalStatus: 'pending',
        kycVerificationStatus: 'not_started',
        adminApprovalStatus: 'approved',
        approvalStage: 'mainadmin_review',
        subadminApprovedBy: reviewerId,
        subadminApprovedByName: reviewerName,
        subadminApprovedByRole: reviewerRole,
        subadminApprovedAt: now,
        adminApprovedAt: now,
        routingQueue: 'MAIN_ADMIN_APPROVAL_QUEUE',
        isApproved: false,
        isActive: false
      }).catch(() => {});
    }
    const updatedUser = await db.users.findById(user._id);

    // Sync to managerrequests collection for Main Admin portal
    if (db.managerrequests) {
      await db.managerrequests.updateOne(
        { $or: [{ userId: String(user._id) }, { email: user.email }] },
        {
          $set: {
            status: 'Pending',
            approvalStage: 'mainadmin_review',
            subAdminApprovalStatus: 'approved',
            mainAdminApprovalStatus: 'pending',
            overallRegistrationStatus: 'PENDING_MAIN_ADMIN_APPROVAL',
            subadminApprovedBy: reviewerId,
            subadminApprovedByName: reviewerName,
            subadminApprovedAt: now
          }
        }
      ).catch(() => {});
    }

    // Notify Main Admin
    try {
      await db.notifications.insertOne({
        title: 'Manager Registration Ready for Main Admin Clearance',
        message: `Sub-admin territorial approval granted by ${reviewerName} (${reviewerRole}) for ${updatedUser.name} (${updatedUser.role}). Pending Main Admin review.`,
        category: 'main_admin_approval',
        type: 'main_admin_request',
        read: false,
        isRead: false,
        priority: 'high',
        recordId: updatedUser._id,
        createdAt: now
      });
    } catch (notifErr) {
      console.warn('Could not dispatch Main Admin notification:', notifErr.message);
    }

    await db.auditLogs.insertOne({
      action: 'SUB_ADMIN_APPROVAL_GRANTED',
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      details: `Sub-admin (${reviewerName}, ${reviewerRole}) approved registration for ${updatedUser.name} (${updatedUser.role}). Status transitioned to PENDING_MAIN_ADMIN_APPROVAL.`,
      ip: req.ip || '127.0.0.1',
      timestamp: now
    });

    res.json({
      success: true,
      status: 'PENDING_MAIN_ADMIN_APPROVAL',
      overallRegistrationStatus: 'PENDING_MAIN_ADMIN_APPROVAL',
      subAdminApprovalStatus: 'approved',
      mainAdminApprovalStatus: 'pending',
      kycVerificationStatus: 'not_started',
      isApproved: false,
      message: 'Sub-admin territorial approval granted! Application is now in PENDING_MAIN_ADMIN_APPROVAL status awaiting Main Admin clearance.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        level: updatedUser.level,
        status: updatedUser.status,
        overallRegistrationStatus: updatedUser.overallRegistrationStatus,
        subAdminApprovalStatus: 'approved',
        mainAdminApprovalStatus: 'pending',
        kycVerificationStatus: 'not_started',
        adminApprovalStatus: 'approved',
        routingQueue: 'MAIN_ADMIN_APPROVAL_QUEUE',
        subadminApprovedByName: reviewerName,
        subadminApprovedAt: now
      }
    });
  } catch (err) {
    console.error('Sub-admin approval error:', err);
    res.status(500).json({ success: false, message: 'Failed to process Sub-admin approval' });
  }
};

// Step 2B: Main Admin Approval Workflow (Stage B: Approve or Reject)
const mainAdminApproval = async (req, res) => {
  try {
    const { userId, action, rejectionReason } = req.body;
    const targetId = userId || req.body.id || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Manager User ID is required.' });
    }

    const normalizedAction = String(action || 'approve').toLowerCase().trim();
    if (!['approve', 'reject'].includes(normalizedAction)) {
      return res.status(400).json({ success: false, message: "Action must be either 'approve' or 'reject'." });
    }

    // Disallow applicants from self-approving their own registration
    if (req.user && String(req.user.id || req.user._id) === String(targetId)) {
      return res.status(403).json({ success: false, message: 'Security Violation: Applicants cannot approve or modify their own registration status.' });
    }

    // Disallow manager roles from approving registrations
    if (req.user && ALLOWED_MANAGER_ROLES.includes(String(req.user.role).toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Security Violation: Manager accounts do not have permission to approve registrations.' });
    }

    let user = (await db.users.findById(targetId)) || (await db.managers.findById(targetId));
    if (!user) {
      user = (await db.users.findOne({ managerId: targetId })) || (await db.managers.findOne({ managerId: targetId }));
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Manager account not found.' });
    }

    // Disallow modifying administrative accounts
    if (['admin', 'super_admin', 'super-admin'].includes(String(user.role).toLowerCase()) || user.email === 'admin@example.com') {
      return res.status(403).json({ success: false, message: 'Administrative accounts cannot be modified via approval endpoints.' });
    }

    // CRITICAL PREREQUISITE: Sub-admin approval MUST be completed first!
    const isSubAdminApproved = user.subAdminApprovalStatus === 'approved' || 
      user.status === 'PENDING_MAIN_ADMIN_APPROVAL' ||
      (user.adminApprovalStatus === 'approved' && user.status !== 'PENDING_SUB_ADMIN_APPROVAL');

    if (!isSubAdminApproved) {
      return res.status(400).json({
        success: false,
        code: 'SUBADMIN_APPROVAL_REQUIRED',
        message: 'Pre-requisite violation: Sub-admin territorial approval must be completed before Main Admin approval can be processed.'
      });
    }

    const adminId = req.user?.id || req.user?._id || 'main_admin';
    const adminName = req.user?.name || req.body.adminName || 'Main Administrator';
    const now = new Date().toISOString();

    if (normalizedAction === 'reject') {
      const reason = rejectionReason ? String(rejectionReason).trim() : '';
      if (!reason) {
        return res.status(400).json({ success: false, message: 'A rejection reason is strictly mandatory when rejecting a manager request.' });
      }

      await db.users.findByIdAndUpdate(user._id, {
        status: 'REJECTED_BY_MAIN_ADMIN',
        overallRegistrationStatus: 'REJECTED_BY_MAIN_ADMIN',
        mainAdminApprovalStatus: 'rejected',
        rejectionReason: reason,
        mainAdminRejectedBy: adminId,
        mainAdminRejectedByName: adminName,
        mainAdminRejectedAt: now,
        routingQueue: 'REJECTED',
        rejectedAt: now,
        isApproved: false,
        isActive: false
      });
      const updatedUser = await db.users.findById(user._id);

      if (db.managerrequests) {
        await db.managerrequests.updateOne(
          { $or: [{ userId: String(user._id) }, { email: user.email }] },
          {
            $set: {
              status: 'Rejected',
              approvalStage: 'rejected',
              mainAdminApprovalStatus: 'rejected',
              overallRegistrationStatus: 'REJECTED_BY_MAIN_ADMIN',
              rejectionReason: reason,
              reviewedBy: adminId,
              reviewedAt: now
            }
          }
        ).catch(() => {});
      }

      await db.auditLogs.insertOne({
        action: 'MAIN_ADMIN_APPROVAL_REJECTED',
        userId: updatedUser._id,
        userName: updatedUser.name,
        userRole: updatedUser.role,
        details: `Main Admin (${adminName}) rejected registration for ${updatedUser.name} (${updatedUser.role}). Reason: ${reason}`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      });

      return res.json({
        success: true,
        status: 'REJECTED_BY_MAIN_ADMIN',
        overallRegistrationStatus: 'REJECTED_BY_MAIN_ADMIN',
        mainAdminApprovalStatus: 'rejected',
        isApproved: false,
        rejectionReason: reason,
        message: `Registration rejected by Main Admin: ${reason}`,
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          overallRegistrationStatus: updatedUser.overallRegistrationStatus,
          subAdminApprovalStatus: updatedUser.subAdminApprovalStatus,
          mainAdminApprovalStatus: 'rejected',
          rejectionReason: reason,
          mainAdminRejectedByName: adminName,
          mainAdminRejectedAt: now
        }
      });
    }

    // Action: Approve -> Transition to PENDING_KYC_VERIFICATION
    await db.users.findByIdAndUpdate(user._id, {
      status: 'PENDING_KYC_VERIFICATION',
      overallRegistrationStatus: 'PENDING_KYC_VERIFICATION',
      subAdminApprovalStatus: 'approved',
      mainAdminApprovalStatus: 'approved',
      kycVerificationStatus: 'pending',
      kycStatus: 'pending_verification',
      approvalStage: 'kyc_review',
      mainAdminApprovedBy: adminId,
      mainAdminApprovedByName: adminName,
      mainAdminApprovedAt: now,
      routingQueue: 'KYC_APPROVAL_QUEUE',
      isApproved: false,
      isActive: false
    });
    const updatedUser = await db.users.findById(user._id);

    // Sync to managerrequests
    if (db.managerrequests) {
      await db.managerrequests.updateOne(
        { $or: [{ userId: String(user._id) }, { email: user.email }] },
        {
          $set: {
            status: 'Pending',
            approvalStage: 'kyc_review',
            subAdminApprovalStatus: 'approved',
            mainAdminApprovalStatus: 'approved',
            kycVerificationStatus: 'pending',
            overallRegistrationStatus: 'PENDING_KYC_VERIFICATION',
            mainAdminApprovedBy: adminId,
            mainAdminApprovedByName: adminName,
            mainAdminApprovedAt: now
          }
        }
      ).catch(() => {});
    }

    // Add to kycRecords collection for KYC Team
    if (db.kycRecords) {
      const mgrIdStr = String(updatedUser._id || updatedUser.id);
      const kycId = `KYC-MGR-${mgrIdStr}`;
      const existing = await db.kycRecords.findOne({ $or: [{ _id: kycId }, { id: kycId }, { managerId: mgrIdStr }] });
      if (!existing) {
        await db.kycRecords.insertOne({
          _id: kycId,
          id: kycId,
          type: 'Manager',
          managerId: mgrIdStr,
          name: updatedUser.name,
          vendorName: updatedUser.name,
          category: 'Operations Management',
          role: updatedUser.role,
          phone: updatedUser.mobile || updatedUser.phone,
          email: updatedUser.email,
          state: updatedUser.state,
          district: updatedUser.district,
          division: updatedUser.division,
          pincode: updatedUser.pincode,
          stateId: updatedUser.stateId,
          districtId: updatedUser.districtId,
          divisionId: updatedUser.divisionId,
          pincodeId: updatedUser.pincodeId,
          status: 'Pending',
          kycStatus: 'Pending Verification',
          submittedDate: (updatedUser.createdAt || now).split('T')[0],
          documents: updatedUser.documents || {},
          notes: `Sub-admin (${updatedUser.subadminApprovedByName || 'Sub-Admin'}) & Main Admin (${adminName}) approvals completed. Forwarded to KYC Team.`,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Notify KYC Team
    try {
      await db.notifications.insertOne({
        title: 'Manager Registration Ready for KYC Clearance',
        message: `Both Sub-admin and Main Admin approvals granted for ${updatedUser.name} (${updatedUser.role}). Documents are queued for KYC compliance verification.`,
        category: 'kyc_approval',
        type: 'kyc_request',
        read: false,
        isRead: false,
        priority: 'high',
        recordId: updatedUser._id,
        createdAt: now
      });
    } catch (notifErr) {
      console.warn('Could not dispatch KYC notification:', notifErr.message);
    }

    await db.auditLogs.insertOne({
      action: 'MAIN_ADMIN_APPROVAL_GRANTED',
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      details: `Main Admin (${adminName}) approved registration for ${updatedUser.name} (${updatedUser.role}). Status transitioned to PENDING_KYC_VERIFICATION.`,
      ip: req.ip || '127.0.0.1',
      timestamp: now
    });

    res.json({
      success: true,
      status: 'PENDING_KYC_VERIFICATION',
      overallRegistrationStatus: 'PENDING_KYC_VERIFICATION',
      subAdminApprovalStatus: 'approved',
      mainAdminApprovalStatus: 'approved',
      kycVerificationStatus: 'pending',
      isApproved: false,
      message: 'Main Admin approval granted! Application is now in PENDING_KYC_VERIFICATION status awaiting KYC Team compliance clearance.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        level: updatedUser.level,
        status: updatedUser.status,
        overallRegistrationStatus: updatedUser.overallRegistrationStatus,
        subAdminApprovalStatus: 'approved',
        mainAdminApprovalStatus: 'approved',
        kycVerificationStatus: 'pending',
        routingQueue: 'KYC_APPROVAL_QUEUE',
        mainAdminApprovedByName: adminName,
        mainAdminApprovedAt: now
      }
    });
  } catch (err) {
    console.error('Main Admin approval error:', err);
    res.status(500).json({ success: false, message: 'Failed to process Main Admin approval' });
  }
};

// Step 3: KYC Team Approval Workflow (Stage C: Approve or Reject)
const kycApproval = async (req, res) => {
  try {
    const { userId, action, rejectionReason } = req.body;
    const targetId = userId || req.body.id || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Manager User ID is required.' });
    }

    const normalizedAction = String(action || 'approve').toLowerCase().trim();
    if (!['approve', 'reject'].includes(normalizedAction)) {
      return res.status(400).json({ success: false, message: "Action must be either 'approve' or 'reject'." });
    }

    // Disallow applicants from self-approving their own registration
    if (req.user && String(req.user.id || req.user._id) === String(targetId)) {
      return res.status(403).json({ success: false, message: 'Security Violation: Applicants cannot approve or modify their own registration status.' });
    }

    // Disallow manager roles from approving registrations
    if (req.user && ALLOWED_MANAGER_ROLES.includes(String(req.user.role).toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Security Violation: Manager accounts do not have permission to approve registrations.' });
    }

    let user = (await db.users.findById(targetId)) || (await db.managers.findById(targetId));
    if (!user) {
      user = (await db.users.findOne({ managerId: targetId })) || (await db.managers.findOne({ managerId: targetId }));
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Manager account not found.' });
    }

    // Disallow modifying administrative accounts
    if (['admin', 'super_admin', 'super-admin'].includes(String(user.role).toLowerCase()) || user.email === 'admin@example.com') {
      return res.status(403).json({ success: false, message: 'Administrative accounts cannot be modified via approval endpoints.' });
    }

    // CRITICAL PREREQUISITE: Sub-admin AND Main Admin approvals MUST BOTH be completed first!
    const isSubAdminApproved = user.subAdminApprovalStatus === 'approved' || user.adminApprovalStatus === 'approved';
    const isMainAdminApproved = user.mainAdminApprovalStatus === 'approved' || user.status === 'PENDING_KYC_VERIFICATION' || user.status === 'PENDING_KYC_APPROVAL';

    if (!isSubAdminApproved || !isMainAdminApproved) {
      return res.status(400).json({
        success: false,
        message: 'Pre-requisite violation: Both Sub-admin approval and Main Admin approval must be completed before KYC approval can be processed.'
      });
    }

    const reviewerName = req.user?.name || req.body.reviewerName || 'KYC Compliance Officer';
    const now = new Date().toISOString();

    if (normalizedAction === 'reject') {
      const reason = rejectionReason ? String(rejectionReason).trim() : 'KYC document verification failed.';
      await db.users.findByIdAndUpdate(user._id, {
        status: 'KYC_REJECTED',
        overallRegistrationStatus: 'KYC_REJECTED',
        kycVerificationStatus: 'rejected',
        kycStatus: 'rejected',
        rejectionReason: reason,
        kycRejectedBy: reviewerName,
        kycRejectedAt: now,
        routingQueue: 'REJECTED',
        rejectedAt: now,
        isApproved: false,
        isActive: false
      });
      const updatedUser = await db.users.findById(user._id);

      if (db.kycRecords) {
        const mgrIdStr = String(user._id || user.id);
        await db.kycRecords.updateOne(
          { $or: [{ managerId: mgrIdStr }, { id: `KYC-MGR-${mgrIdStr}` }] },
          { $set: { status: 'Rejected', kycStatus: 'Rejected', rejectionReason: reason, updatedAt: now } }
        ).catch(() => {});
      }

      await db.auditLogs.insertOne({
        action: 'KYC_VERIFICATION_REJECTED',
        userId: updatedUser._id,
        userName: updatedUser.name,
        userRole: updatedUser.role,
        details: `KYC team rejected documents for ${updatedUser.name} (${updatedUser.role}). Reason: ${reason}`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      });

      return res.json({
        success: true,
        status: 'KYC_REJECTED',
        overallRegistrationStatus: 'KYC_REJECTED',
        kycVerificationStatus: 'rejected',
        isApproved: false,
        rejectionReason: reason,
        message: `KYC document verification rejected: ${reason}`,
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          overallRegistrationStatus: updatedUser.overallRegistrationStatus,
          subAdminApprovalStatus: updatedUser.subAdminApprovalStatus,
          mainAdminApprovalStatus: updatedUser.mainAdminApprovalStatus,
          kycVerificationStatus: 'rejected',
          kycStatus: 'rejected',
          rejectionReason: reason
        }
      });
    }

    // Action: Approve -> Transition to active (ALL 3 mandatory approvals completed!)
    await db.users.findByIdAndUpdate(user._id, {
      status: 'active',
      overallRegistrationStatus: 'active',
      subAdminApprovalStatus: 'approved',
      mainAdminApprovalStatus: 'approved',
      kycVerificationStatus: 'approved',
      kycStatus: 'verified',
      kycVerifiedAt: now,
      kycVerifiedBy: reviewerName,
      approvalStage: 'approved',
      routingQueue: 'ACTIVE_MANAGERS',
      isApproved: true,
      isActive: true
    });
    const updatedUser = await db.users.findById(user._id);

    if (db.kycRecords) {
      const mgrIdStr = String(user._id || user.id);
      await db.kycRecords.updateOne(
        { $or: [{ managerId: mgrIdStr }, { id: `KYC-MGR-${mgrIdStr}` }] },
        { $set: { status: 'Verified', kycStatus: 'Verified', verifiedBy: reviewerName, verifiedDate: now.split('T')[0], updatedAt: now } }
      ).catch(() => {});
    }

    if (db.managers) {
      await db.managers.findByIdAndUpdate(user._id, {
        status: 'active',
        overallRegistrationStatus: 'active',
        isApproved: true,
        isActive: true,
        kycStatus: 'verified'
      }).catch(() => {});
    }

    // Notify Manager
    try {
      await db.notifications.insertOne({
        receiver: updatedUser._id,
        userId: updatedUser._id,
        title: 'Manager Account Fully Activated',
        message: 'All mandatory onboarding approvals (Sub-admin, Main Admin, and KYC Compliance) are complete! Your manager dashboard access is now unlocked.',
        category: 'account_activation',
        type: 'account_activation',
        read: false,
        isRead: false,
        priority: 'high',
        createdAt: now
      });
    } catch (notifErr) {}

    await db.auditLogs.insertOne({
      action: 'MANAGER_FULLY_ACTIVATED',
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      details: `Manager account fully activated for ${updatedUser.name} (${updatedUser.role}). Sub-admin, Main Admin, and KYC approvals verified. Dashboard access unlocked.`,
      ip: req.ip || '127.0.0.1',
      timestamp: now
    });

    const tokenPayload = {
      id: updatedUser._id,
      managerId: updatedUser.managerId,
      role: updatedUser.role,
      level: updatedUser.level,
      status: 'active',
      stateId: updatedUser.stateId,
      districtId: updatedUser.districtId,
      divisionId: updatedUser.divisionId,
      pincodeId: updatedUser.pincodeId
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      status: 'active',
      overallRegistrationStatus: 'active',
      subAdminApprovalStatus: 'approved',
      mainAdminApprovalStatus: 'approved',
      kycVerificationStatus: 'approved',
      isApproved: true,
      isActive: true,
      message: 'KYC verified successfully! All approvals completed. Manager account is fully active and dashboard access is enabled.',
      token,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        level: updatedUser.level,
        status: 'active',
        overallRegistrationStatus: 'active',
        subAdminApprovalStatus: 'approved',
        mainAdminApprovalStatus: 'approved',
        kycVerificationStatus: 'approved',
        isApproved: true,
        isActive: true,
        kycStatus: 'verified'
      }
    });
  } catch (err) {
    console.error('KYC approval error:', err);
    res.status(500).json({ success: false, message: 'Failed to process KYC approval' });
  }
};

// Sync Admin Master Territory Hierarchy into Manager Portal Collections
// Uses short timeouts so a dead local port fails in <2s instead of hanging for minutes.
async function syncAdminMasterTerritories() {
  const endpoints = [
    'http://127.0.0.1:8004/api/territory/hierarchy',
    'http://localhost:8004/api/territory/hierarchy',
    'https://api.ficapp.in/api/territory/hierarchy'
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // Fail fast after 1.5s
      let res;
      try {
        res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (res.ok) {
        const json = await res.json();
        const hierarchy = json.hierarchy || json.states || [];
        if (hierarchy && Array.isArray(hierarchy) && hierarchy.length > 0) {
          const activeStates = [];
          const activeDistricts = [];
          const activeDivisions = [];
          const activePincodes = [];

          hierarchy.forEach(st => {
            if (!st || !st.name) return;
            const stateId = String(st._id || st.id);
            activeStates.push({
              _id: stateId,
              id: stateId,
              name: st.name.trim(),
              code: st.code || st.name.slice(0, 2).toUpperCase(),
              status: 'Active'
            });

            (st.districts || []).forEach(dt => {
              if (!dt || !dt.name) return;
              const distId = String(dt._id || dt.id);
              activeDistricts.push({
                _id: distId,
                id: distId,
                name: dt.name.trim(),
                code: dt.code || dt.name.slice(0, 3).toUpperCase(),
                stateId: stateId,
                status: 'Active'
              });

              (dt.divisions || []).forEach(dv => {
                if (!dv || !dv.name) return;
                const divId = String(dv._id || dv.id);
                activeDivisions.push({
                  _id: divId,
                  id: divId,
                  name: dv.name.trim(),
                  code: dv.code || dv.name.slice(0, 3).toUpperCase(),
                  districtId: distId,
                  stateId: stateId,
                  status: 'Active'
                });

                (dv.pincodes || []).forEach(p => {
                  const code = typeof p === 'string' ? p : (p.code || p.pincode);
                  if (code) {
                    const pinId = String(p._id || p.id || code);
                    activePincodes.push({
                      _id: pinId,
                      id: pinId,
                      code: String(code).trim(),
                      name: p.name || p.postOffice || ('PIN ' + code),
                      divisionId: divId,
                      districtId: distId,
                      stateId: stateId,
                      status: 'Active'
                    });
                  }
                });
              });
            });
          });

          if (activeStates.length > 0) {
            await db.states.clear();
            await db.states.insertMany(activeStates);

            await db.districts.clear();
            await db.districts.insertMany(activeDistricts);

            await db.divisions.clear();
            await db.divisions.insertMany(activeDivisions);

            await db.pincodes.clear();
            await db.pincodes.insertMany(activePincodes);

            return { states: activeStates, districts: activeDistricts, divisions: activeDivisions, pincodes: activePincodes };
          }
        }
      }
    } catch (e) {
      // try next endpoint
    }
  }
  return null;
}

const getRegistrationLocations = async (req, res) => {
  try {
    // Only block on sync if no states exist at all; otherwise serve from DB immediately
    // and trigger sync in background for freshness.
    const existingStatesCount = (await db.states.find({ status: 'Active' })).length;
    if (existingStatesCount === 0) {
      // First-time or empty DB: attempt sync (will fail fast with 1.5s timeout per endpoint)
      try { await syncAdminMasterTerritories(); } catch (e) { /* ignore */ }
    } else {
      // Background refresh — does NOT block the response
      setImmediate(() => syncAdminMasterTerritories().catch(() => {}));
    }

    const states = await db.states.find({ status: 'Active' });
    const districts = await db.districts.find({ status: 'Active' });
    const divisions = await db.divisions.find({ status: 'Active' });
    const pincodes = await db.pincodes.find({ status: 'Active' });
    const users = await db.users.find();

    const activeOrPending = users.filter(u => u.status === 'active' || u.status === 'under_review' || u.status === 'kyc_pending');

    // Enrich with counts
    const enrichedStates = states.map(s => {
      const count = activeOrPending.filter(u => u.role === 'state_manager' && u.stateId === s._id).length;
      return { ...s, managerCount: count, limit: ROLE_LIMITS.state_manager, isFull: count >= ROLE_LIMITS.state_manager };
    });

    const enrichedDistricts = districts.map(d => {
      const count = activeOrPending.filter(u => u.role === 'district_manager' && u.districtId === d._id).length;
      return { ...d, managerCount: count, limit: ROLE_LIMITS.district_manager, isFull: count >= ROLE_LIMITS.district_manager };
    });

    const enrichedDivisions = divisions.map(v => {
      const count = activeOrPending.filter(u => u.role === 'division_manager' && u.divisionId === v._id).length;
      return { ...v, managerCount: count, limit: ROLE_LIMITS.division_manager, isFull: count >= ROLE_LIMITS.division_manager };
    });

    const enrichedPincodes = pincodes.map(p => {
      const count = activeOrPending.filter(u => u.role === 'pincode_manager' && u.pincodeId === p._id).length;
      return { ...p, managerCount: count, limit: ROLE_LIMITS.pincode_manager, isFull: count >= ROLE_LIMITS.pincode_manager };
    });

    res.json({
      success: true,
      states: enrichedStates,
      districts: enrichedDistricts,
      divisions: enrichedDivisions,
      pincodes: enrichedPincodes,
      roleLimits: ROLE_LIMITS
    });
  } catch (err) {
    console.error('Get registration locations error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve location data' });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : (req.files && typeof req.files === 'object' ? Object.values(req.files).flat()[0] : null));
    if (!file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const fileUrl = `/uploads/${file.filename}`;

    // If caller provided token in Authorization header, also persist avatarUrl to their account
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) {
          await db.users.findByIdAndUpdate(decoded.id, { avatarUrl: fileUrl }).catch(() => {});
          if (db.managers) {
            await db.managers.findByIdAndUpdate(decoded.id, { avatarUrl: fileUrl }).catch(() => {});
          }
        }
      } catch (e) {}
    }

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      avatarUrl: fileUrl,
      file: {
        name: file.originalname,
        filename: file.filename,
        url: fileUrl,
        size: file.size
      }
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ success: false, message: 'Avatar upload failed' });
  }
};

const updateProfilePhoto = async (req, res) => {
  try {
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : (req.files && typeof req.files === 'object' ? Object.values(req.files).flat()[0] : null));
    if (!file) {
      return res.status(400).json({ success: false, message: 'Please select a valid image file to upload.' });
    }

    if (req.files && req.files.length > 1) {
      for (let i = 1; i < req.files.length; i++) {
        try {
          if (req.files[i]?.path && fs.existsSync(req.files[i].path)) {
            fs.unlinkSync(req.files[i].path);
          }
        } catch (_) {}
      }
    }

    const fileUrl = `/uploads/${file.filename}`;
    const userId = req.user?.id || req.user?._id;

    let updatedUser = null;
    if (userId) {
      // Update in users collection
      updatedUser = await db.users.findByIdAndUpdate(userId, { avatarUrl: fileUrl });
      if (!updatedUser && db.managers) {
        updatedUser = await db.managers.findByIdAndUpdate(userId, { avatarUrl: fileUrl });
      } else if (db.managers) {
        await db.managers.findByIdAndUpdate(userId, { avatarUrl: fileUrl }).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      avatarUrl: fileUrl,
      user: {
        ...(updatedUser || req.user || {}),
        avatarUrl: fileUrl
      }
    });
  } catch (err) {
    console.error('Update profile photo error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile photo.' });
  }
};

const removeProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let existingUser = await db.users.findById(userId);
    if (!existingUser && db.managers) {
      existingUser = await db.managers.findById(userId);
    }

    const currentPhoto = existingUser?.avatarUrl || existingUser?.avatar || existingUser?.profilePhoto || existingUser?.image || null;

    // Safely remove the physical file from uploads folder if it's a locally stored upload
    if (currentPhoto && typeof currentPhoto === 'string' && currentPhoto.startsWith('/uploads/')) {
      try {
        const filename = path.basename(currentPhoto);
        const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.warn('Could not delete old profile photo file:', fileErr.message);
      }
    }

    const clearPhotoUpdate = {
      avatarUrl: null,
      avatar: null,
      profilePhoto: null,
      image: null
    };

    let updatedUser = await db.users.findByIdAndUpdate(userId, clearPhotoUpdate);
    if (!updatedUser && db.managers) {
      updatedUser = await db.managers.findByIdAndUpdate(userId, clearPhotoUpdate);
    } else if (db.managers) {
      await db.managers.findByIdAndUpdate(userId, clearPhotoUpdate).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Profile photo removed successfully',
      avatarUrl: null,
      user: {
        ...(updatedUser || req.user),
        avatarUrl: null,
        avatar: null,
        profilePhoto: null,
        image: null
      }
    });
  } catch (err) {
    console.error('Remove profile photo error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove profile photo.' });
  }
};

const getMe = async (req, res) => {
  try {
    let user = await db.users.findById(req.user.id);
    if (!user) {
      user = await db.managers.findById(req.user.id);
    }
    if (!user) {
      user = req.user;
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    const stateId = user.stateId || user.assignedStateId || user.scope?.stateId || req.user?.stateId || null;
    let stateName = user.state || user.stateName || user.assignedState || user.scope?.stateName || req.user?.stateName || req.user?.state || null;

    const districtId = user.districtId || user.assignedDistrictId || user.scope?.districtId || req.user?.districtId || null;
    let districtName = user.district || user.districtName || user.assignedDistrict || user.scope?.districtName || req.user?.districtName || req.user?.district || null;

    const divisionId = user.divisionId || user.assignedDivisionId || user.scope?.divisionId || req.user?.divisionId || null;
    let divisionName = user.division || user.divisionName || user.assignedDivision || user.scope?.divisionName || req.user?.divisionName || req.user?.division || null;

    let pincodeId = user.pincodeId || user.assignedPincodeId || user.scope?.pincodeId || req.user?.pincodeId || null;
    let pincodeCode = user.pincode || user.pincodeCode || user.assignedPincode || user.scope?.pincodeCode || req.user?.pincodeCode || req.user?.pincode || null;
    let pincodeArea = user.area || user.pincodeArea || user.scope?.pincodeArea || req.user?.pincodeArea || null;

    // Resolve pincode if needed
    if (pincodeCode) {
      const pinObj = (await db.pincodes.findOne({ code: pincodeCode })) || (await db.pincodes.findById(pincodeCode));
      if (pinObj) {
        if (!pincodeId) pincodeId = pinObj._id || pinObj.id || pinObj.pincodeId;
        if (!pincodeArea) pincodeArea = pinObj.area || pinObj.name || pinObj.areaName || null;
        if (!divisionName && pinObj.division) divisionName = pinObj.division;
        if (!districtName && pinObj.district) districtName = pinObj.district;
        if (!stateName && pinObj.state) stateName = pinObj.state;
      }
    } else if (pincodeId) {
      const pinObj = (await db.pincodes.findById(pincodeId)) || (await db.pincodes.findOne({ _id: pincodeId })) || (await db.pincodes.findOne({ code: pincodeId }));
      if (pinObj) {
        pincodeCode = String(pinObj.code || pinObj.pincode || '').trim() || null;
        if (!pincodeArea) pincodeArea = pinObj.area || pinObj.name || pinObj.areaName || null;
        if (!divisionName && pinObj.division) divisionName = pinObj.division;
        if (!districtName && pinObj.district) districtName = pinObj.district;
        if (!stateName && pinObj.state) stateName = pinObj.state;
      }
    }

    if (!divisionName && divisionId) {
      const divObj = await db.divisions.findById(divisionId);
      if (divObj) divisionName = divObj.name;
    }
    if (!districtName && districtId) {
      const distObj = await db.districts.findById(districtId);
      if (distObj) districtName = distObj.name;
    }
    if (!stateName && stateId) {
      const stateObj = await db.states.findById(stateId);
      if (stateObj) stateName = stateObj.name;
    }

    const rolePrefix = user.role === 'state_manager' ? 'STM'
      : user.role === 'district_manager' ? 'DTM'
      : user.role === 'division_manager' ? 'DIV'
      : 'PIN';
    let managerId = user.managerId;
    if (!managerId) {
      managerId = `MGR-${rolePrefix}-${String(user._id || user.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
      try {
        await db.users.findByIdAndUpdate(user._id || user.id, { managerId });
      } catch (e) {
        console.warn('Could not persist managerId in getProfile:', e.message);
      }
    }

    res.json({
      success: true,
      user: {
        id: user._id || user.id,
        _id: user._id || user.id,
        managerId,
        name: user.name,
        email: user.email,
        mobile: user.mobile || user.phone,
        phone: user.phone || user.mobile,
        role: user.role,
        managerType: user.role,
        level: user.level,
        status: user.status,
        state: stateName,
        stateName: stateName,
        stateId: stateId,
        district: districtName,
        districtName: districtName,
        districtId: districtId,
        division: divisionName,
        divisionName: divisionName,
        divisionId: divisionId,
        pincode: pincodeCode,
        pincodeCode: pincodeCode,
        pincodeId: pincodeId,
        adminApprovalStatus: user.adminApprovalStatus || (['active', 'approved'].includes(String(user.status || '').toLowerCase()) ? 'approved' : 'pending'),
        kycStatus: user.kycStatus || (['active', 'approved'].includes(String(user.status || '').toLowerCase()) ? 'verified' : 'pending'),
        rejectionReason: user.rejectionReason || null,
        assignedSubAdminId: user.assignedSubAdminId || null,
        assignedSubAdminName: user.assignedSubAdminName || null,
        assignedSubAdminRole: user.assignedSubAdminRole || null,
        routingQueue: user.routingQueue || null,
        subAdminRoutingStatus: user.subAdminRoutingStatus || null,
        dob: user.dob || null,
        gender: user.gender || null,
        address: user.address || (user.residentialAddress ? [user.residentialAddress.doorNumberStreet, user.residentialAddress.villageTown, user.residentialAddress.taluk, user.residentialAddress.district, user.residentialAddress.state, user.residentialAddress.pincode].filter(Boolean).join(', ') : null),
        residentialAddress: user.residentialAddress || (typeof user.address === 'object' ? user.address : null),
        activeSince: user.activatedAt || user.approvedAt || user.adminApprovedAt || user.subAdminApprovedAt || (['active', 'approved'].includes(String(user.status || '').toLowerCase()) ? (user.updatedAt || user.createdAt) : null),
        passwordChangedAt: user.passwordChangedAt || null,
        aadharNumber: user.aadharNumber || user.documents?.aadharNumber || null,
        panNumber: user.panNumber || user.documents?.panNumber || null,
        documents: user.documents || {},
        avatarUrl: user.avatarUrl || null,
        bankDetails: await resolveUserBankDetails(user),
        territory: {
          state: stateName,
          stateId: stateId,
          district: user.role === 'state_manager' ? null : districtName,
          districtId: user.role === 'state_manager' ? null : districtId,
          division: (user.role === 'state_manager' || user.role === 'district_manager') ? null : divisionName,
          divisionId: (user.role === 'state_manager' || user.role === 'district_manager') ? null : divisionId,
          pincode: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : pincodeCode,
          pincodeId: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : pincodeId,
          pincodeCode: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : pincodeCode,
          area: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : pincodeArea
        },
        scope: {
          regionId: stateId,
          regionName: stateName,
          stateId: stateId,
          stateName: stateName,
          districtId: user.role === 'state_manager' ? null : districtId,
          districtName: user.role === 'state_manager' ? null : districtName,
          divisionId: (user.role === 'state_manager' || user.role === 'district_manager') ? null : divisionId,
          divisionName: (user.role === 'state_manager' || user.role === 'district_manager') ? null : divisionName,
          pincodeId: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : pincodeId,
          pincodeCode: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : pincodeCode,
          pincodeArea: (user.role === 'state_manager' || user.role === 'district_manager' || user.role === 'division_manager') ? null : pincodeArea
        }
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required.' });
    }

    const passErr = validatePassword(newPassword, true);
    if (passErr) {
      return res.status(400).json({ success: false, message: passErr });
    }

    const user = await db.users.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const passwordChangedAt = new Date().toISOString();
    await db.users.findByIdAndUpdate(user._id, { passwordHash, passwordChangedAt });
    if (db.managers) {
      await db.managers.findByIdAndUpdate(user._id, { passwordHash, passwordChangedAt }).catch(() => {});
    }

    res.json({ success: true, message: 'Password updated successfully.', passwordChangedAt });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const emailErr = validateEmail(email, true);
    if (emailErr) {
      return res.status(400).json({ success: false, message: emailErr });
    }

    const user = await db.users.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      // Prevent user enumeration by returning identical generic success message
      return res.json({
        success: true,
        message: 'If the email address exists in our system, a password reset link has been dispatched.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000).toISOString();

    await db.users.findByIdAndUpdate(user._id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires
    });

    // In production, token is dispatched via email/SMS, never returned in API response
    const responsePayload = {
      success: true,
      message: 'If the email address exists in our system, a password reset link has been dispatched.'
    };
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.devResetNotice = 'In non-production mode, resetToken generated successfully.';
    }

    res.json(responsePayload);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Failed to process forgot password request.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    const passErr = validatePassword(newPassword, true);
    if (passErr) {
      return res.status(400).json({ success: false, message: passErr });
    }

    const user = await db.users.findOne({ resetPasswordToken: token });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (new Date(user.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new link.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.users.findByIdAndUpdate(user._id, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    res.json({ success: true, message: 'Password reset successful. You may now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};


const uploadDocument = (req, res) => {
  try {
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : (req.files && typeof req.files === 'object' ? Object.values(req.files).flat()[0] : null));
    if (!file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded.' });
    }

    if (req.files && req.files.length > 1) {
      for (let i = 1; i < req.files.length; i++) {
        try {
          if (req.files[i]?.path && fs.existsSync(req.files[i].path)) {
            fs.unlinkSync(req.files[i].path);
          }
        } catch (_) {}
      }
    }

    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/pjpeg', 'image/png', 'image/webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (!allowedExts.includes(ext) || !allowedMimes.includes(mime)) {
      try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Invalid document format. Only PDF, JPG, PNG, and WEBP files are allowed.'
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Document size must not exceed 5MB.'
      });
    }

    const fileUrl = `/uploads/${file.filename}`;
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      file: {
        name: file.originalname,
        filename: file.filename,
        url: fileUrl,
        size: file.size,
        type: file.mimetype
      }
    });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, message: 'Document upload failed' });
  }
};

const managerOtpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown between resends

const sendOtp = async (req, res) => {
  try {
    const rawMobile = (req.body.mobile || req.body.phone || req.body.mobileNumber || '').toString().trim();
    if (!rawMobile || !/^[6-9][0-9]{9}$/.test(rawMobile)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit Indian mobile number.' });
    }

    let user = (await db.users.findOne({ mobile: rawMobile, role: { $in: ALLOWED_MANAGER_ROLES } })) ||
               (await db.managers.findOne({ mobile: rawMobile, role: { $in: ALLOWED_MANAGER_ROLES } }));

    if (!user) {
      const crossRoleUser = (await db.users.findOne({ mobile: rawMobile })) || (await db.managers.findOne({ mobile: rawMobile }));
      if (crossRoleUser) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_NOT_AUTHORIZED',
          message: `Access denied. The account associated with this mobile number has the role '${crossRoleUser.role}', which is not authorized for the Connect Manager portal.`
        });
      }
      return res.status(404).json({
        success: false,
        notRegistered: true,
        message: 'This mobile number is not registered as a manager. Please contact the administrator or register for onboarding.'
      });
    }

    const rawStatus = (user.status || '').toLowerCase();
    if (rawStatus === 'inactive' || rawStatus === 'suspended' || rawStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${rawStatus}. Please contact the system administrator.`
      });
    }

    // Check resend cooldown
    const existing = managerOtpStore.get(rawMobile);
    if (existing && existing.createdAt) {
      const elapsed = Date.now() - existing.createdAt;
      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          cooldown: true,
          remainingSeconds,
          message: `Please wait ${remainingSeconds} second(s) before requesting a new OTP.`
        });
      }
    }

    // Invalidate prior OTP and generate new 6-digit code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    managerOtpStore.set(rawMobile, {
      otp,
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      userId: user._id
    });

    const responsePayload = {
      success: true,
      cooldownSeconds: 30,
      message: `OTP sent successfully to +91 ${rawMobile}. Valid for 5 minutes.`
    };
    // In production, OTP must strictly NEVER be returned in API responses
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.otp = otp;
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const rawMobile = (req.body.mobile || req.body.phone || req.body.mobileNumber || '').toString().trim();
    const code = (req.body.otp || req.body.code || '').toString().trim();

    if (!rawMobile || !code) {
      return res.status(400).json({ success: false, message: 'Mobile number and OTP are required.' });
    }

    const record = managerOtpStore.get(rawMobile);
    if (!record) {
      return res.status(400).json({ success: false, message: 'No OTP requested for this mobile number or session expired. Please request OTP again.' });
    }

    if (Date.now() > record.expiresAt) {
      managerOtpStore.delete(rawMobile);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts > 3) {
      managerOtpStore.delete(rawMobile);
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      });
    }

    if (record.otp !== code) {
      const remaining = 3 - record.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`
      });
    }

    managerOtpStore.delete(rawMobile);

    let user = await db.users.findById(record.userId);
    if (!user) {
      user = await db.managers.findById(record.userId);
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Manager account not found.' });
    }

    const userRole = String(user.role || '').toLowerCase().trim();
    const isManagerRole = isAllowedManagerRole(userRole);
    const isGlobalAdmin = isAdminRole(userRole) || user.email === 'admin@example.com' || user._id === 'user_admin' || user.id === 'user_admin';

    if (!isManagerRole && !isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        code: 'ROLE_NOT_AUTHORIZED',
        message: `Access denied. Role '${user.role}' is not authorized for the Connect Manager portal.`
      });
    }

    const rawStatus = String(user.status || '').trim();
    const statusLower = rawStatus.toLowerCase();

    const regionObj = (user.regionId || user.stateId) ? await db.states.findById(user.regionId || user.stateId) : null;
    const state = user.stateId ? await db.states.findById(user.stateId) : null;
    const district = user.districtId ? await db.districts.findById(user.districtId) : null;
    const division = user.divisionId ? await db.divisions.findById(user.divisionId) : null;
    const pincode = user.pincodeId ? await db.pincodes.findById(user.pincodeId) : null;

    const safeUser = {
      id: user._id,
      _id: user._id,
      managerId: user.managerId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      level: user.level,
      status: user.status,
      adminApprovalStatus: user.adminApprovalStatus || (['active', 'approved'].includes(statusLower) ? 'approved' : 'pending'),
      kycStatus: user.kycStatus || (['active', 'approved'].includes(statusLower) ? 'verified' : 'pending'),
      rejectionReason: user.rejectionReason || null,
      assignedSubAdminName: user.assignedSubAdminName || null,
      routingQueue: user.routingQueue || null,
      dob: user.dob || null,
      gender: user.gender || null,
      address: user.address || null,
      documents: user.documents || {},
      avatarUrl: user.avatarUrl || null,
      bankDetails: await resolveUserBankDetails(user),
      regionId: user.regionId || user.stateId,
      scope: {
        regionId: user.regionId || user.stateId,
        regionName: regionObj?.name || null,
        stateId: user.stateId,
        stateName: state?.name || null,
        districtId: user.districtId,
        districtName: district?.name || null,
        divisionId: user.divisionId,
        divisionName: division?.name || null,
        pincodeId: user.pincodeId,
        pincodeCode: pincode?.code || null,
        pincodeArea: pincode?.areaName || null
      }
    };

    // Rejection check
    const isRejected = ['rejected', 'rejected_by_sub_admin', 'kyc_rejected'].includes(statusLower);
    if (isRejected) {
      return res.status(403).json({
        success: false,
        code: 'REGISTRATION_REJECTED',
        isApproved: false,
        approvalStatus: user.status,
        rejectionReason: user.rejectionReason || 'Manager registration was rejected.',
        message: `Manager registration was rejected: ${user.rejectionReason || 'Please contact your administrator.'}`,
        user: safeUser
      });
    }

    // Pending approval check
    const isApproved = statusLower === 'active' || statusLower === 'approved';
    if (!isApproved) {
      const isKycPending = statusLower === 'pending_kyc_approval' || statusLower === 'kyc_pending';
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_REQUIRED',
        isApproved: false,
        approvalStatus: user.status,
        adminApprovalStatus: user.adminApprovalStatus || (isKycPending ? 'approved' : 'pending'),
        kycStatus: user.kycStatus || (isKycPending ? 'pending' : 'pending_verification'),
        assignedSubAdminName: user.assignedSubAdminName || null,
        routingQueue: user.routingQueue || (isKycPending ? 'KYC_APPROVAL_QUEUE' : 'SUB_ADMIN_APPROVAL_QUEUE'),
        message: isKycPending
          ? 'Sub-admin approval granted. Application is awaiting KYC compliance clearance. Dashboard access is locked.'
          : 'Application is awaiting Sub-admin approval. Dashboard access is locked.',
        user: safeUser
      });
    }

    const tokenPayload = {
      id: user._id,
      managerId: user.managerId,
      role: user.role,
      level: user.level,
      status: 'active',
      regionId: user.regionId || user.stateId,
      stateId: user.stateId,
      districtId: user.districtId,
      divisionId: user.divisionId,
      pincodeId: user.pincodeId
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Mobile OTP verified successfully. Login granted.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during OTP verification' });
  }
};

const refreshToken = async (req, res) => {
  try {
    let user = await db.users.findById(req.user.id);
    if (!user) {
      user = await db.managers.findById(req.user.id);
    }
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    const userRole = String(user.role || '').toLowerCase().trim();
    const isManager = isAllowedManagerRole(userRole);
    const isAdmin = isAdminRole(userRole) || user.email === 'admin@example.com' || user.id === 'user_admin' || user._id === 'user_admin';

    if (!isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'ROLE_NOT_AUTHORIZED',
        message: `Forbidden: Role '${user.role}' is not authorized for the Connect Manager portal.`
      });
    }

    if (isRejectedOrBlockedStatus(user.status) || user.isActive === false) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BLOCKED',
        message: 'Account is inactive, rejected, or suspended. Token refresh denied.'
      });
    }

    const isApproved = isApprovedStatus(user.status);
    if (!isAdmin && !isApproved) {
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_REQUIRED',
        message: 'Manager approval is required. Token refresh denied.'
      });
    }

    const tokenPayload = {
      id: user.id || user._id,
      managerId: user.managerId || user.id || user._id,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      level: user.level,
      status: 'active',
      name: user.name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: req.user });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ success: false, message: 'Failed to refresh authentication token.' });
  }
};

// PUT /api/auth/bank-details - Persist manager bank account details to database
const updateBankDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const {
      accountHolderName,
      bankName,
      branchName,
      city,
      street,
      accountNumber,
      ifscCode
    } = req.body;

    if (!accountHolderName || !bankName || !branchName || !accountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: 'Account Holder Name, Bank Name, Branch Name, Account Number, and IFSC Code are required.'
      });
    }

    const holderErr = validateName(accountHolderName, true, 'Account Holder Name');
    if (holderErr) {
      return res.status(400).json({ success: false, message: holderErr });
    }

    const accErr = validateAccountNumber(accountNumber, true, bankName);
    if (accErr) {
      return res.status(400).json({ success: false, message: accErr });
    }

    const ifscErr = validateIfsc(ifscCode, true);
    if (ifscErr) {
      return res.status(400).json({ success: false, message: ifscErr });
    }

    const cleanAccount = cleanAccountNumber(accountNumber);
    const cleanIfscCode = cleanIfsc(ifscCode);

    const sanitizedBankDetails = {
      accountHolderName: formatName(accountHolderName),
      bankName: String(bankName).trim(),
      branchName: String(branchName).trim(),
      city: city ? String(city).trim() : String(branchName).trim(),
      street: street ? String(street).trim() : null,
      accountNumber: cleanAccount,
      ifscCode: cleanIfscCode
    };

    let user = await db.users.findById(userId);
    if (!user) {
      user = await db.users.findOne({ $or: [{ id: userId }, { _id: userId }, { email: req.user?.email }] });
    }
    if (!user && db.managers) {
      user = await db.managers.findById(userId) || await db.managers.findOne({ $or: [{ id: userId }, { _id: userId }, { email: req.user?.email }] });
    }

    const targetUserId = user ? (user._id || user.id) : userId;

    // Persist to users collection (single source of truth)
    await db.users.findByIdAndUpdate(targetUserId, {
      bankDetails: sanitizedBankDetails,
      bankAccount: sanitizedBankDetails,
      updatedAt: new Date().toISOString()
    }).catch(() => null);

    // Mirror to managers collection if record exists
    try {
      const mgr = await db.managers.findOne({
        $or: [
          { _id: userId },
          { id: userId },
          { email: user.email },
          { mobile: user.mobile }
        ]
      });
      if (mgr) {
        await db.managers.findByIdAndUpdate(mgr._id || mgr.id, {
          bankDetails: sanitizedBankDetails,
          bankAccount: sanitizedBankDetails,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (me) {
      console.warn('Could not mirror bank details to managers collection:', me.message);
    }

    // Record audit log with masked account number (never leak full account number to logs)
    await db.auditLogs.insertOne({
      action: 'BANK_DETAILS_UPDATED',
      userId: user._id || user.id,
      userName: user.name,
      userRole: user.role,
      details: `Bank details updated by ${user.name}. Account ending in ${cleanAccountNumber.slice(-4)} (${sanitizedBankDetails.bankName}).`,
      ip: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Bank details saved and persisted successfully.',
      bankDetails: sanitizedBankDetails
    });
  } catch (err) {
    console.error('Update bank details error:', err);
    res.status(500).json({ success: false, message: 'Failed to update bank details.' });
  }
};

// GET /api/auth/bank-details - Retrieve manager's bank details
const getBankDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let user = await db.users.findById(userId);
    if (!user) {
      user = await db.users.findOne({ $or: [{ id: userId }, { _id: userId }, { email: req.user?.email }] });
    }
    if (!user && db.managers) {
      user = await db.managers.findById(userId) || await db.managers.findOne({ $or: [{ id: userId }, { _id: userId }, { email: req.user?.email }] });
    }

    const bankDetails = user?.bankDetails || user?.bankAccount || null;
    return res.json({
      success: true,
      bankDetails: bankDetails || {
        accountHolderName: user?.name || req.user?.name || '',
        bankName: '',
        branchName: '',
        city: '',
        street: '',
        accountNumber: '',
        ifscCode: ''
      }
    });
  } catch (err) {
    console.error('Get bank details error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve bank details.' });
  }
};

module.exports = {
  login,
  register,
  registerManager: register,
  sendOtp,
  verifyOtp,
  checkCapacity,
  subAdminApproval,
  mainAdminApproval,
  kycApproval,
  simulateApproval: subAdminApproval,
  simulateKyc: kycApproval,
  getRegistrationStatus,
  getRegistrationLocations,
  uploadAvatar,
  updateProfilePhoto,
  removeProfilePhoto,
  uploadDocument,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  getBankDetails,
  updateBankDetails,
  findTerritorySubAdmin,
  resolveUserBankDetails,
  ROLE_LIMITS
};
