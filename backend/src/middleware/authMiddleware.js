const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'agent_manager_secret_key_2026';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await db.users.findById(decoded.id);
    const userStatus = String(user?.status || '').toLowerCase();
    const isApprovedOrActive = userStatus === 'active' || userStatus === 'approved';
    if (!user || (!isApprovedOrActive && (userStatus === 'inactive' || userStatus === 'rejected' || userStatus === 'suspended'))) {
      return res.status(401).json({ success: false, message: 'User account not found or inactive.' });
    }

    // Resolve state name if not directly on user
    let stateName = user.state || user.stateName || user.assignedState || (user.territory && user.territory.state) || '';
    if (!stateName && user.stateId) {
      const stateObj = await db.states.findById(user.stateId);
      if (stateObj) stateName = stateObj.name;
    }

    // Resolve district name if not directly on user
    let districtName = user.district || user.districtName || user.assignedDistrict || (user.territory && user.territory.district) || '';
    if (!districtName && user.districtId) {
      const distObj = await db.districts.findById(user.districtId);
      if (distObj) districtName = distObj.name;
    }

    // Resolve division name if not directly on user
    let divisionName = user.division || user.divisionName || user.assignedDivision || (user.territory && user.territory.division) || '';
    if (!divisionName && user.divisionId) {
      const divObj = await db.divisions.findById(user.divisionId);
      if (divObj) divisionName = divObj.name;
    }

    // Resolve pincode code if not directly on user
    let pincodeCode = user.pincode || user.pincodeCode || (user.territory && user.territory.pincode) || '';
    if (!pincodeCode && user.pincodeId) {
      const pinObj = await db.pincodes.findById(user.pincodeId);
      if (pinObj) pincodeCode = pinObj.code;
    }

    req.user = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      level: user.level,
      status: user.status,
      stateId: user.stateId,
      districtId: user.districtId,
      divisionId: user.divisionId,
      pincodeId: user.pincodeId,
      state: stateName,
      stateName: stateName,
      district: districtName,
      districtName: districtName,
      division: divisionName,
      divisionName: divisionName,
      pincode: pincodeCode,
      pincodeCode: pincodeCode,
      territory: user.territory || {
        state: stateName,
        district: districtName,
        division: divisionName,
        pincode: pincodeCode
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
