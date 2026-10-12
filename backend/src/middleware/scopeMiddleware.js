const db = require('../config/db');

const getScopeFilter = (user) => {
  // Return empty filter so all vendors can be loaded and accurately filtered in memory using isVendorInScope
  return {};
};

// Check if a specific vendor falls within the user's scope
const isVendorInScope = (vendor, user) => {
  if (!vendor || !user) return false;

  const role = (user.role || '').toLowerCase();

  // Super admins and system administrators have full pan-India scope
  if (['admin', 'super-admin', 'super_admin', 'central_admin'].includes(role) || user.email === 'admin@example.com' || user._id === 'user_admin' || user.id === 'user_admin') {
    return true;
  }

  const norm = (s) => (s || '').toString().trim().toLowerCase();

  const userStateId = norm(user.stateId || user.regionId || user.scope?.stateId);
  const userState = norm(user.state || user.stateName || user.assignedState || user.scope?.stateName);
  const vendorStateId = norm(vendor.stateId || vendor.regionId);
  const vendorState = norm(vendor.state || vendor.stateName || vendor.assignedState || vendor.location?.state);

  const matchState = () => {
    if (userStateId && vendorStateId) return userStateId === vendorStateId;
    if (userState && vendorState) return userState === vendorState;
    if (!userStateId && !userState) return true;
    return false;
  };

  const userDistrictId = norm(user.districtId || user.assignedDistrictId || user.scope?.districtId);
  const userDistrict = norm(user.district || user.districtName || user.assignedDistrict || user.scope?.districtName);
  const vendorDistrictId = norm(vendor.districtId || vendor.assignedDistrictId);
  const vendorDistrict = norm(vendor.district || vendor.districtName || vendor.assignedDistrict || vendor.location?.district);

  const matchDistrict = () => {
    if (!matchState()) return false;
    // Strict ID-based scoping takes precedence
    if (userDistrictId && vendorDistrictId) {
      return userDistrictId === vendorDistrictId;
    }
    if (userDistrict && vendorDistrict) {
      return userDistrict === vendorDistrict;
    }
    if (!userDistrictId && !userDistrict) return true;
    return false;
  };

  const userDivisionId = norm(user.divisionId || user.assignedDivisionId || user.scope?.divisionId);
  const userDivision = norm(user.division || user.divisionName || user.assignedDivision || user.scope?.divisionName);
  const vendorDivisionId = norm(vendor.divisionId || vendor.assignedDivisionId);
  const vendorDivision = norm(vendor.division || vendor.divisionName || vendor.assignedDivision || vendor.location?.division);

  const matchDivision = () => {
    if (!matchDistrict()) return false;
    if (userDivisionId && vendorDivisionId) {
      return userDivisionId === vendorDivisionId;
    }
    if (userDivision && vendorDivision) {
      return userDivision === vendorDivision;
    }
    if (!userDivisionId && !userDivision) return true;
    return false;
  };

  const userPincodeId = norm(user.pincodeId || user.assignedPincodeId || user.scope?.pincodeId);
  const userPincode = norm(user.pincode || user.pincodeCode || user.assignedPincode || user.scope?.pincodeCode);
  const vendorPincodeId = norm(vendor.pincodeId || vendor.assignedPincodeId);
  const vendorPincode = norm(vendor.pincode || vendor.pincodeCode || vendor.location?.pincode);

  const matchPincode = () => {
    if (!matchState()) return false;
    // Pincode Manager is strictly restricted to their assigned pincode
    if (userPincodeId && vendorPincodeId && userPincodeId === vendorPincodeId) return true;
    if (userPincode && vendorPincode && userPincode === vendorPincode) return true;
    return false;
  };

  switch (role) {
    case 'state_admin':
    case 'state_manager':
      return matchState();
    case 'district_manager':
      return matchDistrict();
    case 'division_manager':
      return matchDivision();
    case 'pincode_manager':
      return matchPincode();
    default:
      return false;
  }
};

// Middleware: Verifies that the requested vendor ID is strictly within the caller's scope
const verifyVendorScope = async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID is required' });
    }

    const vendor = await db.vendors.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (!isVendorInScope(vendor, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or manage vendors outside your assigned geographic/regional scope.'
      });
    }

    req.targetVendor = vendor;
    next();
  } catch (err) {
    console.error('Scope verification error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during scope verification' });
  }
};

// Middleware: Enforces and validates location assignment when creating or updating a vendor
const validateVendorCreationScope = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User session required.' });
    }

    const body = req.body;
    const rawRole = String(user.role || '').toLowerCase().replace(/[\s-]/g, '_');
    const userRegion = user.regionId || user.stateId;
    const norm = (id) => (id ? String(id).trim() : '');

    // 1. PINCODE MANAGER
    if (rawRole === 'pincode_manager') {
      const assignedState = norm(user.stateId || userRegion);
      const assignedDistrict = norm(user.districtId);
      const assignedDivision = norm(user.divisionId);
      const assignedPincode = norm(user.pincodeId || user.pincode);

      if (!assignedState || !assignedDistrict || !assignedDivision || !assignedPincode) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Manager profile is missing assigned territory assignments. Cannot onboard vendor.'
        });
      }

      // Reject if client submitted territory outside manager scope
      if (body.stateId && norm(body.stateId) !== assignedState) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned state.'
        });
      }
      if (body.districtId && norm(body.districtId) !== assignedDistrict) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned district.'
        });
      }
      if (body.divisionId && norm(body.divisionId) !== assignedDivision) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned division.'
        });
      }
      if (body.pincodeId && norm(body.pincodeId) !== assignedPincode) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned pincode.'
        });
      }

      body.regionId = userRegion;
      body.stateId = user.stateId || userRegion;
      body.districtId = user.districtId;
      body.divisionId = user.divisionId;
      body.pincodeId = user.pincodeId || user.pincode;
    }
    // 2. DIVISION MANAGER
    else if (rawRole === 'division_manager') {
      const assignedState = norm(user.stateId || userRegion);
      const assignedDistrict = norm(user.districtId);
      const assignedDivision = norm(user.divisionId);

      if (!assignedState || !assignedDistrict || !assignedDivision) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Manager profile is missing assigned state, district, or division. Cannot onboard vendor.'
        });
      }

      if (body.stateId && norm(body.stateId) !== assignedState) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned state.'
        });
      }
      if (body.districtId && norm(body.districtId) !== assignedDistrict) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned district.'
        });
      }
      if (body.divisionId && norm(body.divisionId) !== assignedDivision) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned division.'
        });
      }

      if (!body.pincodeId) {
        return res.status(400).json({ success: false, message: 'Pincode is required' });
      }

      const pincode = await db.pincodes.findById(body.pincodeId);
      if (!pincode || norm(pincode.divisionId) !== assignedDivision) {
        return res.status(403).json({
          success: false,
          message: 'Selected pincode does not belong to your assigned division.'
        });
      }

      body.regionId = userRegion;
      body.stateId = user.stateId || userRegion;
      body.districtId = user.districtId;
      body.divisionId = user.divisionId;
    }
    // 3. DISTRICT MANAGER
    else if (rawRole === 'district_manager') {
      const assignedState = norm(user.stateId || userRegion);
      const assignedDistrict = norm(user.districtId);

      if (!assignedState || !assignedDistrict) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Manager profile is missing assigned state or district. Cannot onboard vendor.'
        });
      }

      if (body.stateId && norm(body.stateId) !== assignedState) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned state.'
        });
      }
      if (body.districtId && norm(body.districtId) !== assignedDistrict) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned district.'
        });
      }

      if (!body.divisionId || !body.pincodeId) {
        return res.status(400).json({ success: false, message: 'Division and Pincode are required' });
      }

      const division = await db.divisions.findById(body.divisionId);
      if (!division || norm(division.districtId) !== assignedDistrict) {
        return res.status(403).json({
          success: false,
          message: 'Selected division does not belong to your assigned district.'
        });
      }

      const pincode = await db.pincodes.findById(body.pincodeId);
      if (!pincode || norm(pincode.divisionId) !== norm(body.divisionId)) {
        return res.status(403).json({
          success: false,
          message: 'Selected pincode does not belong to the selected division.'
        });
      }

      body.regionId = userRegion;
      body.stateId = user.stateId || userRegion;
      body.districtId = user.districtId;
    }
    // 4. STATE MANAGER / STATE ADMIN
    else if (rawRole === 'state_manager' || rawRole === 'state_admin' || rawRole.includes('state')) {
      const assignedState = norm(user.stateId || userRegion);

      if (!assignedState) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Manager profile is missing assigned state. Cannot onboard vendor.'
        });
      }

      if (body.stateId && norm(body.stateId) !== assignedState) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot onboard vendors outside your assigned state.'
        });
      }

      if (!body.districtId || !body.divisionId || !body.pincodeId) {
        return res.status(400).json({ success: false, message: 'District, Division, and Pincode are required' });
      }

      const district = await db.districts.findById(body.districtId);
      const districtState = norm(district?.stateId || district?.regionId);
      if (!district || districtState !== assignedState) {
        return res.status(403).json({
          success: false,
          message: 'Selected district does not belong to your assigned regional jurisdiction.'
        });
      }

      const division = await db.divisions.findById(body.divisionId);
      if (!division || norm(division.districtId) !== norm(body.districtId)) {
        return res.status(403).json({
          success: false,
          message: 'Selected division does not belong to the selected district.'
        });
      }

      const pincode = await db.pincodes.findById(body.pincodeId);
      if (!pincode || norm(pincode.divisionId) !== norm(body.divisionId)) {
        return res.status(403).json({
          success: false,
          message: 'Selected pincode does not belong to the selected division.'
        });
      }

      body.regionId = userRegion;
      body.stateId = user.stateId || userRegion;
    }

    next();
  } catch (err) {
    console.error('Vendor creation scope validation error:', err);
    return res.status(500).json({ success: false, message: 'Scope validation failed' });
  }
};

module.exports = {
  getScopeFilter,
  isVendorInScope,
  verifyVendorScope,
  validateVendorCreationScope
};
