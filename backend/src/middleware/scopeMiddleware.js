const db = require('../config/db');

const getScopeFilter = (user) => {
  const filter = {};
  switch (user.role) {
    case 'state_admin':
    case 'state_manager':
      if (user.stateId) {
        filter.stateId = user.stateId;
      } else if (user.regionId) {
        filter.regionId = user.regionId;
      }
      break;
    case 'district_manager':
      if (user.districtId) filter.districtId = user.districtId;
      break;
    case 'division_manager':
      if (user.divisionId) filter.divisionId = user.divisionId;
      break;
    case 'pincode_manager':
      if (user.pincodeId) filter.pincodeId = user.pincodeId;
      break;
    default:
      break;
  }
  return filter;
};

// Check if a specific vendor falls within the user's scope
const isVendorInScope = (vendor, user) => {
  if (!vendor || !user) return false;

  switch (user.role) {
    case 'state_admin':
    case 'state_manager':
      return (user.stateId && vendor.stateId === user.stateId) || (user.regionId && (vendor.regionId === user.regionId || vendor.stateId === user.regionId));
    case 'district_manager':
      return vendor.districtId === user.districtId;
    case 'division_manager':
      return vendor.divisionId === user.divisionId;
    case 'pincode_manager':
      return vendor.pincodeId === user.pincodeId;
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
