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

  const userStateId = norm(user.stateId || user.regionId);
  const userState = norm(user.state || user.stateName || user.assignedState);
  const vendorStateId = norm(vendor.stateId || vendor.regionId);
  const vendorState = norm(vendor.state || vendor.assignedState || vendor.location?.state);

  const matchState = () => {
    if (userStateId && vendorStateId && userStateId === vendorStateId) return true;
    if (userState && vendorState && userState === vendorState) return true;
    if (!userStateId && !userState) return true;
    return false;
  };

  const userDistrictId = norm(user.districtId);
  const userDistrict = norm(user.district || user.districtName || user.assignedDistrict);
  const vendorDistrictId = norm(vendor.districtId);
  const vendorDistrict = norm(vendor.district || vendor.assignedDistrict || vendor.location?.district);

  const matchDistrict = () => {
    if (!matchState()) return false;
    if (userDistrictId && vendorDistrictId && userDistrictId === vendorDistrictId) return true;
    if (userDistrict && vendorDistrict && userDistrict === vendorDistrict) return true;
    if (!userDistrictId && !userDistrict) return true;
    return false;
  };

  const userDivisionId = norm(user.divisionId);
  const userDivision = norm(user.division || user.divisionName || user.assignedDivision);
  const vendorDivisionId = norm(vendor.divisionId);
  const vendorDivision = norm(vendor.division || vendor.assignedDivision || vendor.location?.division);

  const matchDivision = () => {
    if (!matchDistrict()) return false;
    if (userDivisionId && vendorDivisionId && userDivisionId === vendorDivisionId) return true;
    if (userDivision && vendorDivision && userDivision === vendorDivision) return true;
    if (!userDivisionId && !userDivision) return true;
    return false;
  };

  const userPincodeId = norm(user.pincodeId);
  const userPincode = norm(user.pincode || user.pincodeCode || user.pincodeId);
  const vendorPincodeId = norm(vendor.pincodeId);
  const vendorPincode = norm(vendor.pincode || vendor.location?.pincode);

  const matchPincode = () => {
    if (!matchDivision()) return false;
    if (userPincodeId && vendorPincodeId && userPincodeId === vendorPincodeId) return true;
    if (userPincode && vendorPincode && userPincode === vendorPincode) return true;
    if (!userPincodeId && !userPincode) return true;
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
    const body = req.body;
    const userRegion = user.regionId || user.stateId;

    if (user.role === 'pincode_manager') {
      body.regionId = userRegion;
      body.stateId = user.stateId;
      body.districtId = user.districtId;
      body.divisionId = user.divisionId;
      body.pincodeId = user.pincodeId;
    } else if (user.role === 'division_manager') {
      body.regionId = userRegion;
      body.stateId = user.stateId;
      body.districtId = user.districtId;
      body.divisionId = user.divisionId;

      if (!body.pincodeId) {
        return res.status(400).json({ success: false, message: 'Pincode is required' });
      }
      const pincode = await db.pincodes.findById(body.pincodeId);
      if (!pincode || pincode.divisionId !== user.divisionId) {
        return res.status(403).json({
          success: false,
          message: 'Selected pincode does not belong to your assigned division.'
        });
      }
    } else if (user.role === 'district_manager') {
      body.regionId = userRegion;
      body.stateId = user.stateId;
      body.districtId = user.districtId;

      if (!body.divisionId || !body.pincodeId) {
        return res.status(400).json({ success: false, message: 'Division and Pincode are required' });
      }
      const division = await db.divisions.findById(body.divisionId);
      if (!division || division.districtId !== user.districtId) {
        return res.status(403).json({
          success: false,
          message: 'Selected division does not belong to your assigned district.'
        });
      }
      const pincode = await db.pincodes.findById(body.pincodeId);
      if (!pincode || pincode.divisionId !== body.divisionId) {
        return res.status(403).json({
          success: false,
          message: 'Selected pincode does not belong to the selected division.'
        });
      }
    } else if (user.role === 'state_manager' || user.role === 'state_admin') {
      body.regionId = userRegion;
      body.stateId = user.stateId || userRegion;

      if (!body.districtId || !body.divisionId || !body.pincodeId) {
        return res.status(400).json({ success: false, message: 'District, Division, and Pincode are required' });
      }
      const district = await db.districts.findById(body.districtId);
      if (!district || district.regionId !== userRegion) {
        return res.status(403).json({
          success: false,
          message: 'Selected district does not belong to your assigned regional jurisdiction.'
        });
      }
      const division = await db.divisions.findById(body.divisionId);
      if (!division || division.districtId !== body.districtId) {
        return res.status(403).json({
          success: false,
          message: 'Selected division does not belong to the selected district.'
        });
      }
      const pincode = await db.pincodes.findById(body.pincodeId);
      if (!pincode || pincode.divisionId !== body.divisionId) {
        return res.status(403).json({
          success: false,
          message: 'Selected pincode does not belong to the selected division.'
        });
      }
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
