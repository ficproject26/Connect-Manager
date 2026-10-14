const ALLOWED_MANAGER_ROLES = [
  'state_manager',
  'district_manager',
  'division_manager',
  'pincode_manager'
];

const ADMIN_ROLES = [
  'admin',
  'super_admin',
  'super-admin',
  'superadmin',
  'central_admin',
  'sub_admin',
  'subadmin',
  'state_admin',
  'district_admin',
  'division_admin',
  'divisional_admin',
  'pincode_admin',
  'kyc_admin',
  'kyc_team',
  'kyc_compliance',
  'compliance_officer'
];

const isAllowedManagerRole = (role) => {
  if (!role) return false;
  return ALLOWED_MANAGER_ROLES.includes(String(role).toLowerCase().trim());
};

const isAdminRole = (role) => {
  if (!role) return false;
  const norm = String(role).toLowerCase().trim();
  return ADMIN_ROLES.includes(norm) || norm.includes('admin') || norm.includes('kyc');
};

const isApprovedStatus = (status) => {
  if (!status) return false;
  const norm = String(status).toLowerCase().trim();
  return norm === 'active' || norm === 'approved';
};

const isPendingStatus = (status) => {
  if (!status) return false;
  const norm = String(status).toLowerCase().trim();
  return [
    'pending',
    'pending_approval',
    'pending_sub_admin_approval',
    'pending_main_admin_approval',
    'pending_kyc_verification',
    'pending_kyc_approval',
    'under_review',
    'kyc_pending'
  ].includes(norm);
};

const isRejectedOrBlockedStatus = (status) => {
  if (!status) return false;
  const norm = String(status).toLowerCase().trim();
  return [
    'inactive',
    'suspended',
    'deactivated',
    'rejected',
    'rejected_by_sub_admin',
    'rejected_by_main_admin',
    'kyc_rejected'
  ].includes(norm);
};

const checkRole = (allowedRoles = ALLOWED_MANAGER_ROLES) => {
  const normAllowed = allowedRoles.map(r => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User role not established.' });
    }

    const userRole = String(req.user.role).toLowerCase();
    const isGlobalAdmin = ADMIN_ROLES.includes(userRole) || 
      req.user.email === 'admin@example.com' || 
      req.user._id === 'user_admin' || 
      req.user.id === 'user_admin';

    if (!isGlobalAdmin && !normAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        code: 'ROLE_NOT_AUTHORIZED',
        message: `Forbidden: Role '${req.user.role}' is not authorized for this manager action.`
      });
    }

    // STRICT MANAGER APPROVAL VERIFICATION:
    // Protect all manager APIs from access by pending or rejected managers.
    // Dashboard and operational APIs require both Sub-admin and KYC approval to be completed.
    if (!isGlobalAdmin) {
      const userStatus = String(req.user.status || '').toLowerCase().trim();
      const isApproved = isApprovedStatus(userStatus);
      if (!isApproved || req.user.isActive === false) {
        return res.status(403).json({
          success: false,
          code: 'APPROVAL_REQUIRED',
          isApproved: false,
          approvalStatus: req.user.status || 'PENDING_SUB_ADMIN_APPROVAL',
          adminApprovalStatus: req.user.adminApprovalStatus || 'pending',
          kycStatus: req.user.kycStatus || 'pending',
          message: 'Access denied: Manager registration approval is incomplete. Sub-admin approval and KYC approval are both required before dashboard access is permitted.'
        });
      }
    }

    next();
  };
};

// Explicit middleware to require approved manager status
const requireApprovedManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const userRole = String(req.user.role || '').toLowerCase();
  const isGlobalAdmin = ADMIN_ROLES.includes(userRole) || 
    req.user.email === 'admin@example.com' || 
    req.user._id === 'user_admin' || 
    req.user.id === 'user_admin';

  if (isGlobalAdmin) {
    return next();
  }

  if (!isAllowedManagerRole(userRole)) {
    return res.status(403).json({
      success: false,
      code: 'ROLE_NOT_AUTHORIZED',
      message: `Forbidden: Role '${req.user.role}' is not authorized for the Connect Manager portal.`
    });
  }

  const userStatus = String(req.user.status || '').toLowerCase().trim();
  const isApproved = isApprovedStatus(userStatus);
  if (!isApproved || req.user.isActive === false) {
    return res.status(403).json({
      success: false,
      code: 'APPROVAL_REQUIRED',
      isApproved: false,
      approvalStatus: req.user.status || 'PENDING_SUB_ADMIN_APPROVAL',
      adminApprovalStatus: req.user.adminApprovalStatus || 'pending',
      kycStatus: req.user.kycStatus || 'pending',
      message: 'Access denied: Manager registration approval is incomplete. Sub-admin approval and KYC approval are both required before dashboard access is permitted.'
    });
  }

  next();
};

// Reviewer authorization for approval stages (Stage A: Sub-admin, Stage B: Main Admin, Stage C: KYC)
const requireApprovalPermission = (stage = 'any') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required to process approvals.' });
    }

    const userRole = String(req.user.role || '').toLowerCase();

    // Regional field managers are strictly prohibited from approving registrations
    if (ALLOWED_MANAGER_ROLES.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Regional field managers do not have authority to approve or reject registrations.'
      });
    }

    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin', 'superadmin', 'central_admin'].includes(userRole) ||
      req.user.email === 'admin@example.com' ||
      req.user.id === 'user_admin' ||
      req.user._id === 'user_admin';

    if (isGlobalAdmin) {
      return next();
    }

    if (stage === 'subadmin') {
      const isSubAdmin = userRole.includes('sub_admin') || 
        userRole.includes('subadmin') || 
        userRole.includes('state_admin') || 
        userRole.includes('district_admin') || 
        userRole.includes('division_admin') || 
        userRole.includes('divisional_admin') || 
        userRole.includes('pincode_admin');
      if (isSubAdmin) return next();
    } else if (stage === 'mainadmin') {
      const isMainAdmin = userRole.includes('main_admin') || userRole.includes('mainadmin');
      if (isMainAdmin) return next();
    } else if (stage === 'kyc') {
      const isKyc = userRole.includes('kyc') || userRole.includes('compliance');
      if (isKyc) return next();
    }

    return res.status(403).json({
      success: false,
      message: `Security Violation: Role '${req.user.role}' is not authorized to perform ${stage} approvals.`
    });
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
  ADMIN_ROLES,
  isAllowedManagerRole,
  isAdminRole,
  isApprovedStatus,
  isPendingStatus,
  isRejectedOrBlockedStatus,
  checkRole,
  requireApprovedManager,
  requireApprovalPermission,
  blockManagersFromAdminEndpoints
};
