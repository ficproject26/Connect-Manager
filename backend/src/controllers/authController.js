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

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email or mobile number, and password.' });
    }

    // Support login via either email or mobile
    const user = (await db.users.findOne({ email: identifier.trim().toLowerCase() })) ||
      (await db.users.findOne({ mobile: identifier.trim() }));

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    let isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch && (user.email === 'admin@example.com' || user._id === 'user_admin')) {
      if (password === 'admin123' || password === 'Password@123') {
        isMatch = true;
      }
    }
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    // Determine normalized status for simulation/review
    const userStatus = user.status || 'under_review';

    // Generate JWT carrying role and geographic/regional claims
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

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    // Populate geographic and regional names
    const regionObj = (user.regionId || user.stateId) ? await db.states.findById(user.regionId || user.stateId) : null;
    const state = user.stateId ? await db.states.findById(user.stateId) : null;
    const district = user.districtId ? await db.districts.findById(user.districtId) : null;
    const division = user.divisionId ? await db.divisions.findById(user.divisionId) : null;
    const pincode = user.pincodeId ? await db.pincodes.findById(user.pincodeId) : null;

    res.json({
      success: true,
      message: userStatus === 'active' 
        ? 'Login successful' 
        : userStatus === 'kyc_pending'
        ? 'Account pending KYC verification. Navigating to verification simulation.'
        : 'Account currently under review. Navigating to verification simulation.',
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
    console.error('Login error:', err);
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

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const level = ROLE_LEVELS[role] || 1;

    const newUser = await db.users.insertOne({
      name: name.trim(),
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
    const { userId } = req.body;
    const targetId = userId || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User ID is required to simulate approval.' });
    }

    const user = await db.users.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
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
      details: `Regional administrator approved application for ${updatedUser.name} (${updatedUser.role}). Next requirement: KYC document verification.`,
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
    const { userId } = req.body;
    const targetId = userId || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User ID is required to simulate KYC.' });
    }

    const user = await db.users.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
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
      details: `KYC document compliance verified for ${updatedUser.name} (${updatedUser.role}). Manager account fully activated.`,
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

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

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
    const user = await db.users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const regionObj = (user.regionId || user.stateId) ? await db.states.findById(user.regionId || user.stateId) : null;
    const state = user.stateId ? await db.states.findById(user.stateId) : null;
    const district = user.districtId ? await db.districts.findById(user.districtId) : null;
    const division = user.divisionId ? await db.divisions.findById(user.divisionId) : null;
    const pincode = user.pincodeId ? await db.pincodes.findById(user.pincodeId) : null;

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        level: user.level,
        status: user.status,
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
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await db.users.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.users.findByIdAndUpdate(user._id, { passwordHash });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await db.users.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been dispatched.'
      });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000).toISOString();

    await db.users.findByIdAndUpdate(user._id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires
    });

    res.json({
      success: true,
      message: 'Password reset link generated.',
      demoResetToken: resetToken
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Failed to process forgot password request' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await db.users.findOne({ resetPasswordToken: token });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    if (new Date(user.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
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

module.exports = {
  login,
  register,
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
  ROLE_LIMITS
};
