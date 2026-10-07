const db = require('../config/db');
const { getScopeFilter, isVendorInScope } = require('../middleware/scopeMiddleware');

// Helper to determine status category accurately
const isVendorActive = (s) => {
  const st = String(s || '').toLowerCase();
  return st === 'active' || st === 'approved';
};
const isVendorPending = (s) => {
  const st = String(s || '').toLowerCase();
  return st === 'pending' || st === 'under review' || st === 'under_review' || st === 'kyc_pending';
};
const isVendorRejected = (s) => String(s || '').toLowerCase() === 'rejected';
const isVendorInactive = (s) => String(s || '').toLowerCase() === 'inactive';

// GET /api/reports/dashboard - Tailored KPI widgets and analytics by role
const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;

    // Load all vendors and deduplicate
    const rawVendors = await db.vendors.find({});
    const seen = new Set();
    const uniqueVendors = [];
    for (const v of rawVendors) {
      const key = String(v.registrationId || v._id || v.id || `${v.phone || v.mobile}_${v.businessName}`);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueVendors.push(v);
      }
    }

    // Filter strictly by caller's scope
    const vendors = uniqueVendors.filter(v => isVendorInScope(v, user));

    // Common status counts computed live from database
    const statusCounts = {
      total: vendors.length,
      active: vendors.filter(v => isVendorActive(v.status)).length,
      pending: vendors.filter(v => isVendorPending(v.status)).length,
      underReview: vendors.filter(v => String(v.status || '').toLowerCase().includes('review')).length,
      rejected: vendors.filter(v => isVendorRejected(v.status)).length,
      inactive: vendors.filter(v => isVendorInactive(v.status)).length
    };

    // Category distribution
    const categoryCounts = {};
    vendors.forEach(v => {
      const cat = v.category || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    let roleSpecificData = {};

    if (user.role === 'state_manager') {
      const state = await db.states.findById(user.stateId);
      const districts = await db.districts.find({ stateId: user.stateId });
      const divisions = await db.divisions.find({ stateId: user.stateId });
      const pincodes = await db.pincodes.find({ stateId: user.stateId });

      // Find state managers
      const stateManagers = await db.users.find({
        role: 'state_manager',
        stateId: user.stateId
      });

      // Count lower-level managers (District, Division, Pincode) under this State
      const allUsers = await db.users.find();
      const lowerManagers = allUsers.filter(u => 
        u.stateId === user.stateId && 
        ['district_manager', 'division_manager', 'pincode_manager'].includes(u.role)
      );

      // District breakdown
      const districtBreakdown = districts.map(d => {
        const districtVendors = vendors.filter(v => 
          (v.districtId && v.districtId === d._id) ||
          (v.district && v.district.toLowerCase() === (d.name || '').toLowerCase())
        );
        return {
          districtId: d._id,
          districtName: d.name,
          totalVendors: districtVendors.length,
          activeVendors: districtVendors.filter(v => isVendorActive(v.status)).length,
          pendingVendors: districtVendors.filter(v => isVendorPending(v.status)).length,
          rejectedVendors: districtVendors.filter(v => isVendorRejected(v.status)).length
        };
      });

      roleSpecificData = {
        stateName: state?.name || 'Assigned State',
        totalStateManagers: stateManagers.length,
        stateManagersList: stateManagers.map(m => ({ id: m._id, name: m.name, email: m.email, mobile: m.mobile })),
        totalLowerManagers: lowerManagers.length,
        totalDistricts: districts.length,
        totalDivisions: divisions.length,
        totalPincodes: pincodes.length,
        districtBreakdown
      };
    } else if (user.role === 'district_manager') {
      const district = await db.districts.findById(user.districtId);
      const divisions = await db.divisions.find({ districtId: user.districtId });
      const pincodes = await db.pincodes.find({ districtId: user.districtId });

      // Find peer District Manager (2 per district)
      const districtManagers = await db.users.find({
        role: 'district_manager',
        districtId: user.districtId
      });
      const coManager = districtManagers.find(m => m._id !== user.id) || null;

      // Count lower managers (Division & Pincode managers in this district)
      const allUsers = await db.users.find();
      const lowerManagers = allUsers.filter(u => 
        u.districtId === user.districtId && 
        ['division_manager', 'pincode_manager'].includes(u.role)
      );

      const divisionBreakdown = divisions.map(div => {
        const divVendors = vendors.filter(v => 
          (v.divisionId && v.divisionId === div._id) ||
          (v.division && v.division.toLowerCase() === (div.name || '').toLowerCase())
        );
        return {
          divisionId: div._id,
          divisionName: div.name,
          totalVendors: divVendors.length,
          activeVendors: divVendors.filter(v => isVendorActive(v.status)).length,
          pendingVendors: divVendors.filter(v => isVendorPending(v.status)).length,
          rejectedVendors: divVendors.filter(v => isVendorRejected(v.status)).length
        };
      });

      roleSpecificData = {
        districtName: district?.name || 'Assigned District',
        coManager: coManager ? { name: coManager.name, email: coManager.email, mobile: coManager.mobile } : null,
        totalLowerManagers: lowerManagers.length,
        totalDivisions: divisions.length,
        totalPincodes: pincodes.length,
        divisionBreakdown
      };
    } else if (user.role === 'division_manager') {
      const division = await db.divisions.findById(user.divisionId);
      const pincodes = await db.pincodes.find({ divisionId: user.divisionId });

      // Find peer Division Manager (2 per division)
      const divisionManagers = await db.users.find({
        role: 'division_manager',
        divisionId: user.divisionId
      });
      const coManager = divisionManagers.find(m => m._id !== user.id) || null;

      // Count lower managers (Pincode managers in this division)
      const allUsers = await db.users.find();
      const lowerManagers = allUsers.filter(u => 
        u.divisionId === user.divisionId && 
        u.role === 'pincode_manager'
      );

      const pincodeBreakdown = pincodes.map(p => {
        const pinVendors = vendors.filter(v => 
          (v.pincodeId && v.pincodeId === p._id) ||
          (v.pincode && String(v.pincode) === String(p.code))
        );
        return {
          pincodeId: p._id,
          pincodeCode: p.code,
          areaName: p.areaName,
          totalVendors: pinVendors.length,
          activeVendors: pinVendors.filter(v => isVendorActive(v.status)).length,
          pendingVendors: pinVendors.filter(v => isVendorPending(v.status)).length,
          rejectedVendors: pinVendors.filter(v => isVendorRejected(v.status)).length
        };
      });

      roleSpecificData = {
        divisionName: division?.name || 'Assigned Division',
        coManager: coManager ? { name: coManager.name, email: coManager.email, mobile: coManager.mobile } : null,
        totalLowerManagers: lowerManagers.length,
        totalPincodes: pincodes.length,
        pincodeBreakdown
      };
    } else if (user.role === 'pincode_manager') {
      const pincode = await db.pincodes.findById(user.pincodeId);

      // Find peer Pincode Manager (2 per pincode)
      const pincodeManagers = await db.users.find({
        role: 'pincode_manager',
        pincodeId: user.pincodeId
      });
      const coManager = pincodeManagers.find(m => m._id !== user.id) || null;

      const subCategoryCounts = {};
      vendors.forEach(v => {
        if (v.subCategory) {
          subCategoryCounts[v.subCategory] = (subCategoryCounts[v.subCategory] || 0) + 1;
        }
      });

      roleSpecificData = {
        pincodeCode: pincode?.code,
        pincodeArea: pincode?.areaName,
        coManager: coManager ? { name: coManager.name, email: coManager.email, mobile: coManager.mobile } : null,
        subCategoryCounts
      };
    }

    // Detailed manager counts based on jurisdiction scope
    const allUsers = await db.users.find();
    let scopedManagers = [];
    let managersBreakdownText = '';

    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(user.role) || user.email === 'admin@example.com';

    const isManagerRole = (r) => ['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'].includes(r);
    const allManagersList = allUsers.filter(u => isManagerRole(u.role));

    if (isGlobalAdmin) {
      scopedManagers = allManagersList;
      const sCount = scopedManagers.filter(u => u.role === 'state_manager').length;
      const dCount = scopedManagers.filter(u => u.role === 'district_manager').length;
      const vCount = scopedManagers.filter(u => u.role === 'division_manager').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager').length;
      managersBreakdownText = `${sCount} State | ${dCount} District | ${vCount} Division | ${pCount} Pincode`;
    } else if (user.role === 'state_manager') {
      scopedManagers = allManagersList.filter(u => !user.stateId || u.stateId === user.stateId || u.state === user.state);
      const sCount = scopedManagers.filter(u => u.role === 'state_manager').length;
      const dCount = scopedManagers.filter(u => u.role === 'district_manager').length;
      const vCount = scopedManagers.filter(u => u.role === 'division_manager').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager').length;
      managersBreakdownText = `${sCount} State | ${dCount} District | ${vCount} Division | ${pCount} Pincode`;
    } else if (user.role === 'district_manager') {
      scopedManagers = allManagersList.filter(u => !user.districtId || u.districtId === user.districtId || u.district === user.district);
      const dCount = scopedManagers.filter(u => u.role === 'district_manager').length;
      const vCount = scopedManagers.filter(u => u.role === 'division_manager').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager').length;
      managersBreakdownText = `${dCount} District | ${vCount} Division | ${pCount} Pincode`;
    } else if (user.role === 'division_manager') {
      scopedManagers = allManagersList.filter(u => !user.divisionId || u.divisionId === user.divisionId || u.division === user.division);
      const vCount = scopedManagers.filter(u => u.role === 'division_manager').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager').length;
      managersBreakdownText = `${vCount} Division | ${pCount} Pincode`;
    } else if (user.role === 'pincode_manager') {
      scopedManagers = allManagersList.filter(u => !user.pincodeId || u.pincodeId === user.pincodeId || u.pincode === user.pincode);
      managersBreakdownText = `${scopedManagers.length} Pincode Managers`;
    } else {
      scopedManagers = allManagersList;
      managersBreakdownText = `${scopedManagers.length} Managers`;
    }

    const activeManagersCount = scopedManagers.filter(u => String(u.status || 'active').toLowerCase() === 'active').length;

    // Tie-ups time calculations
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const todayTieups = vendors.filter(v => isVendorActive(v.status) && new Date(v.createdAt) >= startOfToday).length;
    const weekTieups = vendors.filter(v => isVendorActive(v.status) && new Date(v.createdAt) >= startOfWeek).length;

    const kpiMetrics = {
      totalManagers: scopedManagers.length,
      activeManagers: activeManagersCount,
      managersBreakdown: managersBreakdownText,
      totalVendors: vendors.length,
      activeVendors: statusCounts.active,
      pendingVendors: statusCounts.pending + statusCounts.underReview,
      totalShops: vendors.length,
      activeShops: statusCounts.active,
      inactiveShops: statusCounts.inactive + statusCounts.rejected,
      totalTieups: statusCounts.active,
      todayTieups: todayTieups,
      weekTieups: weekTieups,
      verifiedVendors: statusCounts.active,
      openIssues: statusCounts.pending + statusCounts.underReview + (statusCounts.rejected > 0 ? 1 : 0),
      kycPending: statusCounts.pending + statusCounts.underReview,
      pendingKYC: statusCounts.pending + statusCounts.underReview,
      vendorRequests: statusCounts.pending,
      rejectedVendors: statusCounts.rejected,
      inactiveVendors: statusCounts.inactive
    };

    // Recent 5 vendors
    const recentVendors = [...vendors]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const issueCounts = {
      total: 0,
      open: 0,
      inProgress: 0,
      escalated: 0,
      resolved: 0
    };

    // Recent activities from auditLogs
    const allLogs = await db.auditLogs.find();
    const scopedVendorIds = new Set(vendors.map(v => v._id));
    const recentActivities = allLogs
      .filter(log => scopedVendorIds.has(log.recordId) || log.userId === user.id)
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
      .slice(0, 10);

    res.json({
      success: true,
      role: user.role,
      statusCounts,
      issueCounts,
      categoryCounts,
      kpiMetrics,
      stats: kpiMetrics,
      data: kpiMetrics,
      roleSpecificData,
      recentVendors,
      recentActivities
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to compile dashboard metrics' });
  }
};

// GET /api/reports/vendors - Full report data export (scoped)
const getVendorReportData = async (req, res) => {
  try {
    const user = req.user;
    const scopeFilter = getScopeFilter(user);

    const vendors = await db.vendors.find(scopeFilter);

    const detailedList = await Promise.all(vendors.map(async (v) => {
      const [state, dist, div, pin] = await Promise.all([
        v.stateId ? db.states.findById(v.stateId) : null,
        v.districtId ? db.districts.findById(v.districtId) : null,
        v.divisionId ? db.divisions.findById(v.divisionId) : null,
        v.pincodeId ? db.pincodes.findById(v.pincodeId) : null
      ]);

      return {
        id: v._id,
        name: v.name,
        mobile: v.mobile,
        email: v.email,
        businessName: v.businessName,
        category: v.category,
        subCategory: v.subCategory,
        status: v.status,
        state: state?.name || '',
        district: dist?.name || '',
        division: div?.name || '',
        pincode: pin?.code || '',
        area: pin?.areaName || '',
        createdAt: v.createdAt
      };
    }));

    res.json({
      success: true,
      total: detailedList.length,
      data: detailedList
    });
  } catch (err) {
    console.error('Vendor report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// GET /api/reports/leaderboard - Real Performance rankings calculated dynamically from database
// GET /api/reports/leaderboard - Real Performance rankings calculated dynamically from database
const getLeaderboardData = async (req, res) => {
  try {
    const user = req.user;
    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(user.role) || user.email === 'admin@example.com';

    const [allUsers, allManagers, allVendors] = await Promise.all([
      db.users.find(),
      db.managers.find(),
      db.vendors.find()
    ]);

    const combined = [...(allUsers || []), ...(allManagers || [])];
    const seen = new Set();
    const candidateManagers = [];

    for (const m of combined) {
      if (!m) continue;
      const key = String(m._id || m.id || m.email || m.mobile || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const r = String(m.role || '').toLowerCase();
      if (!['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'].includes(r)) {
        continue;
      }

      // Territory scope enforcement based on authenticated manager's level
      if (!isGlobalAdmin) {
        if (user.role === 'state_manager') {
          const uState = String(user.stateId || user.state || '').trim().toLowerCase();
          const mState = String(m.stateId || m.state || '').trim().toLowerCase();
          if (uState && mState && uState !== mState) continue;
        } else if (user.role === 'district_manager') {
          const uDist = String(user.districtId || user.district || '').trim().toLowerCase();
          const mDist = String(m.districtId || m.district || '').trim().toLowerCase();
          if (uDist && mDist && uDist !== mDist) continue;
        } else if (user.role === 'division_manager') {
          const uDiv = String(user.divisionId || user.division || '').trim().toLowerCase();
          const mDiv = String(m.divisionId || m.division || '').trim().toLowerCase();
          if (uDiv && mDiv && uDiv !== mDiv) continue;
        } else if (user.role === 'pincode_manager') {
          const uPin = String(user.pincodeId || user.pincode || user.pincodeCode || '').trim().toLowerCase();
          const mPin = String(m.pincodeId || m.pincode || m.pincodeCode || '').trim().toLowerCase();
          if (uPin && mPin && uPin !== mPin) continue;
        }
      }

      candidateManagers.push(m);
    }

    const formatRoleLabel = (role) => {
      const r = String(role || '').toLowerCase();
      if (r.includes('state')) return 'State Manager';
      if (r.includes('district')) return 'District Manager';
      if (r.includes('division') || r.includes('divisional')) return 'Division Manager';
      if (r.includes('pincode')) return 'Pincode Manager';
      return 'Manager';
    };

    const formatLevel = (level, role) => {
      const r = String(role || '').toLowerCase();
      if (level === 1 || level === '1' || r.includes('state')) return 'Level 1 • State';
      if (level === 2 || level === '2' || r.includes('district')) return 'Level 2 • District';
      if (level === 3 || level === '3' || r.includes('division')) return 'Level 3 • Division';
      if (level === 4 || level === '4' || r.includes('pincode')) return 'Level 4 • Pincode';
      return `Level ${level || 1}`;
    };

    const colorPalette = ['#0284c7', '#8b5cf6', '#f59e0b', '#0d9488', '#ea580c', '#d97706', '#6366f1', '#ec4899'];

    const rankedList = await Promise.all(candidateManagers.map(async (m, idx) => {
      const [state, district, division, pincode] = await Promise.all([
        m.stateId ? db.states.findById(m.stateId) : null,
        m.districtId ? db.districts.findById(m.districtId) : null,
        m.divisionId ? db.divisions.findById(m.divisionId) : null,
        m.pincodeId ? db.pincodes.findById(m.pincodeId) : null
      ]);

      // Calculate real vendors added by this respective manager
      const mId = String(m._id || m.id || '');
      const managerVendors = (allVendors || []).filter(v => 
        String(v.createdBy || '') === mId
      );

      const totalVendors = managerVendors.length;
      const activeVendors = managerVendors.filter(v => String(v.status || '').toLowerCase() === 'active').length;
      const pendingVendors = managerVendors.filter(v => {
        const st = String(v.status || '').toLowerCase();
        return st === 'pending' || st.includes('review');
      }).length;

      const basePoints = (activeVendors * 250) + (totalVendors * 80);
      const target = Math.max(totalVendors + 2, 5);
      const slaRate = totalVendors > 0 
        ? `${Math.min(99, Math.round((activeVendors / totalVendors) * 100))}%`
        : '0.0%';

      let territoryText = state?.name || m.state || 'Assigned Territory';
      if (pincode?.code || m.pincodeCode || m.pincode) {
        const pin = pincode?.code || m.pincodeCode || m.pincode;
        territoryText = `PIN ${pin}`;
      } else if (division?.name || m.division) {
        const divName = division?.name || m.division;
        const distName = district?.name || m.district || '';
        territoryText = distName ? `${divName}, ${distName}` : divName;
      } else if (district?.name || m.district) {
        const distName = district?.name || m.district;
        const stName = state?.name || m.state || '';
        territoryText = stName ? `${distName}, ${stName}` : distName;
      }

      const isSelf = mId === String(user.id || user._id || '');

      return {
        id: mId,
        name: String(m.name || 'Manager'),
        role: String(m.role || 'manager'),
        roleLabel: formatRoleLabel(m.role),
        level: formatLevel(m.level, m.role),
        territory: String(territoryText),
        stateId: m.stateId || null,
        stateName: state?.name || m.state || null,
        vendorsOnboarded: totalVendors,
        activeVendors,
        pendingVendors,
        target,
        slaRate,
        points: basePoints,
        isSelf,
        rating: activeVendors > 0 ? 'Excellent' : totalVendors > 0 ? 'Good' : 'Steady',
        avatarBg: colorPalette[idx % colorPalette.length]
      };
    }));

    // Sort by points descending, then by active vendors
    rankedList.sort((a, b) => b.points - a.points || b.activeVendors - a.activeVendors || b.vendorsOnboarded - a.vendorsOnboarded);

    // Assign dynamic rank
    const rankedWithPosition = rankedList.map((item, index) => ({
      ...item,
      rank: index + 1
    }));

    res.json({
      success: true,
      count: rankedWithPosition.length,
      data: rankedWithPosition,
      top3: rankedWithPosition.slice(0, 3)
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate leaderboard' });
  }
};

// POST /api/reports/submit - Persist generated periodical report to database
const submitReport = async (req, res) => {
  try {
    const user = req.user;
    const { periodLabel, dateRange, startDate, endDate, summary, shopVisits, tasks } = req.body;

    const count = await db.submittedReports.count();
    const reportCode = `REP-${10000 + count + 1}`;

    const newReport = await db.submittedReports.insertOne({
      reportCode,
      periodLabel: periodLabel || 'Field Performance Report',
      dateRange: dateRange || 'N/A',
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date().toISOString(),
      summary: summary || {},
      shopVisits: shopVisits || [],
      tasks: tasks || [],
      managerId: user.id,
      managerName: user.name,
      managerRole: user.role,
      stateId: user.stateId || 'state_ka',
      districtId: user.districtId || null,
      divisionId: user.divisionId || null,
      pincodeId: user.pincodeId || null,
      submittedAt: new Date().toISOString()
    });

    // Record in audit log
    await db.auditLogs.insertOne({
      action: 'Report Submitted',
      recordId: newReport._id,
      recordType: 'report',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Submitted ${periodLabel} (${reportCode}) with ${summary?.totalVisits || 0} visits and ${summary?.tasksAssigned || 0} tasks.`,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted and saved to database successfully',
      data: newReport
    });
  } catch (err) {
    console.error('Submit report error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit report to database' });
  }
};

// GET /api/reports/submitted - Retrieve submitted reports within jurisdiction
const getSubmittedReports = async (req, res) => {
  try {
    const user = req.user;
    const { district, division, pincode, managerRole, search } = req.query;

    const [allReports, districts, divisions, pincodes] = await Promise.all([
      db.submittedReports.find(),
      db.districts.find(user.stateId ? { stateId: user.stateId } : {}),
      db.divisions.find(user.districtId ? { districtId: user.districtId } : {}),
      db.pincodes.find(user.divisionId ? { divisionId: user.divisionId } : {})
    ]);

    let filtered = allReports.filter(r => {
      // Scope filtering
      if (user.role === 'state_manager' && user.stateId && r.stateId && r.stateId !== user.stateId) return false;
      if (user.role === 'district_manager' && user.districtId && r.districtId && r.districtId !== user.districtId) return false;
      if (user.role === 'division_manager' && user.divisionId && r.divisionId && r.divisionId !== user.divisionId) return false;
      if (user.role === 'pincode_manager' && user.pincodeId && r.pincodeId && r.pincodeId !== user.pincodeId) return false;

      // Filter params
      if (district && district !== 'All' && String(r.districtId || '') !== String(district) && String(r.district || '') !== String(district)) return false;
      if (division && division !== 'All' && String(r.divisionId || '') !== String(division) && String(r.division || '') !== String(division)) return false;
      if (pincode && pincode !== 'All' && String(r.pincodeId || '') !== String(pincode) && String(r.pincode || '') !== String(pincode)) return false;
      if (managerRole && managerRole !== 'All' && String(r.managerRole || '').toLowerCase() !== String(managerRole).toLowerCase()) return false;

      if (search && search.trim()) {
        const q = search.toLowerCase();
        const matchCode = (r.reportCode || '').toLowerCase().includes(q);
        const matchName = (r.managerName || '').toLowerCase().includes(q);
        const matchPeriod = (r.periodLabel || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchPeriod) return false;
      }

      return true;
    });

    filtered.sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt));

    const cleanDistricts = (districts || []).map(d => ({
      _id: String(d._id || d.id || ''),
      name: String(d.name || d.districtName || d._id || ''),
      districtName: String(d.name || d.districtName || '')
    }));
    const cleanDivisions = (divisions || []).map(d => ({
      _id: String(d._id || d.id || ''),
      name: String(d.name || d.divisionName || d._id || ''),
      divisionName: String(d.name || d.divisionName || '')
    }));
    const cleanPincodes = (pincodes || []).map(p => ({
      _id: String(p._id || p.id || ''),
      code: String(p.code || p.pincode || p.pincodeId || p.name || ''),
      pincode: String(p.code || p.pincode || ''),
      name: String(p.name || p.areaName || p.area || p.code || '')
    }));

    res.json({
      success: true,
      total: filtered.length,
      data: filtered,
      hierarchy: {
        districts: cleanDistricts,
        divisions: cleanDivisions,
        pincodes: cleanPincodes
      }
    });
  } catch (err) {
    console.error('Error fetching submitted reports:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve submitted reports' });
  }
};

// GET /api/reports/submitted/:id - Get detail of submitted report with territory scope validation
const getSubmittedReportById = async (req, res) => {
  try {
    const user = req.user;
    const report = await db.submittedReports.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Submitted report not found' });
    }

    const isAdmin = ['admin', 'super_admin', 'super-admin'].includes(String(user.role).toLowerCase()) || user.email === 'admin@example.com';
    const isOwner = String(report.managerId) === String(user.id || user._id);

    let isWithinScope = false;
    if (user.role === 'state_manager') {
      isWithinScope = !report.stateId || String(report.stateId) === String(user.stateId);
    } else if (user.role === 'district_manager') {
      isWithinScope = !report.districtId || String(report.districtId) === String(user.districtId);
    } else if (user.role === 'division_manager') {
      isWithinScope = !report.divisionId || String(report.divisionId) === String(user.divisionId);
    } else if (user.role === 'pincode_manager') {
      isWithinScope = !report.pincodeId || String(report.pincodeId) === String(user.pincodeId);
    }

    if (!isAdmin && !isOwner && !isWithinScope) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to access reports outside your assigned territory.'
      });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    console.error('Error fetching submitted report by id:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch report details' });
  }
};

module.exports = {
  getDashboardStats,
  getVendorReportData,
  getLeaderboardData,
  submitReport,
  getSubmittedReports,
  getSubmittedReportById
};
