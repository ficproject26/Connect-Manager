const jwt = require('jsonwebtoken');
const db = require('../config/db');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'agent_manager_secret_key_2026')) {
  throw new Error('CRITICAL SECURITY CONFIGURATION: A secure, non-default JWT_SECRET must be configured in production environment.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'agent_manager_secret_key_2026';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    let user = await db.users.findById(decoded.id);
    if (!user) {
      user = await db.managers.findById(decoded.id);
    }
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }
    const userStatus = String(user.status || '').toLowerCase();
    const isBlockedStatus = userStatus === 'inactive' || userStatus === 'rejected' || userStatus === 'suspended';
    if (isBlockedStatus) {
      return res.status(401).json({ success: false, message: 'User account is inactive or suspended.' });
    }

    // Extract base territory identifiers from user, scope, territory, and decoded token
    let stateId = user.stateId || user.assignedStateId || user.regionId || user.scope?.stateId || user.scope?.regionId || decoded.stateId || null;
    let stateName = user.state || user.stateName || user.assignedState || user.scope?.stateName || user.scope?.regionName || (user.territory && user.territory.state) || '';

    let districtId = user.districtId || user.assignedDistrictId || user.scope?.districtId || decoded.districtId || null;
    let districtName = user.district || user.districtName || user.assignedDistrict || user.scope?.districtName || (user.territory && user.territory.district) || '';

    let divisionId = user.divisionId || user.assignedDivisionId || user.scope?.divisionId || decoded.divisionId || null;
    let divisionName = user.division || user.divisionName || user.assignedDivision || user.scope?.divisionName || (user.territory && user.territory.division) || '';

    let pincodeId = user.pincodeId || user.assignedPincodeId || user.scope?.pincodeId || decoded.pincodeId || null;
    let pincodeCode = user.pincode || user.pincodeCode || user.assignedPincode || user.scope?.pincodeCode || (user.territory && user.territory.pincode) || '';
    let pincodeArea = user.area || user.pincodeArea || user.scope?.pincodeArea || '';

    // Authoritative resolution for Pincode
    if (pincodeCode) {
      pincodeCode = String(pincodeCode).trim();
      const pinObj = (await db.pincodes.findOne({ code: pincodeCode })) || (await db.pincodes.findById(pincodeCode));
      if (pinObj) {
        if (!pincodeId) pincodeId = pinObj._id || pinObj.id || pinObj.pincodeId;
        if (!pincodeArea) pincodeArea = pinObj.area || pinObj.name || pinObj.areaName || '';
        if (!divisionName && pinObj.division) divisionName = pinObj.division;
        if (!districtName && pinObj.district) districtName = pinObj.district;
        if (!stateName && pinObj.state) stateName = pinObj.state;
      }
    } else if (pincodeId) {
      const pinObj = (await db.pincodes.findById(pincodeId)) || (await db.pincodes.findOne({ _id: pincodeId })) || (await db.pincodes.findOne({ code: pincodeId }));
      if (pinObj) {
        pincodeCode = String(pinObj.code || pinObj.pincode || '').trim();
        if (!pincodeArea) pincodeArea = pinObj.area || pinObj.name || pinObj.areaName || '';
        if (!divisionName && pinObj.division) divisionName = pinObj.division;
        if (!districtName && pinObj.district) districtName = pinObj.district;
        if (!stateName && pinObj.state) stateName = pinObj.state;
      }
    }

    // Authoritative resolution for Division
    if (!divisionName && divisionId) {
      const divObj = await db.divisions.findById(divisionId);
      if (divObj) {
        divisionName = divObj.name;
        if (!districtId && divObj.districtId) districtId = divObj.districtId;
        if (!stateId && divObj.stateId) stateId = divObj.stateId;
      }
    } else if (divisionName && !divisionId) {
      const divObj = await db.divisions.findOne({ name: divisionName });
      if (divObj) divisionId = divObj._id || divObj.id;
    }

    // Authoritative resolution for District
    if (!districtName && districtId) {
      const distObj = await db.districts.findById(districtId);
      if (distObj) {
        districtName = distObj.name;
        if (!stateId && distObj.stateId) stateId = distObj.stateId;
      }
    } else if (districtName && !districtId) {
      const distObj = await db.districts.findOne({ name: districtName });
      if (distObj) districtId = distObj._id || distObj.id;
    }

    // Authoritative resolution for State
    if (!stateName && stateId) {
      const stateObj = await db.states.findById(stateId);
      if (stateObj) stateName = stateObj.name;
    } else if (stateName && !stateId) {
      const stateObj = await db.states.findOne({ name: stateName });
      if (stateObj) stateId = stateObj._id || stateObj.id;
    }

    const userId = String(user._id || user.id);
    req.user = {
      _id: userId,
      id: userId,
      managerId: user.managerId || user.id || user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile || user.phone || '',
      phone: user.phone || user.mobile || '',
      role: user.role,
      level: user.level,
      status: user.status,
      stateId,
      assignedStateId: stateId,
      districtId,
      assignedDistrictId: districtId,
      divisionId,
      assignedDivisionId: divisionId,
      pincodeId,
      assignedPincodeId: pincodeId,
      state: stateName,
      stateName,
      assignedState: stateName,
      district: districtName,
      districtName,
      assignedDistrict: districtName,
      division: divisionName,
      divisionName,
      assignedDivision: divisionName,
      pincode: pincodeCode,
      pincodeCode,
      assignedPincode: pincodeCode,
      pincodeArea,
      territory: {
        state: stateName,
        stateId,
        district: districtName,
        districtId,
        division: divisionName,
        divisionId,
        pincode: pincodeCode,
        pincodeId,
        pincodeCode,
        area: pincodeArea
      },
      scope: {
        regionId: stateId,
        regionName: stateName,
        stateId,
        stateName,
        districtId,
        districtName,
        divisionId,
        divisionName,
        pincodeId,
        pincodeCode,
        pincodeArea
      }
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

module.exports = { authMiddleware, JWT_SECRET };
