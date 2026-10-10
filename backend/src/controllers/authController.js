const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

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
  const users = await db.users.find();
  // Count active, under_review, and kyc_pending accounts
  const occupiedUsers = users.filter(u => u.status === 'active' || u.status === 'under_review' || u.status === 'kyc_pending');
  const limit = ROLE_LIMITS[role] || 2;

  if (role === 'state_manager') {
    if (!stateId) return { count: 0, limit, isFull: false };
    const matches = occupiedUsers.filter(u => u.role === 'state_manager' && u.stateId === stateId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'district_manager') {
    if (!districtId) return { count: 0, limit, isFull: false };
    const matches = occupiedUsers.filter(u => u.role === 'district_manager' && u.districtId === districtId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'division_manager') {
    if (!divisionId) return { count: 0, limit, isFull: false };
    const matches = occupiedUsers.filter(u => u.role === 'division_manager' && u.divisionId === divisionId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'pincode_manager') {
    if (!pincodeId) return { count: 0, limit, isFull: false };
    const matches = occupiedUsers.filter(u => u.role === 'pincode_manager' && u.pincodeId === pincodeId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  return { count: 0, limit, isFull: false, remaining: limit };
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
    let user = null;
    if (normalizedEmail) {
      const safeEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      user = (await db.users.findOne({ email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } })) ||
             (await db.managers.findOne({ email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } }));
    }
    if (!user && cleanMobile) {
      user = (await db.users.findOne({ mobile: cleanMobile })) ||
             (await db.users.findOne({ phone: cleanMobile })) ||
             (await db.users.findOne({ mobile: rawIdentifier })) ||
             (await db.users.findOne({ phone: rawIdentifier })) ||
             (await db.managers.findOne({ mobile: cleanMobile })) ||
             (await db.managers.findOne({ phone: cleanMobile }));
    }
    if (!user) {
      user = (await db.users.findOne({ loginId: rawIdentifier.toLowerCase() })) ||
             (await db.users.findOne({ managerId: rawIdentifier })) ||
             (await db.users.findOne({ _id: rawIdentifier })) ||
             (await db.users.findOne({ id: rawIdentifier })) ||
             (await db.managers.findOne({ loginId: rawIdentifier.toLowerCase() })) ||
             (await db.managers.findOne({ managerId: rawIdentifier })) ||
             (await db.managers.findOne({ _id: rawIdentifier })) ||
             (await db.managers.findOne({ id: rawIdentifier }));
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
    const userRole = String(user.role || '').toLowerCase();
    const isManagerRole = userRole.includes('manager') || ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(userRole);
    if (!isManagerRole) {
      return res.status(403).json({ success: false, message: 'Access denied. This portal is exclusively for regional Managers.' });
    }

    // Account status check
    const rawStatus = String(user.status || '').toLowerCase().trim();
    const resolvedId = user.managerId || user.id || user._id;

    if (rawStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account is suspended. Please contact your administrator.' });
    }
    if (rawStatus === 'inactive' || rawStatus === 'deactivated') {
      return res.status(403).json({ success: false, message: 'Account is inactive. Please contact your administrator.' });
    }
    if (rawStatus === 'rejected') {
      return res.status(403).json({ success: false, message: 'Manager registration was rejected. Please contact your administrator.' });
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

    // Clear failed attempts on successful login
    failedLoginAttempts.delete(lockKey);

    const isApproved = rawStatus === 'active' || rawStatus === 'approved';
    const userStatus = isApproved ? 'active' : (rawStatus || 'under_review');

    const rolePrefix = user.role === 'state_manager' ? 'STM'
      : user.role === 'district_manager' ? 'DTM'
      : user.role === 'division_manager' ? 'DIV'
      : 'PIN';
    const managerId = user.managerId || `MGR-${rolePrefix}-${String(user._id || user.id).slice(-6)}`;

    // Populate geographic and regional scope
    const stateObj = user.stateId ? await db.states.findById(user.stateId) : null;
    const districtObj = user.districtId ? await db.districts.findById(user.districtId) : null;
    const divisionObj = user.divisionId ? await db.divisions.findById(user.divisionId) : null;
    const pincodeObj = user.pincodeId ? await db.pincodes.findById(user.pincodeId) : null;

    const resolvedState = user.state || user.assignedState || stateObj?.name || null;
    const resolvedDistrict = user.district || user.assignedDistrict || districtObj?.name || null;
    const resolvedDivision = user.division || user.assignedDivision || divisionObj?.name || null;
    const resolvedPincode = user.pincode || user.assignedPincode || pincodeObj?.code || null;

    const tokenPayload = {
      id: user._id,
      managerId,
      role: user.role,
      level: user.level,
      status: userStatus,
      stateId: user.stateId || null,
      districtId: user.districtId || null,
      divisionId: user.divisionId || null,
      pincodeId: user.pincodeId || null
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: userStatus === 'active' 
        ? 'Login successful' 
        : userStatus === 'kyc_pending'
        ? 'Account pending KYC verification.'
        : 'Account currently under review.',
      token,
      user: {
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
        status: userStatus,
        state: resolvedState,
        stateId: user.stateId || null,
        district: resolvedDistrict,
        districtId: user.districtId || null,
        division: resolvedDivision,
        divisionId: user.divisionId || null,
        pincode: resolvedPincode,
        pincodeId: user.pincodeId || null,
        adminApprovalStatus: user.adminApprovalStatus || 'approved',
        kycStatus: user.kycStatus || 'Verified',
        dob: user.dob || null,
        gender: user.gender || null,
        address: user.address || null,
        documents: user.documents || {},
        avatarUrl: user.avatarUrl || null,
        scope: {
          regionId: user.stateId || null,
          regionName: resolvedState,
          stateId: user.stateId || null,
          stateName: resolvedState,
          districtId: user.districtId || null,
          districtName: resolvedDistrict,
          divisionId: user.divisionId || null,
          divisionName: resolvedDivision,
          pincodeId: user.pincodeId || null,
          pincodeCode: resolvedPincode,
          pincodeArea: pincodeObj?.areaName || null
        }
      }
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
      avatarUrl
    } = req.body;

    if (!name || !email || !mobile || !password || !role) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields: Full Name, Email, Mobile, Password, and Role.' });
    }

    const trimmedName = String(name).trim();
    const nameRegex = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
    if (!nameRegex.test(trimmedName) || trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full Name must contain only English alphabetic characters (A–Z, a–z) and spaces between name parts. Numbers and special characters are not permitted.'
      });
    }

    const formattedName = trimmedName
      .split(/\s+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const cleanMobile = String(mobile).replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit Indian mobile number.' });
    }

    if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.'
      });
    }

    if (!['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid manager role selected.' });
    }

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
    const existingEmail = await db.users.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists. Please sign in or use another email.' });
    }

    const existingMobile = await db.users.findOne({ mobile: mobile.trim() });
    if (existingMobile) {
      return res.status(400).json({ success: false, message: 'An account with this mobile number already exists. Please sign in or use another mobile number.' });
    }

    // Check location capacity / exclusivity
    const occupancy = await getOccupancy(role, { stateId, districtId, divisionId, pincodeId });
    if (occupancy.isFull) {
      return res.status(400).json({
        success: false,
        limitReached: true,
        message: `This place has reached its maximum manager capacity (${occupancy.count}/${occupancy.limit}). Registration not allowed for this location.`
      });
    }

    // Hash password with strong cost factor
    const passwordHash = await bcrypt.hash(password, 12);
    const level = ROLE_LEVELS[role] || 1;

    const newUser = await db.users.insertOne({
      name: formattedName,
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      passwordHash,
      role,
      level,
      status: 'under_review',
      dob: dob || null,
      gender: gender || null,
      address: address ? address.trim() : null,
      documents: documents || {},
      declarationAccepted: !!declarationAccepted,
      kycStatus: 'pending_verification',
      stateId: stateId || null,
      zone: zone || null,
      districtId: districtId || null,
      divisionId: divisionId || null,
      pincodeId: pincodeId || null,
      state: stateDoc?.name || null,
      district: distDoc?.name || null,
      division: divDoc?.name || null,
      pincode: pinDoc?.code || null,
      stateName: stateDoc?.name || null,
      districtName: distDoc?.name || null,
      divisionName: divDoc?.name || null,
      pincodeCode: pinDoc?.code || null,
      regionId: stateId || null,
      avatarUrl: avatarUrl || null
    });

    // Record audit log
    await db.auditLogs.insertOne({
      action: 'MANAGER_REGISTERED_UNDER_REVIEW',
      userId: newUser._id,
      userName: newUser.name,
      userRole: newUser.role,
      details: `New ${role.replace('_', ' ')} registration submitted for approval with KYC documents. Status: under_review.`,
      ip: req.ip || '127.0.0.1'
    });

    const state = stateId ? await db.states.findById(stateId) : null;
    const district = districtId ? await db.districts.findById(districtId) : null;
    const division = divisionId ? await db.divisions.findById(divisionId) : null;
    const pincode = pincodeId ? await db.pincodes.findById(pincodeId) : null;

    res.status(201).json({
      success: true,
      status: 'under_review',
      message: 'Manager registration submitted successfully. Your account is currently under review for administrator approval.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        role: newUser.role,
        level: newUser.level,
        status: newUser.status,
        dob: newUser.dob || null,
        gender: newUser.gender || null,
        address: newUser.address || null,
        documents: newUser.documents || {},
        kycStatus: newUser.kycStatus || 'pending_verification',
        avatarUrl: newUser.avatarUrl || null,
        scope: {
          stateName: state?.name || null,
          zone: zone || district?.zone || null,
          districtName: district?.name || null,
          divisionName: division?.name || null,
          pincodeCode: pincode?.code || null,
          pincodeArea: pincode?.areaName || null
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

const simulateApproval = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Simulation endpoints are strictly disabled in production mode.'
      });
    }

    const { userId } = req.body;
    const targetId = userId || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User ID is required to simulate approval.' });
    }

    const user = await db.users.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Disallow simulating approval on administrative accounts
    if (['admin', 'super_admin', 'super-admin'].includes(String(user.role).toLowerCase()) || user.email === 'admin@example.com') {
      return res.status(403).json({ success: false, message: 'Administrative accounts cannot be modified via simulation.' });
    }

    // Set to kyc_pending (Admin approval completed, next is KYC)
    await db.users.findByIdAndUpdate(user._id, { 
      status: 'kyc_pending',
      adminApprovalStatus: 'approved',
      adminApprovedAt: new Date().toISOString()
    });
    const updatedUser = await db.users.findById(user._id);

    // Audit log
    await db.auditLogs.insertOne({
      action: 'ADMIN_APPROVAL_SIMULATED',
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      details: `Development simulation: Regional administrator approved application for ${updatedUser.name} (${updatedUser.role}). Next requirement: KYC document verification.`,
      ip: req.ip || '127.0.0.1'
    });

    const regionObj = (updatedUser.regionId || updatedUser.stateId) ? await db.states.findById(updatedUser.regionId || updatedUser.stateId) : null;
    const state = updatedUser.stateId ? await db.states.findById(updatedUser.stateId) : null;
    const district = updatedUser.districtId ? await db.districts.findById(updatedUser.districtId) : null;
    const division = updatedUser.divisionId ? await db.divisions.findById(updatedUser.divisionId) : null;
    const pincode = updatedUser.pincodeId ? await db.pincodes.findById(updatedUser.pincodeId) : null;

    res.json({
      success: true,
      status: 'kyc_pending',
      message: 'Admin approval granted! Application is now in KYC Pending status.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        level: updatedUser.level,
        status: updatedUser.status,
        adminApprovalStatus: 'approved',
        dob: updatedUser.dob || null,
        gender: updatedUser.gender || null,
        address: updatedUser.address || null,
        documents: updatedUser.documents || {},
        kycStatus: updatedUser.kycStatus || 'pending_verification',
        avatarUrl: updatedUser.avatarUrl || null,
        regionId: updatedUser.regionId || updatedUser.stateId,
        scope: {
          regionId: updatedUser.regionId || updatedUser.stateId,
          regionName: regionObj?.name || null,
          stateId: updatedUser.stateId,
          stateName: state?.name || null,
          districtId: updatedUser.districtId,
          districtName: district?.name || null,
          divisionId: updatedUser.divisionId,
          divisionName: division?.name || null,
          pincodeId: updatedUser.pincodeId,
          pincodeCode: pincode?.code || null,
          pincodeArea: pincode?.areaName || null
        }
      }
    });
  } catch (err) {
    console.error('Simulate approval error:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate admin approval' });
  }
};

const simulateKyc = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Simulation endpoints are strictly disabled in production mode.'
      });
    }

    const { userId } = req.body;
    const targetId = userId || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User ID is required to simulate KYC.' });
    }

    const user = await db.users.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Disallow simulating KYC on administrative accounts
    if (['admin', 'super_admin', 'super-admin'].includes(String(user.role).toLowerCase()) || user.email === 'admin@example.com') {
      return res.status(403).json({ success: false, message: 'Administrative accounts cannot be modified via simulation.' });
    }

    // Set to active & verify KYC
    await db.users.findByIdAndUpdate(user._id, { 
      status: 'active', 
      kycStatus: 'verified',
      kycVerifiedAt: new Date().toISOString()
    });
    const updatedUser = await db.users.findById(user._id);

    // Audit log
    await db.auditLogs.insertOne({
      action: 'KYC_VERIFICATION_SIMULATED',
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      details: `Development simulation: KYC document compliance verified for ${updatedUser.name} (${updatedUser.role}). Manager account fully activated.`,
      ip: req.ip || '127.0.0.1'
    });

    const tokenPayload = {
      id: updatedUser._id,
      role: updatedUser.role,
      level: updatedUser.level,
      status: updatedUser.status,
      regionId: updatedUser.regionId || updatedUser.stateId,
      stateId: updatedUser.stateId,
      districtId: updatedUser.districtId,
      divisionId: updatedUser.divisionId,
      pincodeId: updatedUser.pincodeId
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    const regionObj = (updatedUser.regionId || updatedUser.stateId) ? await db.states.findById(updatedUser.regionId || updatedUser.stateId) : null;
    const state = updatedUser.stateId ? await db.states.findById(updatedUser.stateId) : null;
    const district = updatedUser.districtId ? await db.districts.findById(updatedUser.districtId) : null;
    const division = updatedUser.divisionId ? await db.divisions.findById(updatedUser.divisionId) : null;
    const pincode = updatedUser.pincodeId ? await db.pincodes.findById(updatedUser.pincodeId) : null;

    res.json({
      success: true,
      status: 'active',
      message: 'KYC verified successfully! Manager account is fully active.',
      token,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        level: updatedUser.level,
        status: updatedUser.status,
        adminApprovalStatus: 'approved',
        dob: updatedUser.dob || null,
        gender: updatedUser.gender || null,
        address: updatedUser.address || null,
        documents: updatedUser.documents || {},
        kycStatus: 'verified',
        avatarUrl: updatedUser.avatarUrl || null,
        regionId: updatedUser.regionId || updatedUser.stateId,
        scope: {
          regionId: updatedUser.regionId || updatedUser.stateId,
          regionName: regionObj?.name || null,
          stateId: updatedUser.stateId,
          stateName: state?.name || null,
          districtId: updatedUser.districtId,
          districtName: district?.name || null,
          divisionId: updatedUser.divisionId,
          divisionName: division?.name || null,
          pincodeId: updatedUser.pincodeId,
          pincodeCode: pincode?.code || null,
          pincodeArea: pincode?.areaName || null
        }
      }
    });
  } catch (err) {
    console.error('Simulate KYC error:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate KYC verification' });
  }
};

// Sync Admin Master Territory Hierarchy into Manager Portal Collections
async function syncAdminMasterTerritories() {
  const endpoints = [
    'http://127.0.0.1:8004/api/territory/hierarchy',
    'http://localhost:8004/api/territory/hierarchy',
    'https://api.ficapp.in/api/territory/hierarchy'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
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
    // Synchronize strictly with Admin Master Territory Database
    await syncAdminMasterTerritories();

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
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      avatarUrl: fileUrl,
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size
      }
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ success: false, message: 'Avatar upload failed' });
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
    const managerId = user.managerId || `MGR-${rolePrefix}-${String(user._id || user.id).slice(-6)}`;

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
        pincodeArea: pincodeArea,
        adminApprovalStatus: user.adminApprovalStatus || 'approved',
        kycStatus: user.kycStatus || 'Verified',
        dob: user.dob || null,
        gender: user.gender || null,
        address: user.address || null,
        documents: user.documents || {},
        avatarUrl: user.avatarUrl || null,
        territory: {
          state: stateName,
          stateId: stateId,
          district: districtName,
          districtId: districtId,
          division: divisionName,
          divisionId: divisionId,
          pincode: pincodeCode,
          pincodeId: pincodeId,
          pincodeCode: pincodeCode,
          area: pincodeArea
        },
        scope: {
          regionId: stateId,
          regionName: stateName,
          stateId: stateId,
          stateName: stateName,
          districtId: districtId,
          districtName: districtName,
          divisionId: divisionId,
          divisionName: divisionName,
          pincodeId: pincodeId,
          pincodeCode: pincodeCode,
          pincodeArea: pincodeArea
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

    if (newPassword.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long and include an uppercase letter, lowercase letter, and number.'
      });
    }

    const user = await db.users.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.users.findByIdAndUpdate(user._id, { passwordHash });

    res.json({ success: true, message: 'Password updated successfully.' });
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

    if (newPassword.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long and include an uppercase letter, lowercase letter, and number.'
      });
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
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size,
        type: req.file.mimetype
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

    const user = await db.users.findOne({ mobile: rawMobile });
    if (!user) {
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

    const user = await db.users.findById(record.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Manager account not found.' });
    }

    const rawStatus = (user.status || '').toLowerCase();
    const isApproved = rawStatus === 'active' || rawStatus === 'approved';
    const userStatus = isApproved ? 'active' : (rawStatus || 'under_review');

    const tokenPayload = {
      id: user._id,
      role: user.role,
      level: user.level,
      status: userStatus,
      regionId: user.regionId || user.stateId,
      stateId: user.stateId,
      districtId: user.districtId,
      divisionId: user.divisionId,
      pincodeId: user.pincodeId
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    const regionObj = (user.regionId || user.stateId) ? await db.states.findById(user.regionId || user.stateId) : null;
    const state = user.stateId ? await db.states.findById(user.stateId) : null;
    const district = user.districtId ? await db.districts.findById(user.districtId) : null;
    const division = user.divisionId ? await db.divisions.findById(user.divisionId) : null;
    const pincode = user.pincodeId ? await db.pincodes.findById(user.pincodeId) : null;

    return res.json({
      success: true,
      message: 'Mobile OTP verified successfully. Login granted.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        level: user.level,
        status: userStatus,
        adminApprovalStatus: user.adminApprovalStatus || (userStatus === 'kyc_pending' ? 'approved' : 'pending'),
        kycStatus: user.kycStatus || 'pending_verification',
        dob: user.dob || null,
        gender: user.gender || null,
        address: user.address || null,
        documents: user.documents || {},
        avatarUrl: user.avatarUrl || null,
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
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during OTP verification' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const user = await db.users.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    const tokenPayload = {
      id: user.id || user._id,
      managerId: user.managerId || user.id || user._id,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      level: user.level,
      name: user.name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: req.user });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ success: false, message: 'Failed to refresh authentication token.' });
  }
};

module.exports = {
  login,
  register,
  sendOtp,
  verifyOtp,
  checkCapacity,
  simulateApproval,
  simulateKyc,
  getRegistrationLocations,
  uploadAvatar,
  uploadDocument,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  ROLE_LIMITS
};
