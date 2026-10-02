const db = require('../config/db');
const { getScopeFilter } = require('../middleware/scopeMiddleware');
const { broadcastNotification } = require('../routes/notificationRoutes');

// GET /api/shop-visits - Get scoped list of shop visits with pagination & search
const getShopVisits = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 15, search, status, category, scope } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;

    const allVisits = await db.shopVisits.find();

    let filtered = allVisits.filter(v => {
      // Jurisdiction scope
      if (user.role === 'state_manager' && user.stateId && v.stateId && v.stateId !== user.stateId) return false;
      if (user.role === 'district_manager' && user.districtId && v.districtId && v.districtId !== user.districtId) return false;
      if (user.role === 'division_manager' && user.divisionId && v.divisionId && v.divisionId !== user.divisionId) return false;
      if (user.role === 'pincode_manager' && user.pincodeId && v.pincodeId && v.pincodeId !== user.pincodeId) return false;

      // Status filter ('YES', 'NO', 'Converted')
      if (status && status !== 'All') {
        if (v.interestedStatus !== status && v.status !== status) return false;
      }

      // Category filter
      if (category && category !== 'All' && v.category !== category) return false;

      // Search filter
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const matchName = (v.shopName || '').toLowerCase().includes(q);
        const matchReason = (v.notInterestedReason || '').toLowerCase().includes(q);
        const matchCat = (v.category || '').toLowerCase().includes(q);
        if (!matchName && !matchReason && !matchCat) return false;
      }

      return true;
    });

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      total,
      data: paginated,
      visits: paginated,
      pagination: {
        page: pageNum,
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

// PUT /api/shop-visits/:id - Update shop visit
const updateShopVisit = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const updateData = req.body;

    const existing = await db.shopVisits.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Shop visit record not found' });
    }

    const updated = await db.shopVisits.findByIdAndUpdate(id, { $set: updateData });

    res.json({ success: true, message: 'Shop visit updated successfully', data: updated });
  } catch (err) {
    console.error('Error updating shop visit:', err);
    res.status(500).json({ success: false, message: 'Failed to update shop visit' });
  }
};

module.exports = {
  getShopVisits,
  createShopVisit,
  updateShopVisit
};
