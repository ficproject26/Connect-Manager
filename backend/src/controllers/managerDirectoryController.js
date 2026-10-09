const db = require('../config/db');

const norm = (s) => (s !== undefined && s !== null ? String(s).trim().toLowerCase() : '');

// Determine manager level: 1 = state, 2 = district, 3 = division, 4 = pincode
const getManagerLevel = (role) => {
  const r = norm(role);
  if (r.includes('agent')) return 99; // strictly exclude field agents
  if (r.includes('admin')) return 99; // strictly exclude admins
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
  if (role.includes('agent')) return false; // exclude agents
  if (role.includes('admin')) return false; // exclude portal admins
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

const getLowerLevelManagers = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User context required' });
    }

    const [allUsers, allManagers] = await Promise.all([
      db.users.find(),
      db.managers.find()
    ]);

    const combined = [...(allUsers || []), ...(allManagers || [])];
    const seen = new Set();
    const uniqueManagers = [];
    for (const u of combined) {
      if (!u || !isManagerAccount(u)) continue;
      const key = String(u._id || u.id || u.email || u.mobile || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueManagers.push(u);
    }

    const userRole = norm(user.role);
    const userLevel = getManagerLevel(userRole);
    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].some(r => userRole.includes(r)) || 
      user.email === 'admin@example.com' || 
      String(user.id || user._id) === 'user_admin';

    // Current user's normalized territory
    const userStateId = norm(user.stateId || user.assignedStateId || user.regionId || user.scope?.stateId);
    const userStateName = norm(user.state || user.stateName || user.assignedState || user.scope?.stateName);

    const userDistrictId = norm(user.districtId || user.assignedDistrictId || user.scope?.districtId);
    const userDistrictName = norm(user.district || user.districtName || user.assignedDistrict || user.scope?.districtName);

    const userDivisionId = norm(user.divisionId || user.assignedDivisionId || user.scope?.divisionId);
    const userDivisionName = norm(user.division || user.divisionName || user.assignedDivision || user.scope?.divisionName);

    const userPincodeId = norm(user.pincodeId || user.assignedPincodeId || user.scope?.pincodeId);
    const userPincodeCode = norm(user.pincode || user.pincodeCode || user.assignedPincode || user.scope?.pincodeCode);

    const matchState = (m) => {
      if (isGlobalAdmin) return true;
      const mStateId = norm(m.stateId || m.regionId || m.assignedStateId);
      const mStateName = norm(m.stateName || m.state || m.assignedState);
      if (userStateId && mStateId && userStateId === mStateId) return true;
      if (userStateName && mStateName && userStateName === mStateName) return true;
      return false;
    };

    const matchDistrict = (m) => {
      if (isGlobalAdmin) return true;
      if (!matchState(m)) return false;
      if (userLevel === 1) return true; // State Manager matches any district within state
      const mDistrictId = norm(m.districtId || m.assignedDistrictId);
      const mDistrictName = norm(m.districtName || m.district || m.assignedDistrict);
      if (userDistrictId && mDistrictId && userDistrictId === mDistrictId) return true;
      if (userDistrictName && mDistrictName && userDistrictName === mDistrictName) return true;
      return false;
    };

    const matchDivision = (m) => {
      if (isGlobalAdmin) return true;
      if (!matchDistrict(m)) return false;
      if (userLevel <= 2) return true; // State/District Manager matches any division within district
      const mDivisionId = norm(m.divisionId || m.assignedDivisionId);
      const mDivisionName = norm(m.divisionName || m.division || m.assignedDivision);
      if (userDivisionId && mDivisionId && userDivisionId === mDivisionId) return true;
      if (userDivisionName && mDivisionName && userDivisionName === mDivisionName) return true;
      return false;
    };

    const matchPincode = (m) => {
      if (isGlobalAdmin) return true;
      if (!matchState(m)) return false;
      const mPincodeId = norm(m.pincodeId || m.assignedPincodeId);
      const mPincodeCode = norm(m.pincodeCode || m.pincode || m.assignedPincode);
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

    // Filter supervisors (higher-level managers in user's direct territorial hierarchy line)
    const rawSupervisors = uniqueManagers.filter(m => {
      if (isSelfUser(m)) return false;
      const mLevel = getManagerLevel(m.role);
      if (mLevel >= userLevel) return false; // Strictly higher level (1 < 2 < 3 < 4)
      if (isGlobalAdmin) return false;

      if (userLevel === 4) {
        // Pincode Manager reports to Division, District, and State managers
        if (mLevel === 3) return matchDivision(m) || matchDistrict(m);
        if (mLevel === 2) return matchDistrict(m);
        if (mLevel === 1) return matchState(m);
      } else if (userLevel === 3) {
        // Division Manager reports to District and State managers
        if (mLevel === 2) return matchDistrict(m);
        if (mLevel === 1) return matchState(m);
      } else if (userLevel === 2) {
        // District Manager reports to State manager
        if (mLevel === 1) return matchState(m);
      }
      return false;
    });

    // Filter peers (equal level in the relevant territorial jurisdiction)
    const rawPeers = uniqueManagers.filter(m => {
      if (isSelfUser(m)) return false;
      const mLevel = getManagerLevel(m.role);
      if (mLevel !== userLevel && !isGlobalAdmin) return false;

      if (userLevel === 1) return true; // State managers nationwide are peers
      if (userLevel === 2) return matchState(m); // District managers in same state
      if (userLevel === 3) return matchDistrict(m) || matchState(m); // Division managers in district/state
      if (userLevel === 4) return matchDivision(m) || matchDistrict(m) || matchState(m); // Pincode managers in division/district/state
      return isGlobalAdmin;
    });

    // Filter subordinates (strictly lower-level managers permitted by hierarchy level and assigned territory)
    const rawSubordinates = uniqueManagers.filter(m => {
      if (isSelfUser(m)) return false;
      const mLevel = getManagerLevel(m.role);

      if (userLevel === 1) {
        // State Manager: District (2), Division (3), and Pincode (4) managers in the state
        if (![2, 3, 4].includes(mLevel) && !isGlobalAdmin) return false;
        return matchState(m);
      } else if (userLevel === 2) {
        // District Manager: Division (3) and Pincode (4) managers in the district
        if (![3, 4].includes(mLevel) && !isGlobalAdmin) return false;
        return matchDistrict(m);
      } else if (userLevel === 3) {
        // Division Manager: Pincode (4) managers in the division
        if (mLevel !== 4 && !isGlobalAdmin) return false;
        return matchDivision(m);
      } else if (userLevel === 4) {
        // Pincode Manager: No subordinate manager levels
        return false;
      }
      return isGlobalAdmin && [2, 3, 4].includes(mLevel);
    });

    // Populate manager details
    const populateManager = async (m, relation) => {
      const [state, district, division, pincode] = await Promise.all([
        m.stateId ? db.states.findById(m.stateId) : null,
        m.districtId ? db.districts.findById(m.districtId) : null,
        m.divisionId ? db.divisions.findById(m.divisionId) : null,
        m.pincodeId ? db.pincodes.findById(m.pincodeId) : null
      ]);

      const mId = String(m._id || m.id || '');
      const isSelf = isSelfUser(m);
      const mLevel = getManagerLevel(m.role);

      let normLevel = 'pincode';
      if (mLevel === 1) normLevel = 'state';
      else if (mLevel === 2) normLevel = 'district';
      else if (mLevel === 3) normLevel = 'division';

      const sName = state?.name || m.state || m.stateName || m.assignedState || null;
      const dName = district?.name || m.district || m.districtName || m.assignedDistrict || null;
      const divName = division?.name || m.division || m.divisionName || m.assignedDivision || null;
      const pCode = pincode?.code || m.pincodeCode || m.pincode || m.assignedPincode || null;
      const pArea = pincode?.areaName || pincode?.name || m.area || null;

      let relationLabel = 'Under Your Scope (Subordinate)';
      if (isSelf) relationLabel = 'You (Current User)';
      else if (relation === 'supervisor') relationLabel = 'Reporting Authority (Supervisor)';
      else if (relation === 'peer') relationLabel = 'Equal Level (Peer)';

      return {
        id: mId,
        _id: mId,
        name: String(m.name || 'Manager'),
        email: String(m.email || ''),
        mobile: String(m.mobile || m.phone || ''),
        role: String(m.role || 'manager'),
        roleTitle: formatRoleTitle(m.role),
        level: normLevel,
        status: String(m.status || 'active').toLowerCase(),
        relation, // 'supervisor', 'peer', or 'subordinate'
        relationLabel,
        isSelf,
        stateId: m.stateId || state?._id || null,
        stateName: sName,
        districtId: m.districtId || district?._id || null,
        districtName: dName,
        divisionId: m.divisionId || division?._id || null,
        divisionName: divName,
        pincodeId: m.pincodeId || pincode?._id || null,
        pincodeCode: pCode,
        pincodeArea: pArea
      };
    };

    const supervisors = await Promise.all(rawSupervisors.map(m => populateManager(m, 'supervisor')));
    const peers = await Promise.all(rawPeers.map(m => populateManager(m, 'peer')));
    const subordinates = await Promise.all(rawSubordinates.map(m => populateManager(m, 'subordinate')));
    
    // Sort all: supervisors first, then peers, then subordinates
    const all = [...supervisors, ...peers, ...subordinates];

    res.json({
      success: true,
      count: all.length,
      data: subordinates, // backwards compatibility with subordinate-only checks
      subordinates,
      peers,
      supervisors,
      reporting: supervisors,
      all,
      stats: {
        total: all.length,
        supervisorsCount: supervisors.length,
        peersCount: peers.length,
        subordinatesCount: subordinates.length,
        currentUserRole: user.role
      }
    });
  } catch (err) {
    console.error('Get manager directory error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve manager directory' });
  }
};

module.exports = {
  getLowerLevelManagers
};
