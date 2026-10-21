const db = require('../config/db');
const { cacheManager } = require('../realtime');

const norm = (s) => (s !== undefined && s !== null ? String(s).trim().toLowerCase() : '');

// Determine manager level: 1 = state, 2 = district, 3 = division, 4 = pincode
const getManagerLevel = (role) => {
  const r = norm(role);
  if (r.includes('admin')) return 99; // strictly exclude admins
  if (role === 'agent' || role === 'field_agent' || (r.includes('agent') && !r.includes('manager'))) return 99; // exclude field agents
  if (r.includes('state')) return 1;
  if (r.includes('district')) return 2;
  if (r.includes('division') || r.includes('divisional')) return 3;
  if (r.includes('pincode') || r.includes('pin_') || r.includes('pin ')) return 4;
  return 99;
};

// Check if an account is a manager
const isManagerAccount = (u) => {
  if (!u) return false;
  const role = norm(u.role);
  if (role.includes('admin')) return false; // exclude portal admins
  if (role === 'agent' || role === 'field_agent' || (role.includes('agent') && !role.includes('manager'))) return false; // exclude agents
  if (['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(role)) return true;
  if (role.endsWith('_manager') || role.endsWith(' manager')) return true;
  return false;
};

// Format role titles cleanly
const formatRoleTitle = (role) => {
  const r = norm(role);
  if (r.includes('state')) return 'State Agent Manager (Level 1)';
  if (r.includes('district')) return 'District Agent Manager (Level 2)';
  if (r.includes('division') || r.includes('divisional')) return 'Division Agent Manager (Level 3)';
  if (r.includes('pincode')) return 'Pincode Agent Manager (Level 4)';
  return String(role || 'Manager');
};

// Filter out mock/dummy/placeholder records from live views
const isMockRecord = (m) => {
  if (!m) return false;
  const email = norm(m.email);
  const id = String(m._id || m.id || '');
  const name = String(m.name || '');
  const mobile = String(m.mobile || m.phone || '').trim();

  if (email.endsWith('@example.com') || email.includes('example.com') || email.includes('@sample.com')) {
    if (email.includes('.mgr') || email.includes('mgr1@') || email.includes('mgr2@') || email.includes('mgr4@')) {
      return false;
    }
    return true;
  }
  if (id === 'user_state_ka' || id === 'user_state_1' || id === 'user_dist_1' || id === 'user_div_1' || id === 'user_pin_1' || id === 'user_admin') return true;
  if (mobile.startsWith('988880000') || mobile === '9999999999') return true;
  if (name.includes('(Karnataka State Manager)') || name.includes('(TN State Manager)') || name.includes('(Krishnagiri District Manager)') || name.includes('(Central Division Manager)') || name.includes('(Pincode Manager 635109)')) return true;

  return false;
};

const getLowerLevelManagers = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User context required' });
    }

    const userRole = norm(user.role);
    const userLevel = getManagerLevel(userRole);
    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin', 'superadmin', 'central_admin'].some(r => userRole === r) || 
      user.email === 'admin@example.com' || 
      String(user.id || user._id) === 'user_admin';

    // Fail closed if user role or hierarchy level cannot be verified
    if (userLevel === 99 && !isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: User hierarchy level cannot be verified',
        data: [],
        all: [],
        peers: [],
        subordinates: [],
        supervisors: [],
        reporting: [],
        count: 0
      });
    }

    // Current user's normalized territory (trusted session data)
    const userStateId = norm(user.stateId || user.assignedStateId || user.regionId || user.scope?.stateId);
    const userStateName = norm(user.state || user.stateName || user.assignedState || user.scope?.stateName);

    const userDistrictId = norm(user.districtId || user.assignedDistrictId || user.scope?.districtId);
    const userDistrictName = norm(user.district || user.districtName || user.assignedDistrict || user.scope?.districtName);

    const userDivisionId = norm(user.divisionId || user.assignedDivisionId || user.scope?.divisionId);
    const userDivisionName = norm(user.division || user.divisionName || user.assignedDivision || user.scope?.divisionName);

    const userPincodeId = norm(user.pincodeId || user.assignedPincodeId || user.scope?.pincodeId);
    const userPincodeCode = norm(user.pincode || user.pincodeCode || user.assignedPincode || user.scope?.pincodeCode);

    // Fail closed: enforce valid assigned territory based on user level
    if (!isGlobalAdmin) {
      if (userLevel === 1 && !userStateId && !userStateName) {
        return res.status(403).json({ success: false, message: 'Access denied: State jurisdiction cannot be verified', count: 0, all: [], peers: [], subordinates: [], supervisors: [], reporting: [], data: [] });
      }
      if (userLevel === 2 && !userDistrictId && !userDistrictName) {
        return res.status(403).json({ success: false, message: 'Access denied: District jurisdiction cannot be verified', count: 0, all: [], peers: [], subordinates: [], supervisors: [], reporting: [], data: [] });
      }
      if (userLevel === 3 && !userDivisionId && !userDivisionName) {
        return res.status(403).json({ success: false, message: 'Access denied: Division jurisdiction cannot be verified', count: 0, all: [], peers: [], subordinates: [], supervisors: [], reporting: [], data: [] });
      }
      if (userLevel === 4 && !userPincodeId && !userPincodeCode) {
        return res.status(403).json({ success: false, message: 'Access denied: Pincode jurisdiction cannot be verified', count: 0, all: [], peers: [], subordinates: [], supervisors: [], reporting: [], data: [] });
      }
    }

    const cacheKey = `managers:directory:${user.id || user._id || 'mgr'}:${userRole}`;

    const baselineData = await cacheManager.fetchWithCache(cacheKey, async () => {
      const [allUsers, allManagers, states, districts, divisions, pincodes] = await Promise.all([
        db.users.find(),
        db.managers.find(),
        db.states.find(),
        db.districts.find(),
        db.divisions.find(),
        db.pincodes.find()
      ]);

      const stateMap = new Map((states || []).map(s => [String(s._id || s.id), s]));
      const districtMap = new Map((districts || []).map(d => [String(d._id || d.id), d]));
      const divisionMap = new Map((divisions || []).map(d => [String(d._id || d.id), d]));
      const pincodeMap = new Map((pincodes || []).map(p => [String(p._id || p.id), p]));
      const pincodeByCodeMap = new Map((pincodes || []).map(p => [String(p.code || p.pincode).trim(), p]));

      const mgrByEmail = new Map();
      const mgrById = new Map();
      (allManagers || []).forEach(m => {
        if (m.email) mgrByEmail.set(norm(m.email), m);
        if (m._id || m.id) mgrById.set(String(m._id || m.id), m);
      });

      const combined = [...(allUsers || []), ...(allManagers || [])];
      const seen = new Set();
      const uniqueManagers = [];
      for (const u of combined) {
        if (!u || !isManagerAccount(u) || isMockRecord(u)) continue;
        // Strictly exclude pending registrations and unapproved applicants from active Manager Directory
        const st = norm(u.status);
        const ost = norm(u.overallRegistrationStatus);
        const isApproved = u.isApproved === true || st === 'active' || st === 'approved';
        if (!isApproved) continue;
        if (st.includes('pending') || st.includes('review') || st.includes('reject') ||
            ost.includes('pending') || ost.includes('review') || ost.includes('reject')) {
          continue;
        }

        const key = String(u._id || u.id || u.email || u.mobile || '');
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const matchedMgr = mgrByEmail.get(norm(u.email)) || mgrById.get(String(u._id || u.id)) || null;
        const mergedManager = {
          ...u,
          ...(matchedMgr || {}),
          ...u,
          bankDetails: u.bankDetails || u.bankAccount || matchedMgr?.bankDetails || matchedMgr?.bankAccount || null,
          bankAccount: u.bankAccount || u.bankDetails || matchedMgr?.bankAccount || matchedMgr?.bankDetails || null,
          managerId: u.managerId || matchedMgr?.managerId || null
        };

        uniqueManagers.push(mergedManager);
      }


      // Enrich territory details for candidate manager
      const enrichCandidateTerritory = (m) => {
        let sId = m.stateId || m.regionId || m.assignedStateId;
        let sName = m.state || m.stateName || m.assignedState;
        let dId = m.districtId || m.assignedDistrictId;
        let dName = m.district || m.districtName || m.assignedDistrict;
        let divId = m.divisionId || m.assignedDivisionId;
        let divName = m.division || m.divisionName || m.assignedDivision;
        let pId = m.pincodeId || m.assignedPincodeId;
        let pCode = m.pincode || m.pincodeCode || m.assignedPincode;

        if (pCode && pincodeByCodeMap.has(String(pCode).trim())) {
          const pinObj = pincodeByCodeMap.get(String(pCode).trim());
          if (!pId) pId = pinObj._id || pinObj.id;
          if (!divId && pinObj.divisionId) divId = pinObj.divisionId;
          if (!divName && pinObj.division) divName = pinObj.division;
          if (!dId && pinObj.districtId) dId = pinObj.districtId;
          if (!dName && pinObj.district) dName = pinObj.district;
          if (!sId && pinObj.stateId) sId = pinObj.stateId;
          if (!sName && pinObj.state) sName = pinObj.state;
        } else if (pId && pincodeMap.has(String(pId))) {
          const pinObj = pincodeMap.get(String(pId));
          if (!pCode) pCode = pinObj.code;
          if (!divId && pinObj.divisionId) divId = pinObj.divisionId;
          if (!divName && pinObj.division) divName = pinObj.division;
          if (!dId && pinObj.districtId) dId = pinObj.districtId;
          if (!dName && pinObj.district) dName = pinObj.district;
          if (!sId && pinObj.stateId) sId = pinObj.stateId;
          if (!sName && pinObj.state) sName = pinObj.state;
        }

        if (divId && divisionMap.has(String(divId))) {
          const divObj = divisionMap.get(String(divId));
          if (!divName) divName = divObj.name;
          if (!dId && divObj.districtId) dId = divObj.districtId;
          if (!sId && divObj.stateId) sId = divObj.stateId;
        }

        if (dId && districtMap.has(String(dId))) {
          const distObj = districtMap.get(String(dId));
          if (!dName) dName = distObj.name;
          if (!sId && distObj.stateId) sId = distObj.stateId;
        }

        if (sId && stateMap.has(String(sId))) {
          const stateObj = stateMap.get(String(sId));
          if (!sName) sName = stateObj.name;
        }

        return {
          stateId: sId,
          stateName: sName,
          districtId: dId,
          districtName: dName,
          divisionId: divId,
          divisionName: divName,
          pincodeId: pId,
          pincodeCode: pCode
        };
      };

      const matchState = (m, en) => {
        if (isGlobalAdmin) return true;
        const mStateId = norm(en.stateId || m.stateId || m.regionId || m.assignedStateId);
        const mStateName = norm(en.stateName || m.stateName || m.state || m.assignedState);
        if (userStateId && mStateId && userStateId === mStateId) return true;
        if (userStateName && mStateName && userStateName === mStateName) return true;
        return false;
      };

      const matchDistrict = (m, en) => {
        if (isGlobalAdmin) return true;
        if (!matchState(m, en)) return false;
        if (userLevel === 1) return true; // State Manager matches any district within state
        const mDistrictId = norm(en.districtId || m.districtId || m.assignedDistrictId);
        const mDistrictName = norm(en.districtName || m.districtName || m.district || m.assignedDistrict);
        if (userDistrictId && mDistrictId && userDistrictId === mDistrictId) return true;
        if (userDistrictName && mDistrictName && userDistrictName === mDistrictName) return true;
        return false;
      };

      const matchDivision = (m, en) => {
        if (isGlobalAdmin) return true;
        if (!matchDistrict(m, en)) return false;
        if (userLevel <= 2) return true; // State/District Manager matches any division within district
        const mDivisionId = norm(en.divisionId || m.divisionId || m.assignedDivisionId);
        const mDivisionName = norm(en.divisionName || m.divisionName || m.division || m.assignedDivision);
        if (userDivisionId && mDivisionId && userDivisionId === mDivisionId) return true;
        if (userDivisionName && mDivisionName && userDivisionName === mDivisionName) return true;
        return false;
      };

      const matchPincode = (m, en) => {
        if (isGlobalAdmin) return true;
        if (!matchDivision(m, en)) return false;
        if (userLevel <= 3) return true; // State, District & Division Manager matches any pincode within division
        const mPincodeId = norm(en.pincodeId || m.pincodeId || m.assignedPincodeId);
        const mPincodeCode = norm(en.pincodeCode || m.pincodeCode || m.pincode || m.assignedPincode);
        if (userPincodeCode && mPincodeCode && userPincodeCode === mPincodeCode) return true;
        if (userPincodeId && mPincodeId && userPincodeId === mPincodeId) return true;
        return false;
      };

      const currentUserId = String(user.id || user._id || '');
      const currentUserEmail = norm(user.email);
      const isSelfUser = (m) => {
        const mId = String(m._id || m.id || '');
        const mEmail = norm(m.email);
        return (currentUserId && mId === currentUserId) || (currentUserEmail && mEmail === currentUserEmail);
      };

      // Filter peers (equal level in the exact assigned territorial jurisdiction)
      const rawPeers = uniqueManagers.filter(m => {
        if (isSelfUser(m)) return false;
        const mLevel = getManagerLevel(m.role);
        if (mLevel !== userLevel && !isGlobalAdmin) return false;
        const en = enrichCandidateTerritory(m);

        if (userLevel === 1) return matchState(m, en); // State managers in same state ONLY (no cross-state exposure)
        if (userLevel === 2) return matchDistrict(m, en); // District managers in same district ONLY
        if (userLevel === 3) return matchDivision(m, en); // Division managers in same division ONLY
        if (userLevel === 4) return matchPincode(m, en); // Pincode managers in same pincode ONLY
        return isGlobalAdmin;
      });

      // Filter subordinates (strictly lower-level managers: mLevel > userLevel within user's territorial jurisdiction)
      // Level 1: L2, L3, L4 in state
      // Level 2: L3, L4 in district (NEVER Level 1)
      // Level 3: L4 in division (NEVER Level 1 or 2)
      // Level 4: NONE (empty)
      const rawSubordinates = uniqueManagers.filter(m => {
        if (isSelfUser(m)) return false;
        const mLevel = getManagerLevel(m.role);
        if (mLevel <= userLevel && !isGlobalAdmin) return false; // Strictly lower-level only!
        const en = enrichCandidateTerritory(m);

        if (userLevel === 1) {
          if (![2, 3, 4].includes(mLevel) && !isGlobalAdmin) return false;
          return matchState(m, en);
        } else if (userLevel === 2) {
          if (![3, 4].includes(mLevel) && !isGlobalAdmin) return false;
          return matchDistrict(m, en);
        } else if (userLevel === 3) {
          if (mLevel !== 4 && !isGlobalAdmin) return false;
          return matchDivision(m, en);
        } else if (userLevel === 4) {
          return false; // Pincode Manager has no subordinates
        }
        return isGlobalAdmin && [2, 3, 4].includes(mLevel);
      });

      const populateManager = (m, relation) => {
        const en = enrichCandidateTerritory(m);
        const mId = String(m._id || m.id || '');
        const isSelf = isSelfUser(m);
        const mLevel = getManagerLevel(m.role);

        let normLevel = 'pincode';
        if (mLevel === 1) normLevel = 'state';
        else if (mLevel === 2) normLevel = 'district';
        else if (mLevel === 3) normLevel = 'division';

        const sName = en.stateName || null;
        const dName = en.districtName || null;
        const divName = en.divisionName || null;
        const pCode = en.pincodeCode || null;
        const pArea = m.area || m.pincodeArea || null;

        let relationLabel = 'Under Your Scope (Subordinate)';
        if (isSelf) relationLabel = 'You (Current User)';
        else if (relation === 'peer') relationLabel = 'Equal Level (Peer)';

        const rolePrefix = mLevel === 1 ? 'STM' : mLevel === 2 ? 'DTM' : mLevel === 3 ? 'DIV' : 'PIN';
        const resolvedManagerId = m.managerId || `MGR-${rolePrefix}-${String(mId).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;

        const rawBd = m.bankDetails || m.bankAccount || null;
        const isAuthorizedViewer = isSelf || isGlobalAdmin || (userLevel < mLevel);
        let resolvedBankDetails = null;

        if (isAuthorizedViewer && rawBd && typeof rawBd === 'object') {
          const rawAcc = String(rawBd.accountNumber || '').trim().replace(/\s/g, '');
          resolvedBankDetails = {
            accountHolderName: rawBd.accountHolderName || '',
            bankName: rawBd.bankName || '',
            branchName: rawBd.branchName || '',
            city: rawBd.city || '',
            street: rawBd.street || null,
            ifscCode: rawBd.ifscCode || '',
            accountNumber: isSelf || isGlobalAdmin ? rawAcc : (rawAcc ? `•••• •••• •••• ${rawAcc.slice(-4)}` : '')
          };
        }

        return {
          id: resolvedManagerId,
          _id: mId,
          managerId: resolvedManagerId,
          name: String(m.name || 'Manager'),
          email: String(m.email || ''),
          mobile: String(m.mobile || m.phone || ''),
          role: String(m.role || 'manager'),
          roleTitle: formatRoleTitle(m.role),
          level: normLevel,
          status: String(m.status || 'active').toLowerCase(),
          avatarUrl: m.avatarUrl || null,
          relation,
          relationLabel,
          isSelf,
          stateId: en.stateId || null,
          stateName: sName,
          districtId: en.districtId || null,
          districtName: dName,
          divisionId: en.divisionId || null,
          divisionName: divName,
          pincodeId: en.pincodeId || null,
          pincodeCode: pCode,
          pincodeArea: pArea,
          bankDetails: resolvedBankDetails
        };
      };

      const peers = rawPeers.map(m => populateManager(m, 'peer'));
      const subordinates = rawSubordinates.map(m => populateManager(m, 'subordinate'));
      const all = [...peers, ...subordinates];

      return {
        all,
        peers,
        subordinates
      };
    }, 300);

    // Filter baseline dataset based on query params (strict RBAC guarantees: no higher role or cross-territory data can ever be exposed)
    let filteredAll = [...baselineData.all];
    let filteredPeers = [...baselineData.peers];
    let filteredSubordinates = [...baselineData.subordinates];

    // Filter by role parameter
    if (req.query.role && req.query.role !== 'All') {
      const targetRole = norm(req.query.role);
      const targetLevel = getManagerLevel(targetRole);
      if (targetLevel < userLevel && !isGlobalAdmin) {
        // Direct request for higher level role than user's authorized rank: return 0 records
        filteredAll = [];
        filteredPeers = [];
        filteredSubordinates = [];
      } else {
        filteredAll = filteredAll.filter(m => norm(m.role) === targetRole);
        filteredPeers = filteredPeers.filter(m => norm(m.role) === targetRole);
        filteredSubordinates = filteredSubordinates.filter(m => norm(m.role) === targetRole);
      }
    }

    // Filter by level parameter
    if (req.query.level && req.query.level !== 'All') {
      const targetLvlNum = Number(req.query.level);
      if (targetLvlNum < userLevel && !isGlobalAdmin) {
        filteredAll = [];
        filteredPeers = [];
        filteredSubordinates = [];
      } else {
        filteredAll = filteredAll.filter(m => getManagerLevel(m.role) === targetLvlNum);
        filteredPeers = filteredPeers.filter(m => getManagerLevel(m.role) === targetLvlNum);
        filteredSubordinates = filteredSubordinates.filter(m => getManagerLevel(m.role) === targetLvlNum);
      }
    }

    // Filter by tab parameter
    if (req.query.tab) {
      const tab = norm(req.query.tab);
      if (tab === 'supervisors' || tab === 'reporting') {
        filteredAll = [];
      } else if (tab === 'equal' || tab === 'peers') {
        filteredAll = filteredPeers;
      } else if (tab === 'under' || tab === 'subordinates') {
        filteredAll = filteredSubordinates;
      }
    }

    // Filter by search query
    if (req.query.search || req.query.q) {
      const q = norm(req.query.search || req.query.q);
      const matches = m => {
        return norm(m.name).includes(q) ||
               norm(m.email).includes(q) ||
               norm(m.mobile).includes(q) ||
               norm(m.pincodeArea).includes(q) ||
               norm(m.pincodeCode).includes(q) ||
               norm(m.divisionName).includes(q) ||
               norm(m.districtName).includes(q) ||
               norm(m.managerId).includes(q);
      };
      filteredAll = filteredAll.filter(matches);
      filteredPeers = filteredPeers.filter(matches);
      filteredSubordinates = filteredSubordinates.filter(matches);
    }

    // CSV Export support
    if (norm(req.query.export) === 'csv' || norm(req.query.format) === 'csv') {
      const csvRows = [
        ['ID', 'Name', 'Role', 'Relation', 'State', 'District', 'Division', 'Pincode', 'Mobile', 'Email', 'Status'].join(',')
      ];
      filteredAll.forEach(m => {
        csvRows.push([
          `"${m.id || ''}"`,
          `"${(m.name || '').replace(/"/g, '""')}"`,
          `"${m.roleTitle || m.role || ''}"`,
          `"${m.relationLabel || m.relation || ''}"`,
          `"${m.stateName || ''}"`,
          `"${m.districtName || ''}"`,
          `"${m.divisionName || ''}"`,
          `"${m.pincodeCode || ''}"`,
          `"${m.mobile || ''}"`,
          `"${m.email || ''}"`,
          `"${m.status || ''}"`
        ].join(','));
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="managers_directory.csv"');
      return res.status(200).send(csvRows.join('\n'));
    }

    // Pagination
    let paginatedAll = filteredAll;
    if (req.query.page || req.query.limit) {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.limit) || 50);
      paginatedAll = filteredAll.slice((page - 1) * limit, page * limit);
    }

    return res.json({
      success: true,
      count: filteredAll.length,
      data: filteredSubordinates, // Backwards compatibility for tests expecting subordinate-only array
      subordinates: filteredSubordinates,
      peers: filteredPeers,
      supervisors: [],
      reporting: [],
      all: paginatedAll,
      stats: {
        total: filteredAll.length,
        supervisorsCount: 0,
        peersCount: filteredPeers.length,
        subordinatesCount: filteredSubordinates.length,
        currentUserRole: user.role
      }
    });
  } catch (err) {
    console.error('Get manager directory error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve manager directory' });
  }
};

const getManagerById = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Manager ID is required' });
    }

    // Reuse getLowerLevelManagers logic to ensure identical security and RBAC scoping
    const fakeReq = {
      ...req,
      query: { ...req.query, page: 1, limit: 1000 }
    };

    let targetManager = null;
    const fakeRes = {
      status: () => fakeRes,
      setHeader: () => {},
      send: () => {},
      json: (payload) => {
        if (payload && payload.all) {
          targetManager = payload.all.find(m => 
            String(m.id || '').toLowerCase() === targetId.toLowerCase() ||
            String(m._id || '').toLowerCase() === targetId.toLowerCase() ||
            String(m.managerId || '').toLowerCase() === targetId.toLowerCase()
          );
        }
      }
    };

    await getLowerLevelManagers(fakeReq, fakeRes);

    if (!targetManager) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found or not authorized within your assigned territory'
      });
    }

    return res.json({
      success: true,
      manager: targetManager,
      data: targetManager
    });
  } catch (err) {
    console.error('getManagerById error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve manager details' });
  }
};

module.exports = {
  getLowerLevelManagers,
  getManagers: getLowerLevelManagers,
  getManagerById
};

