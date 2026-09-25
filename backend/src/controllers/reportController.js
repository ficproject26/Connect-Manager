const db = require('../config/db');
const { getScopeFilter } = require('../middleware/scopeMiddleware');

// GET /api/reports/dashboard - Tailored KPI widgets and analytics by role
const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;
    const scopeFilter = getScopeFilter(user);

    // Get all vendors in caller's scope
    const vendors = await db.vendors.find(scopeFilter);

    // Common status counts
    const statusCounts = {
      total: vendors.length,
      active: vendors.filter(v => v.status === 'Active').length,
      pending: vendors.filter(v => v.status === 'Pending').length,
      underReview: vendors.filter(v => v.status === 'Under Review').length,
      rejected: vendors.filter(v => v.status === 'Rejected').length,
      inactive: vendors.filter(v => v.status === 'Inactive').length
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

      // Find all 4 State Managers for Karnataka
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
        const districtVendors = vendors.filter(v => v.districtId === d._id);
        return {
          districtId: d._id,
          districtName: d.name,
          totalVendors: districtVendors.length,
          activeVendors: districtVendors.filter(v => v.status === 'Active').length,
          pendingVendors: districtVendors.filter(v => v.status === 'Pending' || v.status === 'Under Review').length,
          rejectedVendors: districtVendors.filter(v => v.status === 'Rejected').length
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
        const divVendors = vendors.filter(v => v.divisionId === div._id);
        return {
          divisionId: div._id,
          divisionName: div.name,
          totalVendors: divVendors.length,
          activeVendors: divVendors.filter(v => v.status === 'Active').length,
          pendingVendors: divVendors.filter(v => v.status === 'Pending' || v.status === 'Under Review').length,
          rejectedVendors: divVendors.filter(v => v.status === 'Rejected').length
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
        const pinVendors = vendors.filter(v => v.pincodeId === p._id);
        return {
          pincodeId: p._id,
          pincodeCode: p.code,
          areaName: p.areaName,
          totalVendors: pinVendors.length,
          activeVendors: pinVendors.filter(v => v.status === 'Active').length,
          pendingVendors: pinVendors.filter(v => v.status === 'Pending' || v.status === 'Under Review').length,
          rejectedVendors: pinVendors.filter(v => v.status === 'Rejected').length
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

    if (user.role === 'state_manager') {
      scopedManagers = allUsers.filter(u => u.stateId === user.stateId);
      const sCount = scopedManagers.filter(u => u.role === 'state_manager').length;
      const dCount = scopedManagers.filter(u => u.role === 'district_manager').length;
      const vCount = scopedManagers.filter(u => u.role === 'division_manager').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager').length;
      managersBreakdownText = `${sCount} State | ${dCount} District | ${vCount} Division | ${pCount} Pincode`;
    } else if (user.role === 'district_manager') {
      scopedManagers = allUsers.filter(u => u.districtId === user.districtId);
      const dCount = scopedManagers.filter(u => u.role === 'district_manager').length;
      const vCount = scopedManagers.filter(u => u.role === 'division_manager').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager').length;
      managersBreakdownText = `${dCount} District | ${vCount} Division | ${pCount} Pincode`;
    } else if (user.role === 'division_manager') {
      scopedManagers = allUsers.filter(u => u.divisionId === user.divisionId);
      const vCount = scopedManagers.filter(u => u.role === 'division_manager').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager').length;
      managersBreakdownText = `${vCount} Division | ${pCount} Pincode`;
    } else {
      scopedManagers = allUsers.filter(u => u.pincodeId === user.pincodeId);
      managersBreakdownText = `${scopedManagers.length} Pincode Managers`;
    }

    // Tie-ups time calculations
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const todayTieups = vendors.filter(v => v.status === 'Active' && new Date(v.createdAt) >= startOfToday).length;
    const weekTieups = vendors.filter(v => v.status === 'Active' && new Date(v.createdAt) >= startOfWeek).length;

    const kpiMetrics = {
      totalManagers: scopedManagers.length,
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
      vendorRequests: statusCounts.pending
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
const getLeaderboardData = async (req, res) => {
  try {
    const user = req.user;
    const allUsers = await db.users.find();
    const allVendors = await db.vendors.find();

    const managers = allUsers.filter(u => 
      ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(u.role)
    );

    const formatRoleLabel = (role) => {
      switch (role) {
        case 'state_manager': return 'State Manager';
        case 'district_manager': return 'District Manager';
        case 'division_manager': return 'Division Manager';
        case 'pincode_manager': return 'Pincode Manager';
        default: return role;
      }
    };

    const formatLevel = (level) => `Level ${level || 1}`;

    const colorPalette = ['#0284c7', '#8b5cf6', '#f59e0b', '#0d9488', '#ea580c', '#d97706', '#6366f1', '#ec4899'];

    const rankedList = await Promise.all(managers.map(async (m, idx) => {
      const [state, district, division, pincode] = await Promise.all([
        m.stateId ? db.states.findById(m.stateId) : null,
        m.districtId ? db.districts.findById(m.districtId) : null,
        m.divisionId ? db.divisions.findById(m.divisionId) : null,
        m.pincodeId ? db.pincodes.findById(m.pincodeId) : null
      ]);

      // Calculate real vendors added by this respective manager
      const managerVendors = allVendors.filter(v => 
        v.createdBy === m._id || v.createdBy === m.id
      );

      const totalVendors = managerVendors.length;
      const activeVendors = managerVendors.filter(v => v.status === 'Active').length;
      const pendingVendors = managerVendors.filter(v => v.status === 'Pending' || v.status === 'Under Review').length;

      // Real dynamic score based on vendors added by this manager:
      // 250 points for each Active verified vendor, 80 points for each onboarded vendor
      const basePoints = (activeVendors * 250) + (totalVendors * 80);
      const target = Math.max(totalVendors + 2, 5);
      const slaRate = totalVendors > 0 
        ? `${Math.min(99, Math.round((activeVendors / totalVendors) * 100))}%`
        : '0.0%';

      let territoryText = state?.name || 'Assigned State';
      if (pincode?.code) {
        territoryText = `PIN ${pincode.code} (${pincode.areaName || ''})`;
      } else if (division?.name) {
        territoryText = `${division.name}, ${district?.name || ''}`;
      } else if (district?.name) {
        territoryText = `${district.name}, ${state?.name || ''}`;
      }

      const isSelf = m._id === user.id || m._id === user._id;

      return {
        id: m._id,
        name: m.name,
        role: m.role,
        roleLabel: formatRoleLabel(m.role),
        level: formatLevel(m.level),
        territory: territoryText,
        stateId: m.stateId,
        stateName: state?.name || null,
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
      if (district && district !== 'All' && r.districtId !== district) return false;
      if (division && division !== 'All' && r.divisionId !== division) return false;
      if (pincode && pincode !== 'All' && r.pincodeId !== pincode) return false;
      if (managerRole && managerRole !== 'All' && r.managerRole !== managerRole) return false;

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

    res.json({
      success: true,
      total: filtered.length,
      data: filtered,
      hierarchy: {
        districts,
        divisions,
        pincodes
      }
    });
  } catch (err) {
    console.error('Error fetching submitted reports:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve submitted reports' });
  }
};

// GET /api/reports/submitted/:id - Get detail of submitted report
const getSubmittedReportById = async (req, res) => {
  try {
    const report = await db.submittedReports.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Submitted report not found' });
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
