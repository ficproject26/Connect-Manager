/**
 * managerOnboardingController.js
 * 
 * Handles the full Manager → Vendor Onboarding workflow:
 *   1. Field Shop Visit creation (with storefront photo, category, interest status)
 *   2. Vendor Onboarding submission (linked to field visit) → PENDING_PINCODE_APPROVAL
 *   3. Pincode Admin approval / rejection
 *   4. Audit trail for every transition
 *   5. Notification routing (Pincode Admin, Manager, Main Admin)
 */

const db = require('../config/db');
const { broadcastNotification } = require('../routes/notificationRoutes');

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

async function findPincodeAdmin(pincodeCode, pincodeId) {
  if (!pincodeCode && !pincodeId) return null;

  const allManagers = await db.managers.find({});
  const allUsers   = await db.users.find({});
  const everyone   = [...allManagers, ...allUsers];

  const pincodeAdmins = everyone.filter(u => {
    const role = (u.role || '').toLowerCase();
    return role === 'pincode_admin' || role === 'pincodeadmin' || role === 'pincode_manager';
  });

  if (!pincodeAdmins.length) return null;

  if (pincodeId) {
    const byId = pincodeAdmins.find(u =>
      String(u.pincodeId || u.pincode_id || '') === String(pincodeId)
    );
    if (byId) return byId;
  }

  if (pincodeCode) {
    const byCode = pincodeAdmins.find(u => {
      const uCode = String(u.pincodeCode || u.pincode || u.scope?.pincodeCode || '');
      return uCode === String(pincodeCode);
    });
    if (byCode) return byCode;
  }

  return null;
}

async function recordAudit({ actorId, actorName, actorRole, action, entityId, entityType, previousStatus, newStatus, territory, reason }) {
  try {
    await db.auditLogs.insertOne({
      actorId, actorName, actorRole,
      action,
      entityId, entityType,
      previousStatus, newStatus,
      territory: territory || '',
      reason: reason || '',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.warn('[ManagerOnboarding] Audit write error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────
// 1. CREATE FIELD SHOP VISIT
//    POST /api/manager-onboarding/field-visit
// ─────────────────────────────────────────────────────────
const createFieldVisit = async (req, res) => {
  try {
    const user = req.user;
    const {
      shopName, businessCategory, storefrontPhoto, interestStatus,
      stateId, districtId, divisionId, pincodeId, pincodeCode
    } = req.body;

    if (!shopName || !shopName.trim()) {
      return res.status(400).json({ success: false, message: 'Shop name is required.' });
    }
    if (!businessCategory) {
      return res.status(400).json({ success: false, message: 'Business category is required.' });
    }
    if (!storefrontPhoto) {
      return res.status(400).json({ success: false, message: 'Storefront photo is required.' });
    }
    if (!['YES', 'NO'].includes(interestStatus)) {
      return res.status(400).json({ success: false, message: 'Interest status must be YES or NO.' });
    }

    const territory = {
      stateId:    stateId    || user.stateId    || null,
      districtId: districtId || user.districtId || null,
      divisionId: divisionId || user.divisionId || null,
      pincodeId:  pincodeId  || user.pincodeId  || null,
      pincodeCode: pincodeCode || user.scope?.pincodeCode || null
    };

    const status = interestStatus === 'YES' ? 'MERCHANT_INTERESTED' : 'FIELD_VISIT_NOT_INTERESTED';

    const fieldVisit = await db.managerOnboardings.insertOne({
      type: 'FIELD_VISIT',
      shopName:        shopName.trim(),
      businessCategory,
      storefrontPhoto,
      interestStatus,
      status,
      managerId:   String(user.id || user._id),
      managerName: user.name,
      managerRole: user.role,
      ...territory,
      vendorOnboardingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await recordAudit({
      actorId: user.id, actorName: user.name, actorRole: user.role,
      action: interestStatus === 'YES'
        ? 'Field Visit Created – Merchant Interested'
        : 'Field Visit Created – Merchant Not Interested',
      entityId: fieldVisit._id, entityType: 'manager_onboarding',
      previousStatus: null, newStatus: status,
      territory: territory.pincodeCode || territory.pincodeId || ''
    });

    return res.status(201).json({
      success: true,
      message: interestStatus === 'YES'
        ? 'Field visit recorded. Proceed to vendor onboarding.'
        : 'Field visit recorded. No vendor account will be created.',
      data: fieldVisit
    });
  } catch (err) {
    console.error('[ManagerOnboarding] createFieldVisit error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record field visit.' });
  }
};

// ─────────────────────────────────────────────────────────
// 2. SUBMIT VENDOR ONBOARDING REQUEST
//    POST /api/manager-onboarding/submit
// ─────────────────────────────────────────────────────────
const submitVendorOnboarding = async (req, res) => {
  try {
    const user = req.user;
    const {
      fieldVisitId,
      shopName, businessCategory, storefrontPhoto,
      businessName, businessPhone, businessEmail, businessAddress, businessWebsite, operatingHours,
      ownerName, ownerPhone, ownerEmail, ownerDob, ownerGender, ownerAddress,
      panNumber, gstNumber, documents,
      accountHolderName, accountNumber, ifsc, bankName,
      stateId, districtId, divisionId, pincodeId, pincodeCode
    } = req.body;

    if (!fieldVisitId) {
      return res.status(400).json({ success: false, message: 'fieldVisitId is required.' });
    }

    const fieldVisit = await db.managerOnboardings.findById(fieldVisitId);
    if (!fieldVisit) {
      return res.status(404).json({ success: false, message: 'Field visit record not found.' });
    }
    if (String(fieldVisit.managerId) !== String(user.id || user._id)) {
      return res.status(403).json({ success: false, message: 'You can only submit onboarding for your own field visits.' });
    }
    if (fieldVisit.interestStatus !== 'YES') {
      return res.status(400).json({ success: false, message: 'Cannot create vendor onboarding for a non-interested merchant.' });
    }

    const existing = (await db.managerOnboardings.find({})).find(o =>
      o.type === 'VENDOR_ONBOARDING' && String(o.fieldVisitId) === String(fieldVisitId)
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A vendor onboarding request already exists for this field visit.',
        data: existing
      });
    }

    const territory = {
      stateId:     stateId    || fieldVisit.stateId    || user.stateId    || null,
      districtId:  districtId || fieldVisit.districtId || user.districtId || null,
      divisionId:  divisionId || fieldVisit.divisionId || user.divisionId || null,
      pincodeId:   pincodeId  || fieldVisit.pincodeId  || user.pincodeId  || null,
      pincodeCode: pincodeCode || fieldVisit.pincodeCode || user.scope?.pincodeCode || null
    };

    const pincodeAdmin = await findPincodeAdmin(territory.pincodeCode, territory.pincodeId);

    const onboarding = await db.managerOnboardings.insertOne({
      type:            'VENDOR_ONBOARDING',
      fieldVisitId,
      shopName:        shopName        || fieldVisit.shopName,
      businessCategory: businessCategory || fieldVisit.businessCategory,
      storefrontPhoto: storefrontPhoto || fieldVisit.storefrontPhoto,
      interestStatus:  'YES',
      businessName:    businessName    || shopName || fieldVisit.shopName,
      businessPhone:   businessPhone   || null,
      businessEmail:   businessEmail   || null,
      businessAddress: businessAddress || null,
      businessWebsite: businessWebsite || null,
      operatingHours:  operatingHours  || null,
      ownerName:    ownerName    || null,
      ownerPhone:   ownerPhone   || null,
      ownerEmail:   ownerEmail   || null,
      ownerDob:     ownerDob     || null,
      ownerGender:  ownerGender  || null,
      ownerAddress: ownerAddress || null,
      panNumber:    panNumber    || null,
      gstNumber:    gstNumber    || null,
      documents:    Array.isArray(documents) ? documents : [],
      accountHolderName: accountHolderName || null,
      accountNumber:     accountNumber     || null,
      ifsc:              ifsc              || null,
      bankName:          bankName          || null,
      ...territory,
      managerId:    String(user.id || user._id),
      managerName:  user.name,
      managerRole:  user.role,
      assignedPincodeAdminId:   pincodeAdmin ? String(pincodeAdmin._id || pincodeAdmin.id) : null,
      assignedPincodeAdminName: pincodeAdmin?.name || null,
      status:           'PENDING_PINCODE_APPROVAL',
      overallStatus:    'PENDING_PINCODE_APPROVAL',
      pincodeApproval:  null,
      pincodeRejection: null,
      kycStatus:        null,
      submittedAt:      new Date().toISOString(),
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString()
    });

    await db.managerOnboardings.findByIdAndUpdate(fieldVisitId, {
      vendorOnboardingId: onboarding._id,
      status:    'VENDOR_ONBOARDING_IN_PROGRESS',
      updatedAt: new Date().toISOString()
    });

    await recordAudit({
      actorId: user.id, actorName: user.name, actorRole: user.role,
      action: 'Vendor Onboarding Submitted – Pending Pincode Approval',
      entityId: onboarding._id, entityType: 'manager_onboarding',
      previousStatus: null, newStatus: 'PENDING_PINCODE_APPROVAL',
      territory: territory.pincodeCode || ''
    });

    if (pincodeAdmin) {
      await broadcastNotification({
        type:     'vendor_onboarding_request',
        title:    'New Vendor Onboarding Request',
        message:  `Manager ${user.name} submitted onboarding for "${onboarding.shopName}" — PIN ${territory.pincodeCode || territory.pincodeId}. Action required.`,
        recordId: onboarding._id,
        userId:   String(pincodeAdmin._id || pincodeAdmin.id),
        targetUserId: String(pincodeAdmin._id || pincodeAdmin.id),
        pincodeId: territory.pincodeId,
        createdAt: new Date().toISOString()
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Vendor onboarding submitted. Pending Pincode Admin approval.',
      data: onboarding,
      pincodeAdmin: pincodeAdmin
        ? { id: pincodeAdmin._id || pincodeAdmin.id, name: pincodeAdmin.name }
        : null
    });
  } catch (err) {
    console.error('[ManagerOnboarding] submitVendorOnboarding error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit vendor onboarding.' });
  }
};

// ─────────────────────────────────────────────────────────
// 3. GET MANAGER'S OWN ONBOARDING RECORDS
// ─────────────────────────────────────────────────────────
const getManagerOnboardings = async (req, res) => {
  try {
    const user = req.user;
    const { type, status, page = 1, limit = 20 } = req.query;

    let all = await db.managerOnboardings.find({});
    all = all.filter(o => String(o.managerId) === String(user.id || user._id));
    if (type)   all = all.filter(o => o.type === type);
    if (status) all = all.filter(o => o.status === status || o.overallStatus === status);
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const pageNum  = parseInt(page, 10)  || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const total     = all.length;
    const paginated = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({ success: true, data: paginated, total,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 } });
  } catch (err) {
    console.error('[ManagerOnboarding] getManagerOnboardings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch onboarding records.' });
  }
};

// ─────────────────────────────────────────────────────────
// 4. ADMIN VIEW — ALL ONBOARDING RECORDS
// ─────────────────────────────────────────────────────────
const getAdminOnboardings = async (req, res) => {
  try {
    const user = req.user;
    const { type, status, page = 1, limit = 20, search } = req.query;

    let all = await db.managerOnboardings.find({});
    const role = (user.role || '').toLowerCase();

    if (role === 'pincode_admin' || role === 'pincodeadmin') {
      all = all.filter(o =>
        String(o.assignedPincodeAdminId) === String(user.id || user._id) ||
        String(o.pincodeId) === String(user.pincodeId) ||
        String(o.pincodeCode) === String(user.scope?.pincodeCode || '')
      );
    } else if (role === 'district_manager' && user.districtId) {
      all = all.filter(o => String(o.districtId) === String(user.districtId));
    } else if (role === 'state_manager' && user.stateId) {
      all = all.filter(o => String(o.stateId) === String(user.stateId));
    }

    if (type)   all = all.filter(o => o.type === type);
    if (status) all = all.filter(o => o.status === status || o.overallStatus === status);
    if (search) {
      const q = search.toLowerCase();
      all = all.filter(o =>
        (o.shopName || '').toLowerCase().includes(q) ||
        (o.businessName || '').toLowerCase().includes(q) ||
        (o.managerName || '').toLowerCase().includes(q) ||
        (o.managerId || '').toLowerCase().includes(q) ||
        (o.pincodeCode || '').includes(q)
      );
    }

    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const pageNum  = parseInt(page, 10)  || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const total     = all.length;
    const paginated = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({ success: true, data: paginated, total,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 } });
  } catch (err) {
    console.error('[ManagerOnboarding] getAdminOnboardings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch onboarding records.' });
  }
};

// ─────────────────────────────────────────────────────────
// 5. PINCODE ADMIN — APPROVE
// ─────────────────────────────────────────────────────────
const approveOnboarding = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { notes } = req.body;

    const onboarding = await db.managerOnboardings.findById(id);
    if (!onboarding) return res.status(404).json({ success: false, message: 'Onboarding record not found.' });
    if (onboarding.type !== 'VENDOR_ONBOARDING') return res.status(400).json({ success: false, message: 'Only vendor onboarding records can be approved.' });
    if (onboarding.status !== 'PENDING_PINCODE_APPROVAL') return res.status(400).json({ success: false, message: `Cannot approve from status: ${onboarding.status}.` });

    const role = (user.role || '').toLowerCase();
    const isPincodeAdmin = role === 'pincode_admin' || role === 'pincodeadmin' || role === 'pincode_manager';
    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].some(r => role.includes(r)) || user.email === 'admin@example.com';

    if (!isPincodeAdmin && !isGlobalAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Pincode Managers or Administrators can approve onboarding.' });
    }

    if (isPincodeAdmin && !isGlobalAdmin) {
      const adminId = String(user.id || user._id);
      const assigned = String(onboarding.assignedPincodeAdminId || '');
      if (assigned && assigned !== adminId) {
        return res.status(403).json({ success: false, message: 'You are not the assigned Pincode Admin for this request.' });
      }
      if (user.pincodeId && onboarding.pincodeId && String(user.pincodeId) !== String(onboarding.pincodeId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Onboarding is outside your assigned pincode territory.' });
      }
    }

    const previousStatus = onboarding.status;
    const updated = await db.managerOnboardings.findByIdAndUpdate(id, {
      status:        'PINCODE_APPROVED',
      overallStatus: 'KYC_PENDING',
      kycStatus:     'KYC_PENDING',
      pincodeApproval: {
        approvedBy:        user.name,
        approvedByRole:    user.role,
        approvedAt:        new Date().toISOString(),
        approvedAdminId:   String(user.id || user._id),
        approvedAdminName: user.name,
        notes:             notes || ''
      },
      updatedAt: new Date().toISOString()
    });

    await recordAudit({
      actorId: user.id, actorName: user.name, actorRole: user.role,
      action: 'Pincode Admin Approved – KYC Pending',
      entityId: id, entityType: 'manager_onboarding',
      previousStatus, newStatus: 'PINCODE_APPROVED',
      territory: onboarding.pincodeCode || onboarding.pincodeId || ''
    });

    await broadcastNotification({
      type:    'vendor_onboarding_approved',
      title:   'Vendor Onboarding Approved',
      message: `Your onboarding for "${onboarding.shopName}" was approved by Pincode Admin. KYC Pending.`,
      recordId: id,
      userId:   onboarding.managerId,
      targetUserId: onboarding.managerId,
      createdAt: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Onboarding approved. Status: PINCODE_APPROVED → KYC_PENDING.', data: updated });
  } catch (err) {
    console.error('[ManagerOnboarding] approveOnboarding error:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve onboarding.' });
  }
};

// ─────────────────────────────────────────────────────────
// 6. PINCODE ADMIN — REJECT
// ─────────────────────────────────────────────────────────
const rejectOnboarding = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory.' });
    }

    const onboarding = await db.managerOnboardings.findById(id);
    if (!onboarding) return res.status(404).json({ success: false, message: 'Onboarding record not found.' });
    if (onboarding.status !== 'PENDING_PINCODE_APPROVAL') return res.status(400).json({ success: false, message: `Cannot reject from status: ${onboarding.status}.` });

    const role = (user.role || '').toLowerCase();
    const isPincodeAdmin = role === 'pincode_admin' || role === 'pincodeadmin' || role === 'pincode_manager';
    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].some(r => role.includes(r)) || user.email === 'admin@example.com';

    if (!isPincodeAdmin && !isGlobalAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Pincode Managers or Administrators can reject onboarding.' });
    }

    if (isPincodeAdmin && !isGlobalAdmin) {
      const adminId = String(user.id || user._id);
      const assigned = String(onboarding.assignedPincodeAdminId || '');
      if (assigned && assigned !== adminId) {
        return res.status(403).json({ success: false, message: 'You are not the assigned Pincode Admin for this request.' });
      }
      if (user.pincodeId && onboarding.pincodeId && String(user.pincodeId) !== String(onboarding.pincodeId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Onboarding is outside your assigned pincode territory.' });
      }
    }

    const previousStatus = onboarding.status;
    const updated = await db.managerOnboardings.findByIdAndUpdate(id, {
      status:        'PINCODE_REJECTED',
      overallStatus: 'PINCODE_REJECTED',
      pincodeRejection: {
        rejectedBy:       user.name,
        rejectedByRole:   user.role,
        rejectedAt:       new Date().toISOString(),
        rejectedAdminId:  String(user.id || user._id),
        rejectionReason:  rejectionReason.trim()
      },
      updatedAt: new Date().toISOString()
    });

    await recordAudit({
      actorId: user.id, actorName: user.name, actorRole: user.role,
      action: 'Pincode Admin Rejected',
      entityId: id, entityType: 'manager_onboarding',
      previousStatus, newStatus: 'PINCODE_REJECTED',
      territory: onboarding.pincodeCode || onboarding.pincodeId || '',
      reason: rejectionReason
    });

    await broadcastNotification({
      type:    'vendor_onboarding_rejected',
      title:   'Vendor Onboarding Rejected',
      message: `Your onboarding for "${onboarding.shopName}" was rejected. Reason: ${rejectionReason}.`,
      recordId: id,
      userId:   onboarding.managerId,
      targetUserId: onboarding.managerId,
      createdAt: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Onboarding rejected.', data: updated });
  } catch (err) {
    console.error('[ManagerOnboarding] rejectOnboarding error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject onboarding.' });
  }
};

// ─────────────────────────────────────────────────────────
// 7. GET SINGLE ONBOARDING RECORD
// ─────────────────────────────────────────────────────────
const getOnboardingById = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const record = await db.managerOnboardings.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Onboarding record not found.' });

    const role = (user.role || '').toLowerCase();
    const isOwner = String(record.managerId) === String(user.id || user._id);
    const isAdmin = ['state_admin', 'super_admin', 'subadmin', 'admin', 'pincode_admin', 'state_manager', 'district_manager'].some(r => role.includes(r));
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Access denied.' });

    return res.json({ success: true, data: record });
  } catch (err) {
    console.error('[ManagerOnboarding] getOnboardingById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch onboarding record.' });
  }
};

module.exports = {
  createFieldVisit,
  submitVendorOnboarding,
  getManagerOnboardings,
  getAdminOnboardings,
  approveOnboarding,
  rejectOnboarding,
  getOnboardingById
};
