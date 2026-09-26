const db = require('../config/db');
const { getScopeFilter, isVendorInScope } = require('../middleware/scopeMiddleware');
const { publishEntityEvent } = require('../realtime');

// Mask sensitive identifiers for security
const maskPan = (pan) => {
  if (!pan || pan.length < 5) return pan;
  return 'XXXXX' + pan.slice(5);
};

const maskAccount = (acc) => {
  if (!acc || acc.length < 4) return acc;
  const visible = acc.slice(-4);
  return '•'.repeat(Math.max(0, acc.length - 4)) + visible;
};

const maskGst = (gst) => {
  if (!gst || gst.length < 6) return gst;
  const stateCode = gst.slice(0, 2);
  const endCode = gst.slice(-3);
  return `${stateCode}•••••••••${endCode}`;
};

// Populate location names for response objects
const populateVendorLocations = async (vendor) => {
  const [state, district, division, pincode] = await Promise.all([
    vendor.stateId ? db.states.findById(vendor.stateId) : null,
    vendor.districtId ? db.districts.findById(vendor.districtId) : null,
    vendor.divisionId ? db.divisions.findById(vendor.divisionId) : null,
    vendor.pincodeId ? db.pincodes.findById(vendor.pincodeId) : null
  ]);

  return {
    ...vendor,
    stateName: state?.name || vendor.state || vendor.assignedState || '',
    districtName: district?.name || vendor.district || vendor.assignedDistrict || '',
    divisionName: division?.name || vendor.division || vendor.assignedDivision || '',
    pincodeCode: pincode?.code || vendor.pincode || '',
    pincodeArea: pincode?.areaName || vendor.area || ''
  };
};

// GET /api/vendors - Paginated, filtered, strictly scope-enforced
const getVendors = async (req, res) => {
  try {
    const user = req.user;

    // Extract query parameters
    const {
      search,
      category,
      subCategory,
      status,
      districtId,
      divisionId,
      pincodeId,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Load all vendors
    const rawVendors = await db.vendors.find({});

    // Deduplicate vendors by unique identifier (_id, phone, registrationId)
    const seenVendorKeys = new Set();
    const uniqueVendors = [];
    for (const v of rawVendors) {
      const key = String(v.registrationId || v._id || v.id || `${v.phone || v.mobile}_${v.businessName}`);
      if (!seenVendorKeys.has(key)) {
        seenVendorKeys.add(key);
        uniqueVendors.push(v);
      }
    }

    // Filter strictly by caller's scope
    const scopedVendors = uniqueVendors.filter(v => isVendorInScope(v, user));

    // Apply granular filters
    let filtered = scopedVendors.filter(v => {
      // 1. Search filter: matches vendor name, business name, registration ID, or mobile
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = (v.name || '').toLowerCase().includes(q);
        const matchesBiz = (v.businessName || '').toLowerCase().includes(q);
        const matchesMobile = (v.mobile || v.phone || '').includes(q);
        const matchesReg = (v.registrationId || '').toLowerCase().includes(q);
        if (!matchesName && !matchesBiz && !matchesMobile && !matchesReg) return false;
      }

      // 2. Category & Subcategory
      if (category && category !== 'All' && (v.category || '').toLowerCase() !== category.toLowerCase()) return false;
      if (subCategory && subCategory !== 'All' && (v.subCategory || '').toLowerCase() !== subCategory.toLowerCase()) return false;

      // 3. Status filter
      if (status && status !== 'All' && (v.status || '').toLowerCase() !== status.toLowerCase()) return false;

      // 4. Sub-location filters (bounded by scope) - match by ID or Name
      if (districtId) {
        const dId = String(districtId).toLowerCase();
        const matchesDistrict = (v.districtId && String(v.districtId).toLowerCase() === dId) ||
          (v.district && v.district.toLowerCase() === dId);
        if (!matchesDistrict) return false;
      }
      if (divisionId) {
        const divId = String(divisionId).toLowerCase();
        const matchesDiv = (v.divisionId && String(v.divisionId).toLowerCase() === divId) ||
          (v.division && v.division.toLowerCase() === divId);
        if (!matchesDiv) return false;
      }
      if (pincodeId) {
        const pinId = String(pincodeId).toLowerCase();
        const matchesPin = (v.pincodeId && String(v.pincodeId).toLowerCase() === pinId) ||
          (v.pincode && String(v.pincode).toLowerCase() === pinId);
        if (!matchesPin) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const fieldA = a[sortBy] || '';
      const fieldB = b[sortBy] || '';
      if (sortOrder === 'asc') return fieldA > fieldB ? 1 : -1;
      return fieldA < fieldB ? 1 : -1;
    });

    // Pagination
    const totalVendors = filtered.length;
    const currentPage = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const totalPages = Math.ceil(totalVendors / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const pagedVendors = filtered.slice(startIndex, startIndex + pageSize);

    // Populate and apply field-level masking
    const populated = await Promise.all(pagedVendors.map(async (v) => {
      const populatedVendor = await populateVendorLocations(v);
      return {
        ...populatedVendor,
        panNumber: maskPan(populatedVendor.panNumber),
        accountNumber: maskAccount(populatedVendor.accountNumber),
        gstNumber: maskGst(populatedVendor.gstNumber)
      };
    }));

    res.json({
      success: true,
      data: populated,
      pagination: {
        total: totalVendors,
        page: currentPage,
        limit: pageSize,
        totalPages
      }
    });
  } catch (err) {
    console.error('Get vendors error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve vendors' });
  }
};

// GET /api/vendors/:id - Vendor details
const getVendorById = async (req, res) => {
  try {
    // req.targetVendor is already verified to be in scope by verifyVendorScope middleware
    const vendor = req.targetVendor;
    const populated = await populateVendorLocations(vendor);

    // Check if client requested unmasked view (detail view permission)
    const showFull = req.query.unmask === 'true';

    const responseData = {
      ...populated,
      panNumber: showFull ? populated.panNumber : maskPan(populated.panNumber),
      accountNumber: showFull ? populated.accountNumber : maskAccount(populated.accountNumber),
      gstNumber: showFull ? populated.gstNumber : maskGst(populated.gstNumber),
      isMasked: !showFull
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (err) {
    console.error('Get vendor by id error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch vendor details' });
  }
};

// POST /api/vendors - Create Vendor
const createVendor = async (req, res) => {
  try {
    const user = req.user;
    const {
      name,
      mobile,
      email,
      businessName,
      category,
      subCategory,
      description,
      stateId,
      districtId,
      divisionId,
      pincodeId,
      panNumber,
      gstNumber,
      accountHolderName,
      accountNumber,
      ifsc,
      bankName,
      documents = []
    } = req.body;

    if (!name || !mobile || !businessName || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile, business name, and category are required.'
      });
    }

    const newVendor = await db.vendors.insertOne({
      name,
      mobile,
      email: email || '',
      businessName,
      category,
      subCategory: subCategory || '',
      description: description || '',
      stateId,
      districtId,
      divisionId,
      pincodeId,
      panNumber: panNumber ? panNumber.toUpperCase() : '',
      gstNumber: gstNumber ? gstNumber.toUpperCase() : '',
      documents: Array.isArray(documents) ? documents : [],
      accountHolderName: accountHolderName || '',
      accountNumber: accountNumber || '',
      ifsc: ifsc ? ifsc.toUpperCase() : '',
      bankName: bankName || '',
      status: 'Pending',
      statusNotes: 'New vendor onboarding submitted. Awaiting document inspection.',
      createdBy: user.id
    });

    // Record audit log
    await db.auditLogs.insertOne({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'Vendor Created',
      module: 'Vendors',
      recordId: newVendor._id,
      previousValue: null,
      newValue: {
        businessName: newVendor.businessName,
        status: newVendor.status,
        pincodeId: newVendor.pincodeId
      },
      timestamp: new Date().toISOString()
    });

    const populated = await populateVendorLocations(newVendor);

    // Broadcast real-time ecosystem event
    publishEntityEvent({
      entity: 'vendor',
      action: 'created',
      entityId: newVendor._id,
      data: populated,
      scope: {
        stateId: newVendor.stateId || newVendor.state,
        districtId: newVendor.districtId || newVendor.district,
        divisionId: newVendor.divisionId || newVendor.division,
        pincodeId: newVendor.pincodeId || newVendor.pincode
      }
    });

    res.status(201).json({
      success: true,
      message: 'Vendor successfully registered',
      data: populated
    });
  } catch (err) {
    console.error('Create vendor error:', err);
    res.status(500).json({ success: false, message: 'Failed to create vendor' });
  }
};

// PUT /api/vendors/:id - Update Vendor
const updateVendor = async (req, res) => {
  try {
    const user = req.user;
    const vendor = req.targetVendor;
    const updates = req.body;

    // Prevent changing core location IDs post-creation via standard edit
    const safeUpdates = {
      name: updates.name ?? vendor.name,
      mobile: updates.mobile ?? vendor.mobile,
      email: updates.email ?? vendor.email,
      businessName: updates.businessName ?? vendor.businessName,
      category: updates.category ?? vendor.category,
      subCategory: updates.subCategory ?? vendor.subCategory,
      description: updates.description ?? vendor.description,
      panNumber: updates.panNumber ? updates.panNumber.toUpperCase() : vendor.panNumber,
      gstNumber: updates.gstNumber ? updates.gstNumber.toUpperCase() : vendor.gstNumber,
      accountHolderName: updates.accountHolderName ?? vendor.accountHolderName,
      accountNumber: updates.accountNumber ?? vendor.accountNumber,
      ifsc: updates.ifsc ? updates.ifsc.toUpperCase() : vendor.ifsc,
      bankName: updates.bankName ?? vendor.bankName,
      documents: updates.documents ?? vendor.documents
    };

    const previousSnapshot = {
      name: vendor.name,
      businessName: vendor.businessName,
      category: vendor.category
    };

    const updated = await db.vendors.findByIdAndUpdate(vendor._id, safeUpdates);

    // Record audit log
    await db.auditLogs.insertOne({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'Vendor Updated',
      module: 'Vendors',
      recordId: vendor._id,
      previousValue: previousSnapshot,
      newValue: {
        name: updated.name,
        businessName: updated.businessName,
        category: updated.category
      },
      timestamp: new Date().toISOString()
    });

    const populated = await populateVendorLocations(updated);

    // Broadcast real-time ecosystem event
    publishEntityEvent({
      entity: 'vendor',
      action: 'updated',
      entityId: updated._id,
      data: populated,
      scope: {
        stateId: updated.stateId || updated.state,
        districtId: updated.districtId || updated.district,
        divisionId: updated.divisionId || updated.division,
        pincodeId: updated.pincodeId || updated.pincode
      }
    });

    res.json({
      success: true,
      message: 'Vendor details updated successfully',
      data: populated
    });
  } catch (err) {
    console.error('Update vendor error:', err);
    res.status(500).json({ success: false, message: 'Failed to update vendor' });
  }
};

// PATCH /api/vendors/:id/status - Status Transition State Machine
const updateVendorStatus = async (req, res) => {
  try {
    const user = req.user;
    const vendor = req.targetVendor;
    const { status: newStatus, notes = '' } = req.body;

    if (!newStatus) {
      return res.status(400).json({ success: false, message: 'Target status is required' });
    }

    // Managers do not have permission to deactivate vendors
    if (newStatus === 'Inactive') {
      return res.status(403).json({
        success: false,
        message: 'Managers do not have permission to deactivate vendors. Deactivation must be requested through Central Administration.'
      });
    }

    const currentStatus = vendor.status || 'Pending';

    // State machine transitions:
    // Supported statuses: Pending, Under Review, Approved, Rejected, Active, Inactive
    // Managers are restricted from transitioning vendors to Inactive
    const ALLOWED_TRANSITIONS = {
      'Pending': ['Under Review', 'Rejected'],
      'Under Review': ['Approved', 'Rejected'],
      'Approved': ['Active'],
      'Active': [],
      'Inactive': ['Active'],
      'Rejected': [] // Rejected is a final state for managers
    };

    const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!validNextStates.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${validNextStates.join(', ') || 'None'}`
      });
    }

    let actionName = 'Status Changed';
    if (newStatus === 'Approved') actionName = 'Vendor Approved';
    if (newStatus === 'Rejected') actionName = 'Vendor Rejected';

    const updated = await db.vendors.findByIdAndUpdate(vendor._id, {
      status: newStatus,
      statusNotes: notes || `Status changed from ${currentStatus} to ${newStatus}`
    });

    // Record audit log
    await db.auditLogs.insertOne({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: actionName,
      module: 'Vendors',
      recordId: vendor._id,
      previousValue: { status: currentStatus, notes: vendor.statusNotes || '' },
      newValue: { status: newStatus, notes: updated.statusNotes },
      timestamp: new Date().toISOString()
    });

    const populated = await populateVendorLocations(updated);

    // Broadcast real-time ecosystem event
    publishEntityEvent({
      entity: 'vendor',
      action: 'updated',
      entityId: updated._id,
      data: populated,
      scope: {
        stateId: updated.stateId || updated.state,
        districtId: updated.districtId || updated.district,
        divisionId: updated.divisionId || updated.division,
        pincodeId: updated.pincodeId || updated.pincode
      }
    });

    res.json({
      success: true,
      message: `Vendor status successfully changed to ${newStatus}`,
      data: populated
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update vendor status' });
  }
};

module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus
};
