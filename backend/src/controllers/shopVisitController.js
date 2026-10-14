const db = require('../config/db');
const territoryScopeService = require('../services/territoryScopeService');
const { broadcastNotification } = require('../routes/notificationRoutes');

// Normalizers for interest status values across schema variations
function isNotInterestedStatus(val) {
  if (val === false) return true;
  if (!val) return false;
  const s = String(val).toLowerCase().trim().replace(/[\s_-]+/g, '');
  return s === 'no' || s === 'notinterested' || s === 'false';
}

function isInterestedStatus(val) {
  if (val === true) return true;
  if (!val) return false;
  const s = String(val).toLowerCase().trim().replace(/[\s_-]+/g, '');
  return s === 'yes' || s === 'interested' || s === 'true' || s === 'merchantinterested';
}

function isVisitNotInterested(v) {
  if (!v) return false;
  return isNotInterestedStatus(v.interestedStatus) || isNotInterestedStatus(v.interestStatus);
}

function isVisitInterested(v) {
  if (!v) return false;
  if (isVisitNotInterested(v)) return false;
  return isInterestedStatus(v.interestedStatus) || isInterestedStatus(v.interestStatus);
}

// Helper: Resolve precise onboarding status and resume eligibility for a shop visit
function resolveVisitOnboarding(visit, vendors = [], onboardings = []) {
  const vId = String(visit._id || visit.id || '');
  const isInterested = isVisitInterested(visit);
  const isNotInterested = isVisitNotInterested(visit);

  // 1. Direct status flags on visit record
  const rawStatus = String(visit.onboardingStatus || visit.status || '').toLowerCase().trim();
  const directCompleted = ['onboarded', 'completed', 'success', 'approved', 'active'].includes(rawStatus);

  // 2. Associated Vendor Record
  let linkedVendor = null;
  if (visit.vendorId) {
    const targetVendorId = String(visit.vendorId);
    linkedVendor = vendors.find(vend => String(vend._id || vend.id) === targetVendorId);
  }
  if (!linkedVendor && vId) {
    linkedVendor = vendors.find(vend => vend.fieldVisitId && String(vend.fieldVisitId) === vId);
  }

  // Fallback match by phone number
  if (!linkedVendor && (visit.phone || visit.mobile || visit.merchantPhone)) {
    const rawP = String(visit.phone || visit.mobile || visit.merchantPhone).replace(/\D/g, '');
    if (rawP.length >= 10) {
      linkedVendor = vendors.find(vend => {
        const vp = String(vend.phone || vend.mobile || vend.merchantPhone || vend.contactPhone || '').replace(/\D/g, '');
        return vp && vp.slice(-10) === rawP.slice(-10);
      });
    }
  }

  // Fallback match by shop / business name
  if (!linkedVendor && (visit.shopName || visit.storeName)) {
    const sName = String(visit.shopName || visit.storeName).trim().toLowerCase();
    linkedVendor = vendors.find(vend => {
      const vn = String(vend.businessName || vend.shopName || vend.name || vend.storeName || '').trim().toLowerCase();
      return vn && vn === sName;
    });
  }

  let vendorCompleted = false;
  let vendorIncomplete = false;
  if (linkedVendor) {
    const vStat = String(linkedVendor.status || '').toLowerCase().trim();
    if (['approved', 'active', 'completed'].includes(vStat) || linkedVendor.isApproved === true || linkedVendor.isActive === true) {
      vendorCompleted = true;
    } else if (['pending', 'in_progress', 'draft', 'submitted', 'kyc_pending', 'pending_approval', 'rejected'].includes(vStat)) {
      vendorIncomplete = true;
    }
  }

  // 3. Manager Onboarding Records
  let linkedOnboarding = null;
  if (vId) {
    linkedOnboarding = onboardings.find(o => o.fieldVisitId && String(o.fieldVisitId) === vId);
  }

  let onboardingRecordCompleted = false;
  let onboardingRecordIncomplete = false;
  if (linkedOnboarding) {
    const oStat = String(linkedOnboarding.status || linkedOnboarding.overallStatus || '').toLowerCase().trim();
    if (['approved', 'active', 'completed', 'onboarded'].includes(oStat)) {
      onboardingRecordCompleted = true;
    } else if (['pending_pincode_approval', 'kyc_pending', 'vendor_onboarding_in_progress', 'pincode_approved', 'pincode_rejected'].includes(oStat)) {
      onboardingRecordIncomplete = true;
    }
  }

  const isOnboardingCompleted = directCompleted || vendorCompleted || onboardingRecordCompleted;
  const isOnboardingIncomplete = !isOnboardingCompleted && (vendorIncomplete || onboardingRecordIncomplete || ['incomplete', 'in_progress', 'pending_approval'].includes(rawStatus));

  let onboardingStatus = 'UNKNOWN';
  if (!isInterested && isNotInterested) {
    onboardingStatus = 'NOT_INTERESTED';
  } else if (!isInterested) {
    onboardingStatus = 'UNKNOWN';
  } else if (isOnboardingCompleted) {
    onboardingStatus = 'COMPLETED';
  } else if (isOnboardingIncomplete) {
    onboardingStatus = 'INCOMPLETE';
  } else {
    onboardingStatus = 'PENDING';
  }

  // Eligible only when:
  // - Manager has visited the shop and generated a report (visit exists)
  // - The recorded interest status is Interested
  // - The shop's onboarding process is still pending or incomplete
  // - The shop has not completed onboarding successfully
  const isEligibleForResume = isInterested && !isOnboardingCompleted && (onboardingStatus === 'PENDING' || onboardingStatus === 'INCOMPLETE');

  return {
    ...visit,
    vendorId: linkedVendor ? String(linkedVendor._id || linkedVendor.id) : (visit.vendorId || null),
    vendorName: linkedVendor ? (linkedVendor.businessName || linkedVendor.name || linkedVendor.shopName) : (directCompleted ? visit.shopName : null),
    vendorStatus: linkedVendor ? (linkedVendor.status || 'Active') : (directCompleted ? 'Active' : null),
    onboardingStatus,
    isOnboardingCompleted,
    isOnboardingIncomplete,
    isEligibleForResume
  };
}

// GET /api/shop-visits - Get scoped list of shop visits with pagination, onboarding status & eligibility filtering
const getShopVisits = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 15, search, status, category, scope, pendingOnboardingOnly, eligibleOnly } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = (limit === 'all' || parseInt(limit, 10) >= 1000) ? 1000 : (parseInt(limit, 10) || 15);

    // Parallel retrieval with optimized index lookups
    const [allVisits, allVendors, allOnboardings] = await Promise.all([
      db.shopVisits.find(),
      db.vendors.find(),
      db.managerOnboardings.find()
    ]);

    const enrichedVisits = allVisits.map(v => {
      const enriched = resolveVisitOnboarding(v, allVendors, allOnboardings);
      const mRole = enriched.managerRole || enriched.recordedByRole || enriched.role || '';
      const mName = enriched.managerName || enriched.recordedByName || '';
      return {
        ...enriched,
        managerRole: mRole,
        recordedByRole: mRole,
        managerName: mName,
        recordedByName: mName
      };
    });

    // Filter using territoryScopeService for strict role and territory isolation
    const scopedVisits = [];
    for (const v of enrichedVisits) {
      const visible = await territoryScopeService.isReportVisible(v, user, scope || 'all');
      if (visible) {
        scopedVisits.push(v);
      }
    }

    // Base filtered list matching category and search (for consistent KPI aggregation)
    const baseFiltered = scopedVisits.filter(v => {
      // Category filter
      if (category && category !== 'All' && v.category !== category) return false;

      // Search filter
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const matchName = (v.shopName || '').toLowerCase().includes(q);
        const matchReason = (v.notInterestedReason || '').toLowerCase().includes(q);
        const matchCat = (v.category || '').toLowerCase().includes(q);
        const matchMgr = (v.managerName || '').toLowerCase().includes(q);
        if (!matchName && !matchReason && !matchCat && !matchMgr) return false;
      }

      return true;
    });

    // KPI reflects the active scope + category + search dataset
    const isStatusFiltered = Boolean(status && status !== 'All');
    const kpi = {
      total: isStatusFiltered
        ? baseFiltered.filter(v => {
            if (isNotInterestedStatus(status)) return isVisitNotInterested(v);
            if (isInterestedStatus(status)) return isVisitInterested(v);
            return true;
          }).length
        : baseFiltered.length,
      interested: baseFiltered.filter(isVisitInterested).length,
      notInterested: baseFiltered.filter(isVisitNotInterested).length,
      pendingOnboarding: baseFiltered.filter(v => v.isEligibleForResume).length,
      completedOnboarding: baseFiltered.filter(v => v.isOnboardingCompleted).length
    };

    let filtered = baseFiltered.filter(v => {
      const isNotInterestedVisit = isVisitNotInterested(v);
      const isInterestedVisit = isVisitInterested(v);

      // Status filter ('YES', 'NO', 'Converted', 'Not Interested', 'Interested', etc.)
      if (isStatusFiltered) {
        if (isNotInterestedStatus(status) && !isNotInterestedVisit) return false;
        if (isInterestedStatus(status) && !isInterestedVisit) return false;
      }

      // Pending Onboarding Eligibility Filter:
      if ((pendingOnboardingOnly === 'true' || eligibleOnly === 'true') && !isNotInterestedStatus(status)) {
        if (!v.isEligibleForResume || v.isOnboardingCompleted) return false;
      }

      return true;
    });

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const effectivePage = Math.min(pageNum, totalPages);
    const paginated = limitNum >= 1000 ? filtered : filtered.slice((effectivePage - 1) * limitNum, effectivePage * limitNum);

    res.json({
      success: true,
      total,
      data: paginated,
      visits: paginated,
      kpi,
      pagination: {
        page: effectivePage,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('Error fetching shop visits:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve shop visits from database' });
  }
};

// GET /api/shop-visits/:id/eligibility - Revalidate onboarding eligibility before allowing resume action
const revalidateEligibility = async (req, res) => {
  try {
    const { id } = req.params;
    const [visit, allVendors, allOnboardings] = await Promise.all([
      db.shopVisits.findById(id),
      db.vendors.find(),
      db.managerOnboardings.find()
    ]);

    if (!visit) {
      return res.status(404).json({
        success: false,
        eligible: false,
        message: 'Shop visit record not found'
      });
    }

    const resolved = resolveVisitOnboarding(visit, allVendors, allOnboardings);

    return res.json({
      success: true,
      eligible: resolved.isEligibleForResume,
      onboardingStatus: resolved.onboardingStatus,
      isOnboardingCompleted: resolved.isOnboardingCompleted,
      isInterested: resolved.interestedStatus === 'YES' || resolved.interestStatus === 'YES',
      vendorId: resolved.vendorId,
      message: resolved.isEligibleForResume
        ? 'Shop visit is eligible for onboarding resumption.'
        : (resolved.isOnboardingCompleted
            ? 'Onboarding has already been completed successfully for this shop.'
            : 'Shop visit is not eligible for onboarding resumption.')
    });
  } catch (err) {
    console.error('Error revalidating eligibility:', err);
    res.status(500).json({ success: false, message: 'Failed to revalidate eligibility' });
  }
};

// GET /api/shop-visits/:id - Get single shop visit with enriched onboarding status
const getShopVisitById = async (req, res) => {
  try {
    const { id } = req.params;
    const [visit, allVendors, allOnboardings] = await Promise.all([
      db.shopVisits.findById(id),
      db.vendors.find(),
      db.managerOnboardings.find()
    ]);

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Shop visit record not found' });
    }

    const resolved = resolveVisitOnboarding(visit, allVendors, allOnboardings);
    res.json({ success: true, data: resolved });
  } catch (err) {
    console.error('Error fetching shop visit:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve shop visit' });
  }
};

// POST /api/shop-visits - Record new field shop visit
const createShopVisit = async (req, res) => {
  try {
    const user = req.user;
    const {
      shopName,
      category,
      businessCategory,
      shopPhoto,
      storefrontPhoto,
      voiceNote,
      audioVoiceNote,
      interestedStatus,
      interestStatus,
      notInterestedReason,
      otherReason,
      customReason,
      vendorId,
      pincodeCode,
      pincode,
      pincodeId,
      divisionId,
      districtId,
      stateId
    } = req.body;

    if (!shopName || !shopName.trim()) {
      return res.status(400).json({ success: false, message: 'Shop name is required' });
    }

    const resolvedStatus = (interestedStatus || interestStatus || 'NO').toUpperCase() === 'YES' ? 'YES' : 'NO';
    const resolvedCategory = category || businessCategory || 'Products';
    const resolvedPhoto = shopPhoto || storefrontPhoto || null;
    const resolvedVoice = voiceNote || audioVoiceNote || null;
    const resolvedReason = notInterestedReason || (resolvedStatus === 'YES' ? 'Interested in Onboarding' : 'Not specified');
    const resolvedOther = otherReason || customReason || null;

    if (resolvedStatus === 'NO') {
      const isOther = resolvedReason === 'Other (specify below)' || resolvedReason === 'OTHER';
      const hasPredefinedReason = resolvedReason && resolvedReason !== 'Not specified' && !isOther;
      const hasOtherReason = isOther && resolvedOther && resolvedOther.trim().length > 0;
      const hasWrittenReason = hasPredefinedReason || hasOtherReason;
      const hasAudio = !!resolvedVoice;

      if (!hasWrittenReason && !hasAudio) {
        return res.status(400).json({ success: false, message: 'Please provide a reason or a voice note.' });
      }
    }

    // Idempotency: check for duplicate visit created within last 15 seconds by this manager
    const fifteenSecsAgo = new Date(Date.now() - 15000);
    const existingVisits = await db.shopVisits.find();
    const duplicate = existingVisits.find(v =>
      (v.recordedById === user.id || v.managerId === String(user.id || user._id)) &&
      (v.shopName || '').toLowerCase() === shopName.trim().toLowerCase() &&
      new Date(v.createdAt) >= fifteenSecsAgo
    );
    if (duplicate) {
      return res.status(200).json({
        success: true,
        message: 'Shop visit already recorded',
        data: duplicate
      });
    }

    const territory = {
      pincodeCode: user.scope?.pincodeCode || user.pincode || pincodeCode || pincode || null,
      pincode: user.scope?.pincodeCode || user.pincode || pincodeCode || pincode || null,
      pincodeId: user.pincodeId || pincodeId || null,
      divisionId: user.divisionId || divisionId || null,
      districtId: user.districtId || districtId || null,
      stateId: user.stateId || stateId || 'state_ka'
    };

    const newVisit = await db.shopVisits.insertOne({
      shopName: shopName.trim(),
      category: resolvedCategory,
      businessCategory: resolvedCategory,
      shopPhoto: resolvedPhoto,
      storefrontPhoto: resolvedPhoto,
      voiceNote: resolvedVoice,
      audioVoiceNote: resolvedVoice,
      interestedStatus: resolvedStatus,
      interestStatus: resolvedStatus,
      notInterestedReason: resolvedReason,
      otherReason: resolvedOther,
      vendorId: vendorId || null,
      ...territory,
      managerId: String(user.id || user._id),
      managerName: user.name,
      managerRole: user.role,
      managerLevel: user.role,
      recordedById: user.id,
      recordedByName: user.name,
      recordedByRole: user.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create audit log
    await db.auditLogs.insertOne({
      action: 'Shop Visit Logged',
      recordId: newVisit._id,
      recordType: 'shop_visit',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Logged visit for ${newVisit.shopName} - Interested: ${newVisit.interestedStatus}`,
      timestamp: new Date().toISOString()
    });

    // Broadcast notification
    await broadcastNotification({
      type: 'shop_visit',
      title: 'New Shop Visit Logged',
      message: `${user.name} logged field visit for ${newVisit.shopName} (${newVisit.interestedStatus === 'YES' ? 'Interested' : 'Not Interested'}).`,
      recordId: newVisit._id,
      userId: user.id,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ success: true, message: 'Shop visit recorded successfully in database', data: newVisit });
  } catch (err) {
    console.error('Error recording shop visit:', err);
    res.status(500).json({ success: false, message: 'Failed to record shop visit in database' });
  }
};

// PUT /api/shop-visits/:id - Update shop visit with IDOR and mass assignment defenses
const updateShopVisit = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = await db.shopVisits.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Shop visit record not found' });
    }

    // ── IDOR & Territory Authorization Check ──
    const isOwner = String(existing.recordedById || existing.managerId) === String(user.id || user._id);
    const isAdmin = ['admin', 'super_admin', 'super-admin'].includes(String(user.role).toLowerCase()) || user.email === 'admin@example.com';
    
    let isWithinScope = false;
    if (isAdmin || isOwner) {
      isWithinScope = true;
    } else if (user.role === 'state_manager') {
      isWithinScope = Boolean(user.stateId && existing.stateId && String(existing.stateId) === String(user.stateId));
    } else if (user.role === 'district_manager') {
      const stateMatch = !existing.stateId || (user.stateId && String(existing.stateId) === String(user.stateId));
      const distMatch = Boolean(user.districtId && existing.districtId && String(existing.districtId) === String(user.districtId));
      isWithinScope = stateMatch && distMatch;
    } else if (user.role === 'division_manager') {
      const stateMatch = !existing.stateId || (user.stateId && String(existing.stateId) === String(user.stateId));
      const distMatch = !existing.districtId || (user.districtId && String(existing.districtId) === String(user.districtId));
      const divMatch = Boolean(user.divisionId && existing.divisionId && String(existing.divisionId) === String(user.divisionId));
      isWithinScope = stateMatch && distMatch && divMatch;
    } else if (user.role === 'pincode_manager') {
      const stateMatch = !existing.stateId || (user.stateId && String(existing.stateId) === String(user.stateId));
      const distMatch = !existing.districtId || (user.districtId && String(existing.districtId) === String(user.districtId));
      const divMatch = !existing.divisionId || (user.divisionId && String(existing.divisionId) === String(user.divisionId));
      const pinMatch = Boolean(user.pincodeId && existing.pincodeId && String(existing.pincodeId) === String(user.pincodeId));
      isWithinScope = stateMatch && distMatch && divMatch && pinMatch;
    }

    if (!isWithinScope) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to modify shop visit records outside your assigned territory.'
      });
    }

    // ── Mass Assignment Defense: Allowlist only permitted editable fields ──
    const allowedFields = [
      'category', 'businessCategory', 'shopPhoto', 'storefrontPhoto',
      'voiceNote', 'audioVoiceNote', 'interestedStatus', 'interestStatus',
      'notInterestedReason', 'otherReason', 'customReason',
      'vendorId', 'status', 'onboardingStatus', 'onboardingStage'
    ];

    const safeUpdate = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        safeUpdate[field] = req.body[field];
      }
    }
    safeUpdate.updatedAt = new Date().toISOString();

    const updated = await db.shopVisits.findByIdAndUpdate(id, { $set: safeUpdate });

    res.json({ success: true, message: 'Shop visit updated successfully', data: updated });
  } catch (err) {
    console.error('Error updating shop visit:', err);
    res.status(500).json({ success: false, message: 'Failed to update shop visit' });
  }
};

module.exports = {
  getShopVisits,
  createShopVisit,
  updateShopVisit,
  revalidateEligibility,
  getShopVisitById
};
