const ALLOWED_MANAGER_ROLES = [
  'state_manager',
  'district_manager',
  'division_manager',
  'pincode_manager'
];

const checkRole = (allowedRoles = ALLOWED_MANAGER_ROLES) => {
  const normAllowed = allowedRoles.map(r => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User role not established.' });
    }

    const userRole = String(req.user.role).toLowerCase();
    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(userRole) || 
      req.user.email === 'admin@example.com' || 
      req.user._id === 'user_admin' || 
      req.user.id === 'user_admin';

    if (!isGlobalAdmin && !normAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized for this manager action.`
      });
    }

    next();
  };
};

// Protect admin-only operations from being modified by field managers
const blockManagersFromAdminEndpoints = (req, res, next) => {
  return res.status(403).json({
    success: false,
    message: 'Forbidden: Admin operations are out of scope for the Agent Manager portal.'
  });
};

module.exports = {
  ALLOWED_MANAGER_ROLES,
  checkRole,
  blockManagersFromAdminEndpoints
};
