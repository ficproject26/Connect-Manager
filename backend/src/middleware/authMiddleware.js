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
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'User account not found or inactive.' });
    }

    req.user = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      level: user.level,
      stateId: user.stateId,
      districtId: user.districtId,
      divisionId: user.divisionId,
      pincodeId: user.pincodeId
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
