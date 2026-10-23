const db = require('../config/db');
const territoryScopeService = require('../services/territoryScopeService');
const { getScopeFilter, isVendorInScope } = require('../middleware/scopeMiddleware');
const { getManagerTerritoryProfile, isTaskInManagerTerritory } = require('./taskController');
const { cacheManager } = require('../realtime');

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
    const cacheKey = `dashboard:stats:${user?.id || user?._id || 'mgr'}:${user?.role || 'mgr'}`;

    const payload = await cacheManager.fetchWithCache(cacheKey, async () => {
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

      // Filter strictly by caller's scope using centralized territory hierarchy
      const vendors = [];
      for (const v of uniqueVendors) {
        if (await territoryScopeService.isRecordInScope(v, user)) {
          vendors.push(v);
        }
      }

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

      // Compute comprehensive territory breakdowns strictly from scoped database records (vendors + visits)
      const [stateBreakdown, districtBreakdown, divisionBreakdown, pincodeBreakdown] = await Promise.all([
        territoryScopeService.getTerritoryPerformance(user, 'state'),
        territoryScopeService.getTerritoryPerformance(user, 'dist'),
        territoryScopeService.getTerritoryPerformance(user, 'div'),
        territoryScopeService.getTerritoryPerformance(user, 'pin')
      ]);

      let roleSpecificData = {
        stateBreakdown,
        districtBreakdown,
        divisionBreakdown,
        pincodeBreakdown
      };

    if (user.role === 'state_manager') {
      const state = await db.states.findById(user.stateId);
      const districts = await db.districts.find({ stateId: user.stateId });
      const divisions = await db.divisions.find({ stateId: user.stateId });
      const pincodes = await db.pincodes.find({ stateId: user.stateId });

      const [rawUsers, rawManagers] = await Promise.all([
        db.users.find({}),
        db.managers ? db.managers.find({}) : []
      ]);
      const seenMgrs = new Set();
      const allUsers = [];
      for (const u of [...rawUsers, ...rawManagers]) {
        if (!u) continue;
        const key = String(u.id || u._id || u.managerId || u.email || u.mobile || '');
        if (key && !seenMgrs.has(key)) {
          seenMgrs.add(key);
          allUsers.push(u);
        }
      }

      const stateManagers = allUsers.filter(u =>
        u.role === 'state_manager' &&
        (!user.stateId || u.stateId === user.stateId || u.state === user.state)
      );

      const lowerManagers = allUsers.filter(u => 
        (!user.stateId || u.stateId === user.stateId || u.state === user.state) && 
        ['district_manager', 'division_manager', 'pincode_manager'].includes(u.role)
      );

      roleSpecificData = {
        stateName: state?.name || user.state || user.assignedState || 'Karnataka',
        totalStateManagers: stateManagers.length,
        stateManagersList: stateManagers.map(m => ({ id: m._id || m.id, name: m.name, email: m.email, mobile: m.mobile })),
        totalLowerManagers: lowerManagers.length,
        totalDistricts: districts.length,
        totalDivisions: divisions.length,
        totalPincodes: pincodes.length,
        stateBreakdown,
        districtBreakdown,
        divisionBreakdown,
        pincodeBreakdown
      };
    } else if (user.role === 'district_manager') {
      const district = await db.districts.findById(user.districtId);
      const divisions = await db.divisions.find({ districtId: user.districtId });
      const pincodes = await db.pincodes.find({ districtId: user.districtId });

      const districtManagers = await db.users.find({
        role: 'district_manager',
        districtId: user.districtId
      });
      const coManager = districtManagers.find(m => m._id !== user.id) || null;

      const allUsers = await db.users.find();
      const lowerManagers = allUsers.filter(u => 
        u.districtId === user.districtId && 
        ['division_manager', 'pincode_manager'].includes(u.role)
      );

      roleSpecificData = {
        districtName: district?.name || user.district || 'Assigned District',
        coManager: coManager ? { name: coManager.name, email: coManager.email, mobile: coManager.mobile } : null,
        totalLowerManagers: lowerManagers.length,
        totalDivisions: divisions.length,
        totalPincodes: pincodes.length,
        stateBreakdown,
        districtBreakdown,
        divisionBreakdown,
        pincodeBreakdown
      };
    } else if (user.role === 'division_manager') {
      const division = await db.divisions.findById(user.divisionId);
      const pincodes = await db.pincodes.find({ divisionId: user.divisionId });

      const divisionManagers = await db.users.find({
        role: 'division_manager',
        divisionId: user.divisionId
      });
      const coManager = divisionManagers.find(m => m._id !== user.id) || null;

      const allUsers = await db.users.find();
      const lowerManagers = allUsers.filter(u => 
        u.divisionId === user.divisionId && 
        u.role === 'pincode_manager'
      );

      roleSpecificData = {
        divisionName: division?.name || user.division || 'Assigned Division',
        coManager: coManager ? { name: coManager.name, email: coManager.email, mobile: coManager.mobile } : null,
        totalLowerManagers: lowerManagers.length,
        totalPincodes: pincodes.length,
        stateBreakdown,
        districtBreakdown,
        divisionBreakdown,
        pincodeBreakdown
      };
    } else if (user.role === 'pincode_manager') {
      const pincode = await db.pincodes.findById(user.pincodeId);

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

      const assignedPin = user.pincode || user.pincodeCode || pincode?.code;
      if (assignedPin && !pincodeBreakdown.some(p => p.pincodeCode === assignedPin)) {
        pincodeBreakdown.unshift({
          pincodeId: user.pincodeId || assignedPin,
          pincodeCode: assignedPin,
          areaName: pincode?.areaName || user.assignedArea || 'Assigned Area',
          totalVendors: vendors.length,
          activeVendors: statusCounts.active,
          tieUps: statusCounts.active,
          pendingVendors: statusCounts.pending
        });
      }

      roleSpecificData = {
        pincodeCode: pincode?.code || user.pincode || 'Assigned PIN',
        pincodeArea: pincode?.areaName || user.assignedArea || 'Assigned Area',
        coManager: coManager ? { name: coManager.name, email: coManager.email, mobile: coManager.mobile } : null,
        subCategoryCounts,
        stateBreakdown,
        districtBreakdown,
        divisionBreakdown,
        pincodeBreakdown
      };
    } else {
      roleSpecificData = {
        stateBreakdown,
        districtBreakdown,
        divisionBreakdown,
        pincodeBreakdown
      };
    }

    // Detailed manager counts based on jurisdiction scope
    const [rawAllUsers, rawAllManagers] = await Promise.all([
      db.users.find({}),
      db.managers ? db.managers.find({}) : []
    ]);
    const seenAllMgrs = new Set();
    const allUsers = [];
    for (const u of [...rawAllUsers, ...rawAllManagers]) {
      if (!u) continue;
      const key = String(u.id || u._id || u.managerId || u.email || u.mobile || '');
      if (key && !seenAllMgrs.has(key)) {
        seenAllMgrs.add(key);
        allUsers.push(u);
      }
    }
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

    // Exclude deleted managers from total & active counts
    scopedManagers = scopedManagers.filter(u => String(u.status || '').toLowerCase() !== 'deleted');
    const activeManagersCount = scopedManagers.filter(u => ['active', 'approved'].includes(String(u.status || '').toLowerCase()) || u.isApproved === true).length;

    // Time calculations strictly in Asia/Kolkata (+05:30) timezone
    const now = new Date();
    const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayKolkataStr = kolkataFormatter.format(now); // e.g. "2026-10-15"
    const startOfToday = new Date(`${todayKolkataStr}T00:00:00+05:30`);
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const todayTieups = vendors.filter(v => {
      if (!isVendorActive(v.status)) return false;
      const vt = new Date(v.createdAt).getTime();
      return !isNaN(vt) && vt >= startOfToday.getTime() && vt < startOfTomorrow.getTime();
    }).length;

    const weekTieups = vendors.filter(v => {
      if (!isVendorActive(v.status)) return false;
      const vt = new Date(v.createdAt).getTime();
      return !isNaN(vt) && vt >= startOfWeek.getTime();
    }).length;

    const kpiMetrics = {
      totalManagers: scopedManagers.length,
      activeManagers: activeManagersCount,
      managersBreakdown: managersBreakdownText,
      totalVendors: vendors.length,
      activeVendors: statusCounts.active,
      pendingVendors: statusCounts.pending + statusCounts.underReview,
      totalShops: vendors.length,
      activeShops: statusCounts.active,
      inactiveShops: Math.max(0, vendors.length - statusCounts.active),
      totalTieups: statusCounts.active,
      todayTieups: todayTieups,
      weekTieups: weekTieups,
      verifiedVendors: statusCounts.active,
      openIssues: 0,
      activeTasks: 0,
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

    // Dynamic Monthly Trends (Merchants vs Tie-ups) strictly from scoped database vendors
    const monthlyTrends = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = d.toLocaleString('en-US', { month: 'short' });
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();

      const vInMonth = vendors.filter(v => {
        const rawDate = v.createdAt || v.registrationDate || v.onboardingDate || v.date;
        if (!rawDate) return false;
        const vd = new Date(rawDate);
        if (isNaN(vd.getTime())) return false;
        return vd.getFullYear() === mYear && vd.getMonth() === mMonth;
      });

      const merchantsCount = vInMonth.length;
      const tieUpsCount = vInMonth.filter(v => isVendorActive(v.status)).length;

      monthlyTrends.push({
        month: mLabel,
        year: mYear,
        merchants: merchantsCount,
        tieUps: tieUpsCount
      });
    }

    const trendData = {
      '3m': monthlyTrends.slice(-3),
      '6m': monthlyTrends.slice(-6),
      '1y': monthlyTrends.slice(-12)
    };

    // Real Operational & QC Tasks Aggregation strictly scoped to caller's territory
    const allTasks = await db.tasks.find({});
    const taskProfile = await getManagerTerritoryProfile(user);
    const scopedTasks = allTasks.filter(t => isTaskInManagerTerritory(t, taskProfile));

    const getTaskCategory = (t) => {
      const status = (t.status || '').toLowerCase().trim();
      const priority = (t.priority || '').toLowerCase().trim();
      if (['resolved', 'closed', 'completed'].includes(status)) return 'resolved';
      if (['escalated'].includes(status) || priority === 'urgent') return 'escalated';
      if (['in progress', 'in_progress', 'progress', 'accepted'].includes(status)) return 'inProgress';
      if (['cancelled', 'rejected', 'inactive'].includes(status)) return 'closed';
      return 'open'; // 'pending', 'pending acceptance', 'assigned', 'open', etc.
    };

    const calcIssueStats = (taskList) => {
      let open = 0, inProgress = 0, escalated = 0, resolved = 0, closed = 0;
      let pending = 0, accepted = 0, completed = 0;

      taskList.forEach(t => {
        const cat = getTaskCategory(t);
        if (cat === 'resolved') resolved++;
        else if (cat === 'escalated') escalated++;
        else if (cat === 'inProgress') inProgress++;
        else if (cat === 'closed') closed++;
        else open++;

        const st = (t.status || '').toLowerCase().trim();
        if (st.includes('pending') || st === 'assigned') pending++;
        else if (st === 'accepted') accepted++;
        else if (['completed', 'resolved', 'closed'].includes(st)) completed++;
      });
      const total = open + inProgress + escalated + resolved;

      // Calculate resolution SLA rate and average turnaround only when the necessary data exists
      const resolvedTasks = taskList.filter(t => 
        ['completed', 'resolved', 'closed'].includes((t.status || '').toLowerCase().trim())
      );

      let slaRate = null;
      let avgTurnaroundHrs = null;

      if (resolvedTasks.length > 0) {
        let metSlaCount = 0;
        let totalTurnaroundMs = 0;
        let validTurnaroundCount = 0;

        resolvedTasks.forEach(t => {
          const completedAt = t.completionDetails?.completedAt
            ? new Date(t.completionDetails.completedAt)
            : (t.updatedAt ? new Date(t.updatedAt) : null);
          const createdAt = t.createdAt ? new Date(t.createdAt) : null;
          const dueDate = t.dueDate ? new Date(t.dueDate) : null;

          if (completedAt && dueDate && !isNaN(completedAt.getTime()) && !isNaN(dueDate.getTime())) {
            if (completedAt.getTime() <= dueDate.getTime()) {
              metSlaCount++;
            }
          } else if (completedAt && !isNaN(completedAt.getTime())) {
            metSlaCount++;
          }

          if (createdAt && completedAt && !isNaN(createdAt.getTime()) && !isNaN(completedAt.getTime()) && completedAt.getTime() >= createdAt.getTime()) {
            totalTurnaroundMs += (completedAt.getTime() - createdAt.getTime());
            validTurnaroundCount++;
          }
        });

        slaRate = Math.round((metSlaCount / resolvedTasks.length) * 100);
        if (validTurnaroundCount > 0) {
          avgTurnaroundHrs = Number(((totalTurnaroundMs / validTurnaroundCount) / (1000 * 60 * 60)).toFixed(1));
        }
      }

      return { total, open, inProgress, escalated, resolved, slaRate, avgTurnaroundHrs, pending, accepted, completed };
    };

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const monthTasks = scopedTasks.filter(t => new Date(t.createdAt || now) >= thirtyDaysAgo);
    const weekTasks = scopedTasks.filter(t => new Date(t.createdAt || now) >= sevenDaysAgo);
    const yearTasks = scopedTasks.filter(t => new Date(t.createdAt || now) >= oneYearAgo);

    const issueStatsByPeriod = {
      month: calcIssueStats(monthTasks),
      week: calcIssueStats(weekTasks),
      year: calcIssueStats(yearTasks),
      all: calcIssueStats(scopedTasks)
    };

    const allIssueCounts = issueStatsByPeriod.all;
    const activeTasksCount = (allIssueCounts?.open || 0) + (allIssueCounts?.inProgress || 0) + (allIssueCounts?.escalated || 0);
    kpiMetrics.openIssues = activeTasksCount;
    kpiMetrics.activeTasks = activeTasksCount;
    const issueCounts = (issueStatsByPeriod.month?.total > 0) ? issueStatsByPeriod.month : issueStatsByPeriod.all;

    // Filter audit logs strictly within current calendar day in Asia/Kolkata: [startOfToday, startOfTomorrow)
    const allLogs = (db.auditLogs.cache && db.auditLogs.cache.length > 0)
      ? db.auditLogs.cache
      : await db.auditLogs.find();
    const scopedVendorIds = new Set(vendors.map(v => String(v._id || v.id)));
    const todayActivities = allLogs
      .filter(log => {
        const rawTime = log.timestamp || log.createdAt;
        if (!rawTime) return false;
        const t = new Date(rawTime).getTime();
        if (isNaN(t) || t < startOfToday.getTime() || t >= startOfTomorrow.getTime()) {
          return false;
        }
        return isGlobalAdmin || scopedVendorIds.has(String(log.recordId || log.targetId)) || String(log.userId) === String(user.id || user._id);
      })
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
      .slice(0, 50);

    const recentActivities = todayActivities.slice(0, 10);

    return {
      success: true,
      role: user.role,
      statusCounts,
      issueCounts,
      issueStatsByPeriod,
      monthlyTrends,
      trendData,
      categoryCounts,
      kpiMetrics,
      stats: kpiMetrics,
      data: kpiMetrics,
      roleSpecificData,
      recentVendors,
      todayActivities,
      recentActivities,
      todayDate: todayKolkataStr
    };
    }, 15);

    res.json(payload);
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to compile dashboard metrics' });
  }
};

// GET /api/reports/vendors - Full report data export (scoped)
const getVendorReportData = async (req, res) => {
  try {
    const user = req.user;
    const cacheKey = `reports:vendors:${user?.id || user?._id || 'mgr'}:${user?.role || 'mgr'}`;

    const payload = await cacheManager.fetchWithCache(cacheKey, async () => {
      const scopeFilter = getScopeFilter(user);

      const [vendors, states, districts, divisions, pincodes] = await Promise.all([
        db.vendors.find(scopeFilter),
        db.states.find(),
        db.districts.find(),
        db.divisions.find(),
        db.pincodes.find()
      ]);

      const stateMap = new Map((states || []).map(s => [String(s._id || s.id), s]));
      const districtMap = new Map((districts || []).map(d => [String(d._id || d.id), d]));
      const divisionMap = new Map((divisions || []).map(d => [String(d._id || d.id), d]));
      const pincodeMap = new Map((pincodes || []).map(p => [String(p._id || p.id), p]));

      const detailedList = (vendors || []).map((v) => {
        const state = v.stateId ? stateMap.get(String(v.stateId)) : null;
        const dist = v.districtId ? districtMap.get(String(v.districtId)) : null;
        const div = v.divisionId ? divisionMap.get(String(v.divisionId)) : null;
        const pin = v.pincodeId ? pincodeMap.get(String(v.pincodeId)) : null;

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
      });

      return {
        success: true,
        total: detailedList.length,
        data: detailedList
      };
    }, 300);

    res.json(payload);
  } catch (err) {
    console.error('Vendor report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// GET /api/reports/leaderboard - Real Performance rankings calculated dynamically from database
const getLeaderboardData = async (req, res) => {
  try {
    const user = req.user;
    const period = String(req.query.period || 'month').toLowerCase();
    const requestedTier = String(req.query.role || req.query.tier || '').trim().toLowerCase();
    const cacheKey = `reports:leaderboard:${user?.id || user?._id || 'mgr'}:${user?.role || 'mgr'}:${period}:${requestedTier || 'all'}`;

    const payload = await cacheManager.fetchWithCache(cacheKey, async () => {
      const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(user.role) || user.email === 'admin@example.com';

      const [allUsers, allManagers, allVendors, states, districts, divisions, pincodes] = await Promise.all([
        db.users.find(),
        db.managers.find(),
        db.vendors.find(),
        db.states.find(),
        db.districts.find(),
        db.divisions.find(),
        db.pincodes.find()
      ]);

      const stateMap = new Map((states || []).map(s => [String(s._id || s.id), s]));
      const districtMap = new Map((districts || []).map(d => [String(d._id || d.id), d]));
      const divisionMap = new Map((divisions || []).map(d => [String(d._id || d.id), d]));
      const pincodeMap = new Map((pincodes || []).map(p => [String(p._id || p.id), p]));

      const resolveStateName = (entity) => {
        if (!entity) return '';
        const rawName = entity.state || entity.stateName || entity.scope?.stateName;
        if (rawName && typeof rawName === 'string') return rawName.trim().toLowerCase();
        const sId = String(entity.stateId || '');
        if (sId && stateMap.has(sId)) {
          return String(stateMap.get(sId)?.name || '').trim().toLowerCase();
        }
        return '';
      };
      const callerState = resolveStateName(user) || '';

      const mgrMap = new Map();
      (allManagers || []).forEach(m => {
        if (!m) return;
        const id = String(m._id || m.id || m.managerId || '');
        if (id) mgrMap.set(id, m);
        if (m.email) mgrMap.set(String(m.email).toLowerCase(), m);
        if (m.mobile) mgrMap.set(String(m.mobile).trim(), m);
      });

      const combined = [];
      const seenIds = new Set();

      (allUsers || []).forEach(u => {
        if (!u) return;
        const id = String(u._id || u.id || u.managerId || '');
        const email = String(u.email || '').toLowerCase();
        const mobile = String(u.mobile || u.phone || '').trim();
        const mgr = mgrMap.get(id) || (email && mgrMap.get(email)) || (mobile && mgrMap.get(mobile));

        let effectiveRole = u.role;
        if (mgr?.role && ['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'].includes(mgr.role)) {
          effectiveRole = mgr.role;
        }

        const merged = { ...mgr, ...u, role: effectiveRole };
        const key = id || email || mobile;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          combined.push(merged);
        }
      });

      (allManagers || []).forEach(m => {
        if (!m) return;
        const key = String(m._id || m.id || m.managerId || m.email || m.mobile || '');
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          combined.push(m);
        }
      });

      const candidateManagers = [];

      for (const m of combined) {
        if (!m) continue;
        const mEmail = String(m.email || '').toLowerCase();
        const mIdStr = String(m._id || m.id || '');
        const mMobile = String(m.mobile || m.phone || '').trim();
        const mName = String(m.name || '');
        if (mEmail.endsWith('@sample.com') || mEmail.includes('sample.com')) continue;
        if (mIdStr === 'user_state_ka' || mIdStr === 'user_state_1' || mIdStr === 'user_dist_1' || mIdStr === 'user_div_1' || mIdStr === 'user_pin_1' || mIdStr === 'user_admin') continue;
        if (mMobile.startsWith('988880000') || mMobile === '9999999999') continue;
        if (mName.includes('(Karnataka State Manager)') || mName.includes('(TN State Manager)')) continue;

        const r = String(m.role || '').toLowerCase();
        if (!['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'].includes(r)) {
          continue;
        }

        const status = String(m.status || '').toLowerCase();
        const isSelf = String(m._id || m.id) === String(user?.id || user?._id);
        const isEligible = status === 'active' || status === 'approved' || status === 'active & authorized' || status === 'under_review' || isSelf;
        if (!isEligible) continue;

        // Territory scope enforcement: Managers compete within their assigned state jurisdiction
        if (!isGlobalAdmin) {
          const mState = resolveStateName(m);
          if (callerState && mState) {
            const match = callerState === mState || callerState.includes(mState) || mState.includes(callerState);
            if (!match) continue;
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

      const now = new Date();
      const periodMs = period === 'quarter' 
        ? 90 * 24 * 60 * 60 * 1000 
        : (period === 'year' || period === 'fullyear' 
          ? 365 * 24 * 60 * 60 * 1000 
          : 30 * 24 * 60 * 60 * 1000);
      const periodStart = new Date(now.getTime() - periodMs);

      // Deduplicate vendors consistently with Dashboard
      const seenVendors = new Set();
      const uniqueVendors = [];
      for (const v of (allVendors || [])) {
        if (!v) continue;
        const key = String(v.registrationId || v._id || v.id || `${v.phone || v.mobile}_${v.businessName}`);
        if (!seenVendors.has(key)) {
          seenVendors.add(key);
          uniqueVendors.push(v);
        }
      }

      const rankedList = await Promise.all(candidateManagers.map(async (m, idx) => {
        const state = m.stateId ? stateMap.get(String(m.stateId)) : null;
        const district = m.districtId ? districtMap.get(String(m.districtId)) : null;
        const division = m.divisionId ? divisionMap.get(String(m.divisionId)) : null;
        const pincode = m.pincodeId ? pincodeMap.get(String(m.pincodeId)) : null;

        // Calculate real vendors in this respective manager's scope or direct attribution
        const mId = String(m._id || m.id || m.managerId || '');
        const managerVendors = [];
        for (const v of uniqueVendors) {
          const isDirect = String(v.createdBy || v.managerId || v.userId || v.recordedById || v.agentId || v.onboardedBy || v.registeredById || '') === mId;
          if (isDirect) {
            managerVendors.push(v);
          } else {
            const inScope = await territoryScopeService.isRecordInScope(v, m);
            if (inScope) {
              managerVendors.push(v);
            }
          }
        }

        // Filter by selected time period (when period is 'all', all-time vendors are evaluated)
        const periodVendors = managerVendors.filter(v => {
          if (!period || period === 'all') return true;
          if (!v.createdAt) return true;
          return new Date(v.createdAt) >= periodStart;
        });

        const totalVendors = periodVendors.length;
        const activeVendors = periodVendors.filter(v => isVendorActive(v.status)).length;
        const pendingVendors = periodVendors.filter(v => isVendorPending(v.status)).length;

        const basePoints = (activeVendors * 250) + (totalVendors * 80);
        const target = Math.max(totalVendors + 2, 5);
        const slaRate = totalVendors > 0 
          ? `${Math.min(99, Math.round((activeVendors / totalVendors) * 100))}%`
          : '0.0%';

        let territoryText = state?.name || m.state || 'Assigned Territory';
        if (pincode?.code || m.pincodeCode || m.pincode) {
          const pin = pincode?.code || m.pincodeCode || m.pincode;
          const divName = division?.name || m.division || '';
          territoryText = divName ? `PIN ${pin} (${divName})` : `PIN ${pin}`;
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

      return {
        success: true,
        count: rankedWithPosition.length,
        data: rankedWithPosition,
        top3: rankedWithPosition.slice(0, 3)
      };
    }, 300);

    res.json(payload);
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
      stateId: user.stateId || (user.state === 'Karnataka' ? 'state_ka' : '6aa10f70ca0932e6eaec1f5c'),
      state: user.stateName || user.state || (user.stateId === 'state_ka' ? 'Karnataka' : (user.stateId === 'state_tn' || user.stateId === '6aa10f70ca0932e6eaec1f5c' ? 'Tamil Nadu' : null)),
      districtId: user.districtId || null,
      district: user.districtName || user.district || null,
      divisionId: user.divisionId || null,
      division: user.divisionName || user.division || null,
      pincodeId: user.pincodeId || null,
      pincode: user.pincodeCode || user.pincode || null,
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

    const [allReports, allUsers, allManagers, districts, divisions, pincodes] = await Promise.all([
      db.submittedReports.find(),
      db.users.find(),
      db.managers ? db.managers.find() : [],
      db.districts.find(user.stateId ? { stateId: user.stateId } : {}),
      db.divisions.find(user.districtId ? { districtId: user.districtId } : {}),
      db.pincodes.find(user.divisionId ? { divisionId: user.divisionId } : {})
    ]);

    // Build author lookup map for authoritative role and jurisdiction resolution
    const userMap = new Map();
    [...allUsers, ...allManagers].forEach(u => {
      if (!u) return;
      if (u.id) userMap.set(String(u.id), u);
      if (u._id) userMap.set(String(u._id), u);
      if (u.managerId) userMap.set(String(u.managerId), u);
      if (u.email) userMap.set(String(u.email).toLowerCase(), u);
      if (u.name) userMap.set(String(u.name).toLowerCase(), u);
    });

    const enrichedReports = allReports.map(r => {
      let mRole = r.managerRole;
      const author = userMap.get(String(r.managerId || '')) ||
                     userMap.get(String(r.managerEmail || '').toLowerCase()) ||
                     userMap.get(String(r.managerName || '').toLowerCase());
      if (author && (!mRole || mRole === 'manager' || mRole === 'Admin')) {
        mRole = author.role || mRole;
      }
      const authorState = author?.state || author?.stateName || (author?.stateId === 'state_ka' ? 'Karnataka' : (author?.stateId === 'state_tn' || author?.stateId === '6aa10f70ca0932e6eaec1f5c' ? 'Tamil Nadu' : null));
      return {
        ...r,
        managerRole: mRole || r.managerRole || (author ? author.role : ''),
        managerName: r.managerName || (author ? author.name : ''),
        stateId: r.stateId || (author ? author.stateId : null),
        state: r.state || authorState || null,
        districtId: r.districtId || (author ? author.districtId : null),
        district: r.district || (author ? (author.districtName || author.district) : null),
        divisionId: r.divisionId || (author ? author.divisionId : null),
        division: r.division || (author ? (author.divisionName || author.division) : null),
        pincodeId: r.pincodeId || (author ? author.pincodeId : null),
        pincode: r.pincode || (author ? (author.pincodeCode || author.pincode) : null)
      };
    });

    const filtered = [];
    for (const r of enrichedReports) {
      const visible = await territoryScopeService.isReportVisible(r, user, req.query.scope || 'all');
      if (!visible) continue;

      // Filter params
      if (district && district !== 'All' && String(r.districtId || '') !== String(district) && String(r.district || '') !== String(district)) continue;
      if (division && division !== 'All' && String(r.divisionId || '') !== String(division) && String(r.division || '') !== String(division)) continue;
      if (pincode && pincode !== 'All' && String(r.pincodeId || '') !== String(pincode) && String(r.pincode || '') !== String(pincode)) continue;
      if (managerRole && managerRole !== 'All' && String(r.managerRole || '').toLowerCase() !== String(managerRole).toLowerCase()) continue;

      if (search && search.trim()) {
        const q = search.toLowerCase();
        const matchCode = (r.reportCode || '').toLowerCase().includes(q);
        const matchName = (r.managerName || '').toLowerCase().includes(q);
        const matchPeriod = (r.periodLabel || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchPeriod) continue;
      }

      filtered.push(r);
    }

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

    // Resolve author user to enforce authoritative role level
    let enrichedReport = report;
    const author = await db.users.findOne({
      $or: [
        { id: report.managerId },
        { _id: report.managerId },
        { email: report.managerEmail },
        { name: report.managerName }
      ]
    });
    if (author) {
      enrichedReport = {
        ...report,
        managerRole: author.role || report.managerRole,
        managerName: report.managerName || author.name,
        stateId: report.stateId || author.stateId,
        state: report.state || author.state,
        districtId: report.districtId || author.districtId,
        district: report.district || author.district,
        divisionId: report.divisionId || author.divisionId,
        division: report.division || author.division,
        pincodeId: report.pincodeId || author.pincodeId,
        pincode: report.pincode || author.pincode
      };
    }

    const isVisible = await territoryScopeService.isReportVisible(enrichedReport, user, 'all');
    if (!isVisible) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to access reports outside your assigned territory or above your hierarchy level.'
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
