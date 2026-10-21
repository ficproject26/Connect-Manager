const db = require('../config/db');
const { getScopeFilter, isVendorInScope } = require('../middleware/scopeMiddleware');
const { publishEntityEvent, cacheManager } = require('../realtime');
const {
  formatName,
  validateName,
  normalizeEmail,
  validateEmail,
  cleanMobile,
  validateMobile,
  cleanPan,
  validatePan,
  cleanAadhaar,
  validateAadhaar,
  cleanAccountNumber,
  validateAccountNumber,
  cleanIfsc,
  validateIfsc
} = require('../utils/validation');

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

// High-speed in-memory location lookup map to eliminate N+1 database queries
const locationMemoryLookup = {
  states: new Map(),
  districts: new Map(),
  divisions: new Map(),
  pincodes: new Map()
};

const resolveLocationDoc = async (collection, id) => {
  if (!id) return null;
  const strId = String(id);
  const cache = locationMemoryLookup[collection];
  if (cache && cache.has(strId)) {
    return cache.get(strId);
  }
  const doc = await db[collection].findById(id).catch(() => null);
  if (doc && cache) {
    cache.set(strId, doc);
  }
  return doc;
};

// Fetch and normalize bank account details from vendor or linked user/onboarding records
const resolveVendorBankDetails = async (vendor) => {
  let accountNumber = vendor.accountNumber || vendor.accountNo || vendor.bankAccount || vendor.bankDetails?.accountNumber || vendor.bankDetails?.accountNo || '';
  let ifsc = vendor.ifsc || vendor.ifscCode || vendor.bankDetails?.ifscCode || vendor.bankDetails?.ifsc || '';
  let bankName = vendor.bankName || vendor.bank || vendor.bankDetails?.bankName || '';
  let accountHolderName = vendor.accountHolderName || vendor.accountHolder || vendor.bankDetails?.accountHolderName || vendor.bankDetails?.accountHolder || '';
  let bankBranch = vendor.bankBranch || vendor.branchName || vendor.bankDetails?.branchName || '';

  if (!accountNumber) {
    const userDoc = await db.users.findOne({
      $or: [
        ...(vendor.email ? [{ email: vendor.email }] : []),
        ...(vendor.phone ? [{ phone: vendor.phone }, { mobile: vendor.phone }] : []),
        ...(vendor.mobile ? [{ mobile: vendor.mobile }, { phone: vendor.mobile }] : []),
        ...(vendor.registrationId ? [{ registrationId: vendor.registrationId }] : []),
        ...((vendor._id || vendor.id) ? [{ vendorId: String(vendor._id || vendor.id) }] : [])
      ]
    }).catch(() => null);

    if (userDoc) {
      accountNumber = accountNumber || userDoc.accountNumber || userDoc.accountNo || userDoc.bankAccount || userDoc.bankDetails?.accountNumber || userDoc.bankDetails?.accountNo || '';
      ifsc = ifsc || userDoc.ifsc || userDoc.ifscCode || userDoc.bankDetails?.ifscCode || userDoc.bankDetails?.ifsc || '';
      bankName = bankName || userDoc.bankName || userDoc.bank || userDoc.bankDetails?.bankName || '';
      accountHolderName = accountHolderName || userDoc.accountHolderName || userDoc.accountHolder || userDoc.bankDetails?.accountHolderName || userDoc.name || '';
      bankBranch = bankBranch || userDoc.bankBranch || userDoc.branchName || userDoc.bankDetails?.branchName || '';
    }
  }

  return {
    ...vendor,
    accountNumber: accountNumber || null,
    ifsc: ifsc || null,
    bankName: bankName || null,
    accountHolderName: accountHolderName || null,
    bankBranch: bankBranch || null
  };
};

// Populate location names and normalize contact fields for response objects
const populateVendorLocations = async (vendor) => {
  const [state, district, division, pincode] = await Promise.all([
    vendor.stateId ? resolveLocationDoc('states', vendor.stateId) : null,
    vendor.districtId ? resolveLocationDoc('districts', vendor.districtId) : null,
    vendor.divisionId ? resolveLocationDoc('divisions', vendor.divisionId) : null,
    vendor.pincodeId ? resolveLocationDoc('pincodes', vendor.pincodeId) : null
  ]);

  const rawMobile = vendor.mobile || vendor.phone || vendor.mobileNumber || vendor.contactNumber || vendor.primaryPhone || '';
  const cleanMobile = rawMobile ? String(rawMobile).trim().replace(/^\+91\s*/, '') : '';

  const canonicalState = state?.name || vendor.state || vendor.assignedState || '';
  const canonicalDistrict = district?.name || vendor.district || vendor.assignedDistrict || '';
  const canonicalDivision = division?.name || vendor.division || vendor.assignedDivision || '';
  const canonicalPincode = pincode?.code || vendor.pincode || '';
  const canonicalArea = pincode?.areaName || vendor.area || vendor.pincodeArea || '';

  const canonicalAddress = vendor.address || vendor.location?.address || vendor.businessAddress || '';

  const rawBusinessImages = Array.isArray(vendor.businessImages) ? vendor.businessImages : [];
  const cleanBusinessImages = rawBusinessImages
    .filter(img => img && (typeof img === 'string' ? img.trim().length > 0 : Boolean(img.url || img.filename || img.path)))
    .map((img, idx) => {
      if (typeof img === 'string') {
        const fn = img.split('/').pop() || `storefront_${idx + 1}.jpg`;
        return { url: img, name: fn, filename: fn, type: 'image/jpeg' };
      }
      const url = img.url || img.path || '';
      const fn = img.filename || (url ? url.split('/').pop() : `storefront_${idx + 1}.jpg`);
      return {
        url,
        name: img.name || fn,
        filename: fn,
        size: img.size || 0,
        type: img.type || 'image/jpeg'
      };
    });

  return {
    ...vendor,
    mobile: cleanMobile || vendor.mobile || '',
    phone: cleanMobile || vendor.phone || '',
    address: canonicalAddress,
    businessAddress: canonicalAddress,
    businessImages: cleanBusinessImages,
    state: canonicalState,
    stateName: canonicalState,
    district: canonicalDistrict,
    districtName: canonicalDistrict,
    division: canonicalDivision,
    divisionName: canonicalDivision,
    pincode: canonicalPincode,
    pincodeCode: canonicalPincode,
    pincodeArea: canonicalArea
  };
};

const formatManagerRole = (role) => {
  const r = String(role || '').toLowerCase().trim();
  if (r.includes('state')) return 'State Manager';
  if (r.includes('district')) return 'District Manager';
  if (r.includes('division')) return 'Division Manager';
  if (r.includes('pincode') || r.includes('pin_code')) return 'Pincode Manager';
  if (r.includes('supervisor')) return 'Field Supervisor';
  if (r.includes('agent')) return 'Field Agent';
  if (r.includes('admin')) return 'Administrator';
  return role ? role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Field Manager';
};

// Populate assigned field manager and field supervisor from database single source of truth
const populateVendorManagers = async (vendor) => {
  if (!vendor) return vendor;

  const assigningManagerId = vendor.assignedManagerId || vendor.assignedTo || vendor.assignedManager || vendor.createdBy;
  let assigningManager = null;
  if (assigningManagerId) {
    assigningManager = (await db.users.findById(assigningManagerId).catch(() => null)) ||
                       (await db.managers.findById(assigningManagerId).catch(() => null));
    if (!assigningManager) {
      assigningManager = (await db.users.findOne({ $or: [{ id: assigningManagerId }, { managerId: assigningManagerId }] }).catch(() => null)) ||
                         (await db.managers.findOne({ $or: [{ id: assigningManagerId }, { managerId: assigningManagerId }] }).catch(() => null));
    }
  }

  const fieldSupervisorId = vendor.fieldSupervisorId || vendor.supervisorId;
  let fieldSupervisor = null;
  if (fieldSupervisorId && String(fieldSupervisorId) !== String(assigningManagerId)) {
    fieldSupervisor = (await db.users.findById(fieldSupervisorId).catch(() => null)) ||
                      (await db.managers.findById(fieldSupervisorId).catch(() => null));
  }

  const assignedFieldManager = assigningManager ? {
    id: assigningManager._id || assigningManager.id,
    name: assigningManager.name,
    role: assigningManager.role,
    designation: formatManagerRole(assigningManager.role),
    mobile: assigningManager.mobile || assigningManager.phone,
    email: assigningManager.email,
    managerId: assigningManager.managerId || null
  } : (vendor.assignedManagerName ? {
    name: vendor.assignedManagerName,
    role: vendor.assignedManagerRole || 'manager',
    designation: formatManagerRole(vendor.assignedManagerRole)
  } : null);

  const fieldSupervisorObj = fieldSupervisor ? {
    id: fieldSupervisor._id || fieldSupervisor.id,
    name: fieldSupervisor.name,
    role: fieldSupervisor.role,
    designation: 'Field Supervisor',
    mobile: fieldSupervisor.mobile || fieldSupervisor.phone
  } : (vendor.fieldSupervisorName ? {
    name: vendor.fieldSupervisorName,
    designation: 'Field Supervisor'
  } : null);

  // Dynamic Pincode Admin resolution
  let pincodeAdmin = null;
  const pincodeId = vendor.pincodeId;
  const pincodeCode = vendor.pincode || vendor.pincodeCode;
  if (pincodeId || pincodeCode) {
    pincodeAdmin = await db.users.findOne({
      role: { $in: ['pincode_admin', 'pincode_manager', 'sub_admin'] },
      $or: [
        ...(pincodeId ? [{ pincodeId: String(pincodeId) }] : []),
        ...(pincodeCode ? [{ pincode: String(pincodeCode) }] : [])
      ]
    }).catch(() => null);
  }

  const assignedPincodeAdminName = vendor.assignedPincodeAdminName ||
    vendor.pincodeAdminApproval?.decidedBy ||
    vendor.pincodeApproval?.approvedBy ||
    pincodeAdmin?.name ||
    null;

  const isApproved = ['Approved', 'Active'].includes(vendor.status) || vendor.approvalStatus === 'Approved';
  const isRejected = vendor.status === 'Rejected' || vendor.approvalStatus === 'Rejected';

  const pincodeAdminApproval = vendor.pincodeAdminApproval || (
    vendor.pincodeApproval ? {
      status: 'Approved',
      decidedBy: vendor.pincodeApproval.approvedBy || assignedPincodeAdminName || 'Pincode Administrator',
      decidedAt: vendor.pincodeApproval.approvedAt || vendor.updatedAt || vendor.createdAt
    } : (isApproved ? {
      status: 'Approved',
      decidedBy: assignedPincodeAdminName || 'Pincode Administrator',
      decidedAt: vendor.approvedAt || vendor.updatedAt || vendor.createdAt
    } : (isRejected ? {
      status: 'Rejected',
      decidedBy: assignedPincodeAdminName || 'Pincode Administrator',
      decidedAt: vendor.updatedAt || vendor.createdAt,
      rejectionReason: vendor.rejectionReason || vendor.statusNotes || 'Verification criteria not met'
    } : {
      status: 'Pending',
      decidedBy: null,
      assignedPincodeAdminName
    }))
  );

  let registeredBy = vendor.registeredBy || null;
  if (!registeredBy || typeof registeredBy !== 'object') {
    if (vendor.agentName || vendor.agentId) {
      registeredBy = {
        name: vendor.agentName || 'Field Agent',
        role: 'Agent'
      };
    } else if (assignedFieldManager) {
      registeredBy = {
        name: assignedFieldManager.name,
        role: assignedFieldManager.role ? String(assignedFieldManager.role).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Manager'
      };
    } else if (vendor.addedBy?.name) {
      registeredBy = {
        name: vendor.addedBy.name,
        role: vendor.addedBy.role || 'Manager'
      };
    } else if (vendor.source === 'vendor' || vendor.selfRegistered || !vendor.assignedManagerId) {
      registeredBy = {
        name: vendor.name || vendor.contactPerson || 'Vendor',
        role: 'Vendor (Self-registered)'
      };
    } else {
      registeredBy = {
        name: vendor.managerName || vendor.assignedManagerName || 'Field Manager',
        role: 'Manager'
      };
    }
  }

  return {
    ...vendor,
    assignedFieldManager,
    assignedManager: assignedFieldManager,
    fieldSupervisor: fieldSupervisorObj,
    addedBy: assignedFieldManager || vendor.addedBy || null,
    registeredBy,
    assignedPincodeAdminName,
    pincodeAdminApproval
  };
};


// Helper: Determine whether a vendor has a genuine incomplete draft
const isVendorIncompleteDraft = (v) => {
  if (!v) return false;
  const status = String(v.status || '').toLowerCase().trim();
  const approval = String(v.approvalStatus || '').toLowerCase().trim();
  const onboardingStatus = String(v.onboardingStatus || '').toLowerCase().trim();

  // If vendor is completed, active, approved, or rejected -> never an incomplete draft
  if (['approved', 'active', 'rejected', 'inactive'].includes(status)) return false;
  if (approval.includes('approved') || approval.includes('rejected')) return false;
  if (v.isCompleted === true || v.isOnboardingCompleted === true || onboardingStatus === 'completed') return false;

  // Genuine incomplete draft: explicitly flagged as draft, incomplete onboarding status, or partial step
  if (v.isDraft === true || onboardingStatus === 'draft' || onboardingStatus === 'incomplete' || onboardingStatus === 'in_progress') {
    return true;
  }
  if (v.currentStep && Number(v.currentStep) < 5) return true;
  if (v.step && Number(v.step) < 5) return true;

  return false;
};

// GET /api/vendors - Paginated, filtered, strictly scope-enforced
const getVendors = async (req, res) => {
  try {
    const user = req.user;
    const cacheKey = `vendors:list:${user?.id || user?._id || 'mgr'}:${JSON.stringify(req.query)}`;

    const payload = await cacheManager.fetchWithCache(cacheKey, async () => {
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

      // 3. Status filter (distinguish approval status vs operational status)
      if (status && status !== 'All') {
        const sQuery = status.toLowerCase();
        const vStatus = (v.status || '').toLowerCase();
        const vApproval = (v.approvalStatus || '').toLowerCase();
        const vOp = (v.operationalStatus || '').toLowerCase();

        if (sQuery === 'approved') {
          if (vStatus !== 'approved' && !vApproval.includes('approved')) return false;
        } else if (sQuery === 'active') {
          if (vStatus !== 'active' && vOp !== 'active') return false;
        } else if (sQuery === 'pending') {
          if (vStatus !== 'pending' && !vApproval.includes('pending')) return false;
        } else if (sQuery === 'under review') {
          if (vStatus !== 'under review' && vStatus !== 'under_review' && !vApproval.includes('review')) return false;
        } else if (sQuery === 'rejected') {
          if (vStatus !== 'rejected' && !vApproval.includes('rejected')) return false;
        } else if (sQuery === 'inactive') {
          if (vStatus !== 'inactive' && vOp !== 'inactive') return false;
        } else {
          if (vStatus !== sQuery && vApproval !== sQuery) return false;
        }
      }

      // 4. Sub-location filters (bounded by scope) - match by ID or Name
      if (districtId) {
        const dId = String(districtId).toLowerCase();
        let targetDistName = null;
        const distList = db.districts.cache && db.districts.cache.length > 0 ? db.districts.cache : [];
        const matchedD = distList.find(d => String(d._id || d.id).toLowerCase() === dId || d.name?.toLowerCase() === dId);
        if (matchedD && matchedD.name) targetDistName = matchedD.name.toLowerCase();
        const matchesDistrict = (v.districtId && String(v.districtId).toLowerCase() === dId) ||
          (v.district && v.district.toLowerCase() === dId) ||
          (targetDistName && v.district && v.district.toLowerCase() === targetDistName) ||
          (targetDistName && v.districtName && v.districtName.toLowerCase() === targetDistName);
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
      const enriched = await resolveVendorBankDetails(v);
      const populatedVendor = await populateVendorLocations(enriched);
      const withManagers = await populateVendorManagers(populatedVendor);
      const isDraftIncomplete = isVendorIncompleteDraft(withManagers);
      return {
        ...withManagers,
        isEligibleForResume: isDraftIncomplete,
        hasIncompleteDraft: isDraftIncomplete,
        panNumber: maskPan(withManagers.panNumber),
        accountNumber: maskAccount(withManagers.accountNumber),
        gstNumber: maskGst(withManagers.gstNumber)
      };
    }));

      return {
        success: true,
        data: populated,
        pagination: {
          total: totalVendors,
          page: currentPage,
          limit: pageSize,
          totalPages
        }
      };
    }, 300);

    res.json(payload);
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
    const enriched = await resolveVendorBankDetails(vendor);
    const populated = await populateVendorLocations(enriched);
    const withManagers = await populateVendorManagers(populated);

    // Check if client requested unmasked view (detail view permission)
    const showFull = req.query?.unmask === 'true' || req.query?.showFull === 'true';
    const isDraftIncomplete = isVendorIncompleteDraft(withManagers);
    const responseData = {
      ...withManagers,
      isEligibleForResume: isDraftIncomplete,
      hasIncompleteDraft: isDraftIncomplete,
      panNumber: showFull ? withManagers.panNumber : maskPan(withManagers.panNumber),
      accountNumber: showFull ? withManagers.accountNumber : maskAccount(withManagers.accountNumber),
      gstNumber: showFull ? withManagers.gstNumber : maskGst(withManagers.gstNumber),
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
      documents = [],
      businessImages = [],
      logo = null,
      businessLicense = null,
      storefrontPhoto = null,
      shopPhoto = null
    } = req.body;

    if (!name || !mobile || !businessName || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile, business name, and category are required.'
      });
    }

    const nameErr = validateName(name, true, 'Owner name');
    if (nameErr) return res.status(400).json({ success: false, message: nameErr });
    const formattedOwnerName = formatName(name);

    const mobileErr = validateMobile(mobile, true, 'Business mobile');
    if (mobileErr) return res.status(400).json({ success: false, message: mobileErr });
    const cleanPhone = cleanMobile(mobile);

    let cleanEmail = '';
    if (email) {
      const emailErr = validateEmail(email, false);
      if (emailErr) return res.status(400).json({ success: false, message: emailErr });
      cleanEmail = normalizeEmail(email);
    }

    // Bug 14: Vendor Aadhaar and PAN are mandatory for non-draft onboarding submission
    const isDraft = Boolean(req.body.isDraft || req.body.status === 'Draft' || req.body.isDraftIncomplete);
    const rawPan = panNumber || req.body.pan || req.body.panNumber;
    const rawAadhaar = req.body.aadhaarNumber || req.body.aadhaar;

    let cleanPanNumber = '';
    if (!isDraft && !rawPan) {
      return res.status(400).json({ success: false, message: 'Vendor PAN number is mandatory.' });
    }
    if (rawPan) {
      const panErr = validatePan(rawPan, !isDraft);
      if (panErr) return res.status(400).json({ success: false, message: panErr });
      cleanPanNumber = cleanPan(rawPan);
    }

    let cleanAccNum = '';
    let cleanIfscCode = '';
    let formattedHolderName = '';
    if (accountNumber) {
      const accErr = validateAccountNumber(accountNumber, false, bankName);
      if (accErr) return res.status(400).json({ success: false, message: accErr });
      cleanAccNum = cleanAccountNumber(accountNumber);
    }
    if (ifsc) {
      const ifscErr = validateIfsc(ifsc, false);
      if (ifscErr) return res.status(400).json({ success: false, message: ifscErr });
      cleanIfscCode = cleanIfsc(ifsc);
    }
    if (accountHolderName) {
      const holderErr = validateName(accountHolderName, false, 'Account Holder Name');
      if (holderErr) return res.status(400).json({ success: false, message: holderErr });
      formattedHolderName = formatName(accountHolderName);
    }

    let cleanAadhaarNum = '';
    if (!isDraft && !rawAadhaar) {
      return res.status(400).json({ success: false, message: 'Vendor Aadhaar number is mandatory.' });
    }
    if (rawAadhaar) {
      const aadharErr = validateAadhaar(rawAadhaar, !isDraft);
      if (aadharErr) return res.status(400).json({ success: false, message: aadharErr });
      cleanAadhaarNum = cleanAadhaar(rawAadhaar);
    }

    let cleanAltPhone = '';
    if (req.body.alternatePhone) {
      const altErr = validateMobile(req.body.alternatePhone, false, 'Alternate mobile');
      if (altErr) return res.status(400).json({ success: false, message: altErr });
      cleanAltPhone = cleanMobile(req.body.alternatePhone);
    }

    let formattedAgentName = '';
    if (req.body.agentName) {
      const agErr = validateName(req.body.agentName, false, 'Agent name');
      if (agErr) return res.status(400).json({ success: false, message: agErr });
      formattedAgentName = formatName(req.body.agentName);
    }

    let formattedCoPartner = '';
    if (req.body.coPartnerName) {
      const cpErr = validateName(req.body.coPartnerName, false, 'Co-partner name');
      if (cpErr) return res.status(400).json({ success: false, message: cpErr });
      formattedCoPartner = formatName(req.body.coPartnerName);
    }

    if (String(businessName).trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Business name must not exceed 100 characters.' });
    }
    if (description && String(description).trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Business description must not exceed 1000 characters.' });
    }
    if (req.body.address && String(req.body.address).trim().length > 250) {
      return res.status(400).json({ success: false, message: 'Business address must not exceed 250 characters.' });
    }

    const fieldVisitId = req.body.fieldVisitId || null;
    const cleanBusiness = String(businessName).trim().toLowerCase();

    // 1. Phone OTP Verification Enforcement
    const phoneRecord = vendorPhoneOtpStore.get(cleanPhone);
    const isPhoneVerified = (req.body.phoneVerified === true || req.body.isPhoneVerified === true) ||
      (phoneRecord && phoneRecord.verified && (Date.now() - phoneRecord.verifiedAt < 30 * 60 * 1000));
    if (!isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Business phone number must be verified via OTP before completing onboarding.'
      });
    }

    // 2. Separate GST Validation: Format check and Duplicate GSTIN prevention
    const rawGst = String(gstNumber || req.body.gst || '').trim().toUpperCase();
    if (rawGst) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(rawGst)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid 15-character GSTIN format (e.g. 29ABCDE1234F1Z5).'
        });
      }
    }

    const existingVendors = await db.vendors.find();

    // Prevent duplicate GST registration across active/pending vendors
    if (rawGst) {
      const duplicateGst = existingVendors.find(v => {
        const vg = String(v.gstNumber || v.gst || '').trim().toUpperCase();
        return vg && vg === rawGst && ['Approved', 'Active', 'Completed', 'Pending'].includes(v.status);
      });
      if (duplicateGst) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          message: `A vendor record with GSTIN "${rawGst}" is already registered (${duplicateGst.businessName || duplicateGst.name}). Duplicate GST registrations are not permitted.`,
          vendor: duplicateGst
        });
      }
    }

    // Duplicate Prevention:
    // Allow the same business phone to be used for separate company registrations.
    // Only block if the exact same business name AND phone is already onboarded.
    const existingMatch = existingVendors.find(v => {
      if (fieldVisitId && String(v.fieldVisitId) === String(fieldVisitId)) return true;
      const vp = String(v.phone || v.mobile || '').trim().replace(/\D/g, '').slice(-10);
      const vn = String(v.businessName || v.name || '').trim().toLowerCase();
      if (vn === cleanBusiness && vp === cleanPhone) return true;
      return false;
    });

    if (existingMatch) {
      const isCompleted = ['Approved', 'Active', 'Completed'].includes(existingMatch.status);
      if (isCompleted) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          message: `Vendor "${existingMatch.businessName || existingMatch.name}" with this phone number is already onboarded (${existingMatch.status}).`,
          vendor: existingMatch
        });
      }
    }

    const merchantAddress = String(req.body.address || req.body.businessAddress || '').trim();

    const cleanBusinessImages = (Array.isArray(businessImages) ? businessImages : [])
      .filter(img => {
        if (!img) return false;
        if (typeof img === 'string') return img.trim().length > 0;
        if (typeof img === 'object') return Boolean(img.url || img.filename || img.path);
        return false;
      })
      .slice(0, 5)
      .map((img, idx) => {
        if (typeof img === 'string') {
          const fn = img.split('/').pop() || `storefront_${idx + 1}.jpg`;
          return { url: img, name: fn, filename: fn, type: 'image/jpeg' };
        }
        const url = img.url || img.path || '';
        const fn = img.filename || (url ? url.split('/').pop() : `storefront_${idx + 1}.jpg`);
        return {
          url,
          name: img.name || fn,
          filename: fn,
          size: img.size || 0,
          type: img.type || 'image/jpeg'
        };
      });

    const primaryStorefront = storefrontPhoto || shopPhoto || (cleanBusinessImages.length > 0 ? cleanBusinessImages[0].url : null);

    const [stateDoc, districtDoc, divisionDoc, pincodeDoc] = await Promise.all([
      stateId ? resolveLocationDoc('states', stateId) : null,
      districtId ? resolveLocationDoc('districts', districtId) : null,
      divisionId ? resolveLocationDoc('divisions', divisionId) : null,
      pincodeId ? resolveLocationDoc('pincodes', pincodeId) : null
    ]);

    const registeredRole = (user.role ? String(user.role).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Manager');
    const registeredByObj = {
      id: user.id || user._id,
      name: user.name || 'Manager',
      role: registeredRole
    };

    const newVendor = await db.vendors.insertOne({
      name: formattedOwnerName,
      mobile: cleanPhone,
      phone: cleanPhone,
      email: cleanEmail,
      businessName,
      category,
      subCategory: subCategory || '',
      description: description || '',
      address: merchantAddress,
      businessAddress: merchantAddress,
      location: {
        address: merchantAddress,
        latitude: req.body.latitude || 12.9716,
        longitude: req.body.longitude || 77.5946
      },
      stateId: stateId || stateDoc?._id || stateDoc?.id || null,
      state: stateDoc?.name || req.body.state || '',
      districtId: districtId || districtDoc?._id || districtDoc?.id || null,
      district: districtDoc?.name || req.body.district || '',
      divisionId: divisionId || divisionDoc?._id || divisionDoc?.id || null,
      division: divisionDoc?.name || req.body.division || '',
      pincodeId: pincodeId || pincodeDoc?._id || pincodeDoc?.id || null,
      pincode: pincodeDoc?.code || req.body.pincode || '',
      pincodeArea: pincodeDoc?.areaName || req.body.pincodeArea || '',
      fieldVisitId,
      panNumber: cleanPanNumber,
      gstNumber: rawGst || '',
      gst: rawGst || '',
      documents: Array.isArray(documents) ? documents : [],
      businessImages: cleanBusinessImages,
      logo: logo || null,
      businessLicense: businessLicense || null,
      storefrontPhoto: primaryStorefront,
      shopPhoto: primaryStorefront,
      accountHolderName: formattedHolderName,
      accountNumber: cleanAccNum,
      ifsc: cleanIfscCode,
      bankName: bankName || '',
      status: 'Pending',
      statusNotes: 'New vendor onboarding submitted. Awaiting document inspection.',
      isActive: false,
      isApproved: false,
      kycStatus: 'pending',
      createdBy: user.id || user._id,
      createdByName: user.name || null,
      createdByRole: user.role || null,
      registeredBy: registeredByObj,
      assignedManagerId: user.id || user._id,
      assignedManagerName: user.name || null,
      assignedManagerRole: user.role || null,
      assignedAt: new Date().toISOString()
    });

    // Invalidate aggregated dashboard and leaderboard cache so metrics reflect immediately
    await cacheManager.invalidateEntity('vendor', newVendor._id);
    await cacheManager.purgeLocalEntity('vendors', null, true);

    // If originated from a field shop visit, link it immediately
    if (fieldVisitId) {
      try {
        const visit = await db.shopVisits.findById(fieldVisitId);
        if (visit) {
          const isCompleted = newVendor.status === 'Approved' || newVendor.status === 'Active';
          await db.shopVisits.findByIdAndUpdate(fieldVisitId, {
            $set: {
              vendorId: String(newVendor._id || newVendor.id),
              onboardingStatus: isCompleted ? 'COMPLETED' : 'INCOMPLETE',
              status: isCompleted ? 'Onboarded' : 'Onboarding In Progress',
              updatedAt: new Date().toISOString()
            }
          });
        }
      } catch (ve) {
        console.warn('Failed to link shop visit with new vendor:', ve.message);
      }
    }

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
    const updates = req.body || {};
    if (updates.name) {
      const nameErr = validateName(updates.name, true, 'Owner name');
      if (nameErr) return res.status(400).json({ success: false, message: nameErr });
      updates.name = formatName(updates.name);
    }
    if (updates.mobile) {
      const mobileErr = validateMobile(updates.mobile, true, 'Business mobile');
      if (mobileErr) return res.status(400).json({ success: false, message: mobileErr });
      updates.mobile = cleanMobile(updates.mobile);
    }
    if (updates.email) {
      const emailErr = validateEmail(updates.email, false);
      if (emailErr) return res.status(400).json({ success: false, message: emailErr });
      updates.email = normalizeEmail(updates.email);
    }
    if (updates.panNumber) {
      const panErr = validatePan(updates.panNumber, false);
      if (panErr) return res.status(400).json({ success: false, message: panErr });
      updates.panNumber = cleanPan(updates.panNumber);
    }
    if (updates.accountNumber) {
      const accErr = validateAccountNumber(updates.accountNumber, false, updates.bankName || vendor.bankName);
      if (accErr) return res.status(400).json({ success: false, message: accErr });
      updates.accountNumber = cleanAccountNumber(updates.accountNumber);
    }
    if (updates.ifsc) {
      const ifscErr = validateIfsc(updates.ifsc, false);
      if (ifscErr) return res.status(400).json({ success: false, message: ifscErr });
      updates.ifsc = cleanIfsc(updates.ifsc);
    }
    if (updates.accountHolderName) {
      const holderErr = validateName(updates.accountHolderName, false, 'Account Holder Name');
      if (holderErr) return res.status(400).json({ success: false, message: holderErr });
      updates.accountHolderName = formatName(updates.accountHolderName);
    }
    if (updates.aadhaarNumber) {
      const aadharErr = validateAadhaar(updates.aadhaarNumber, false);
      if (aadharErr) return res.status(400).json({ success: false, message: aadharErr });
      updates.aadhaarNumber = cleanAadhaar(updates.aadhaarNumber);
    }
    if (updates.alternatePhone) {
      const altErr = validateMobile(updates.alternatePhone, false, 'Alternate mobile');
      if (altErr) return res.status(400).json({ success: false, message: altErr });
      updates.alternatePhone = cleanMobile(updates.alternatePhone);
    }
    if (updates.agentName) {
      const agErr = validateName(updates.agentName, false, 'Agent name');
      if (agErr) return res.status(400).json({ success: false, message: agErr });
      updates.agentName = formatName(updates.agentName);
    }
    if (updates.coPartnerName) {
      const cpErr = validateName(updates.coPartnerName, false, 'Co-partner name');
      if (cpErr) return res.status(400).json({ success: false, message: cpErr });
      updates.coPartnerName = formatName(updates.coPartnerName);
    }
    if (updates.businessName && String(updates.businessName).trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Business name must not exceed 100 characters.' });
    }
    if (updates.description && String(updates.description).trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Business description must not exceed 1000 characters.' });
    }
    if (updates.address && String(updates.address).trim().length > 250) {
      return res.status(400).json({ success: false, message: 'Business address must not exceed 250 characters.' });
    }

    // Prevent changing core location IDs post-creation via standard edit
    const safeUpdates = {
      name: updates.name ?? vendor.name,
      mobile: updates.mobile ?? vendor.mobile,
      email: updates.email ?? vendor.email,
      businessName: updates.businessName ?? vendor.businessName,
      category: updates.category ?? vendor.category,
      subCategory: updates.subCategory ?? vendor.subCategory,
      description: updates.description ?? vendor.description,
      panNumber: updates.panNumber ?? vendor.panNumber,
      gstNumber: updates.gstNumber ? updates.gstNumber.toUpperCase() : vendor.gstNumber,
      accountHolderName: updates.accountHolderName ?? vendor.accountHolderName,
      accountNumber: updates.accountNumber ?? vendor.accountNumber,
      ifsc: updates.ifsc ?? vendor.ifsc,
      bankName: updates.bankName ?? vendor.bankName,
      documents: updates.documents ?? vendor.documents,
      businessImages: updates.businessImages !== undefined
        ? (Array.isArray(updates.businessImages) ? updates.businessImages : [])
            .filter(img => img && (typeof img === 'string' ? img.trim().length > 0 : Boolean(img.url || img.filename || img.path)))
            .map((img, idx) => typeof img === 'string' ? { url: img, name: img.split('/').pop() || `storefront_${idx + 1}.jpg`, type: 'image/jpeg' } : img)
        : vendor.businessImages,
      logo: updates.logo !== undefined ? updates.logo : vendor.logo,
      businessLicense: updates.businessLicense !== undefined ? updates.businessLicense : vendor.businessLicense,
      storefrontPhoto: updates.storefrontPhoto !== undefined ? updates.storefrontPhoto : vendor.storefrontPhoto,
      shopPhoto: updates.shopPhoto !== undefined ? updates.shopPhoto : vendor.shopPhoto
    };

    const previousSnapshot = {
      name: vendor.name,
      businessName: vendor.businessName,
      category: vendor.category
    };

    const updated = await db.vendors.findByIdAndUpdate(vendor._id, safeUpdates);

    // Invalidate cached lists and entity
    await cacheManager.invalidateEntity('vendor', vendor._id);
    await cacheManager.purgeLocalEntity('vendors', null, true);

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
      'Pending': ['Under Review', 'Approved', 'Active', 'Rejected'],
      'Under Review': ['Approved', 'Active', 'Rejected'],
      'Approved': ['Active', 'Suspended'],
      'Active': ['Suspended', 'Rejected'],
      'Suspended': ['Active'],
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

    const updatePayload = {
      status: newStatus,
      statusNotes: notes || `Status changed from ${currentStatus} to ${newStatus}`
    };
    if (newStatus === 'Approved' || newStatus === 'Active') {
      updatePayload.isActive = true;
      updatePayload.isApproved = true;
    } else if (newStatus === 'Rejected') {
      updatePayload.isActive = false;
      updatePayload.isApproved = false;
    } else if (newStatus === 'Suspended') {
      updatePayload.isActive = false;
    }
    const updated = await db.vendors.findByIdAndUpdate(vendor._id, updatePayload);

    // Resolve any pending onboarding notifications for this vendor
    if (['Approved', 'Active', 'Rejected'].includes(newStatus)) {
      try {
        const pendingNotifs = await db.notifications.find({ recordId: vendor._id, isRead: false });
        for (const pn of (pendingNotifs || [])) {
          await db.notifications.findByIdAndUpdate(pn._id, { $set: { isRead: true, isResolved: true } });
        }
      } catch (ne) {}
    }

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

// Secure In-Memory Store for Vendor Phone Verification OTPs
const vendorPhoneOtpStore = new Map();
const VENDOR_OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const VENDOR_OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown

// POST /api/vendors/otp/send - Send OTP to business phone
const sendVendorPhoneOtp = async (req, res) => {
  try {
    const rawPhone = (req.body.phone || req.body.mobile || '').toString().trim();
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

    if (!cleanPhone || !/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian business phone number starting with 6-9.'
      });
    }

    const existing = vendorPhoneOtpStore.get(cleanPhone);
    if (existing && existing.createdAt) {
      const elapsed = Date.now() - existing.createdAt;
      if (elapsed < VENDOR_OTP_RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((VENDOR_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          cooldown: true,
          remainingSeconds,
          message: `Please wait ${remainingSeconds} second(s) before requesting a new OTP.`
        });
      }
    }

    let otp;
    do {
      otp = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    } while (existing && existing.otp === otp);

    vendorPhoneOtpStore.set(cleanPhone, {
      otp,
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + VENDOR_OTP_EXPIRY_MS,
      verified: false
    });

    const responsePayload = {
      success: true,
      cooldownSeconds: 30,
      message: `OTP sent successfully to +91 ${cleanPhone}. Valid for 5 minutes.`
    };

    // Development/testing mode: provide dummy OTP for validation testing
    if (process.env.ENABLE_DUMMY_OTP !== 'false' || process.env.NODE_ENV !== 'production') {
      responsePayload.otp = otp;
      responsePayload.isDummyOtp = true;
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error('Send vendor phone OTP error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP to business phone.' });
  }
};

// POST /api/vendors/otp/verify - Verify OTP for business phone
const verifyVendorPhoneOtp = async (req, res) => {
  try {
    const rawPhone = (req.body.phone || req.body.mobile || '').toString().trim();
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    const code = (req.body.otp || req.body.code || '').toString().trim();

    if (!cleanPhone || !code) {
      return res.status(400).json({ success: false, message: 'Business phone number and 6-digit OTP are required.' });
    }

    const record = vendorPhoneOtpStore.get(cleanPhone);
    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No OTP requested for this phone number or session expired. Please request OTP again.'
      });
    }

    if (Date.now() > record.expiresAt) {
      vendorPhoneOtpStore.delete(cleanPhone);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    if (record.attempts >= 5) {
      vendorPhoneOtpStore.delete(cleanPhone);
      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      });
    }

    if (record.otp !== code) {
      record.attempts += 1;
      const remaining = 5 - record.attempts;
      return res.status(400).json({
        success: false,
        message: remaining > 0 ? `Incorrect OTP. ${remaining} attempt(s) remaining.` : 'Maximum verification attempts exceeded. Please request a new OTP.'
      });
    }

    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(24).toString('hex');
    vendorPhoneOtpStore.set(cleanPhone, {
      ...record,
      verified: true,
      verifiedAt: Date.now(),
      verificationToken
    });

    return res.json({
      success: true,
      verified: true,
      verificationToken,
      phone: cleanPhone,
      message: 'Business phone verified successfully.'
    });
  } catch (err) {
    console.error('Verify vendor phone OTP error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
  }
};

module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  resolveVendorBankDetails,
  populateVendorLocations,
  isVendorIncompleteDraft,
  sendVendorPhoneOtp,
  verifyVendorPhoneOtp,
  vendorPhoneOtpStore
};
