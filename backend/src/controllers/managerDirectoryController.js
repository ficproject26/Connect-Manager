const db = require('../config/db');

const getLowerLevelManagers = async (req, res) => {
  try {
    const user = req.user;
    const [allUsers, allManagers] = await Promise.all([
      db.users.find(),
      db.managers.find()
    ]);

    const combined = [...(allUsers || []), ...(allManagers || [])];
    const seen = new Set();
    const uniqueUsers = [];
    for (const u of combined) {
      if (!u) continue;
      const key = String(u._id || u.id || u.email || u.mobile || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueUsers.push(u);
    }

    const norm = (s) => (s ? String(s).trim().toLowerCase() : '');
    const userRole = norm(user.role);

    const userStateId = norm(user.stateId || user.assignedStateId || user.regionId || user.scope?.stateId);
    const userStateName = norm(user.state || user.stateName || user.assignedState || user.scope?.stateName);

    const userDistrictId = norm(user.districtId || user.assignedDistrictId || user.scope?.districtId);
    const userDistrictName = norm(user.district || user.districtName || user.assignedDistrict || user.scope?.districtName);

    const userDivisionId = norm(user.divisionId || user.assignedDivisionId || user.scope?.divisionId);
    const userDivisionName = norm(user.division || user.divisionName || user.assignedDivision || user.scope?.divisionName);

    const userPincodeId = norm(user.pincodeId || user.assignedPincodeId || user.scope?.pincodeId);
    const userPincode = norm(user.pincode || user.pincodeCode || user.scope?.pincodeCode);

    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(userRole) || 
      user.email === 'admin@example.com' || 
      String(user.id || user._id) === 'user_admin';

    // Determine level: 1 = state, 2 = district, 3 = division, 4 = pincode
    const getLevel = (r) => {
      const nr = norm(r);
      if (nr.includes('state')) return 1;
      if (nr.includes('district')) return 2;
      if (nr.includes('division') || nr.includes('divisional')) return 3;
      if (nr.includes('pincode')) return 4;
      return 99;
    };

    const userLevel = getLevel(userRole);

    const matchState = (u) => {
      if (isGlobalAdmin) return true;
      const uStateId = norm(u.stateId || u.regionId || u.assignedStateId);
      const uStateName = norm(u.stateName || u.state || u.assignedState);
      if (userStateId && uStateId && userStateId === uStateId) return true;
      if (userStateName && uStateName && userStateName === uStateName) return true;
      return !userStateId && !userStateName;
    };

    const matchDistrict = (u) => {
      if (!matchState(u)) return false;
      if (userLevel === 1 || isGlobalAdmin) return true;
      const uDistrictId = norm(u.districtId || u.assignedDistrictId);
      const uDistrictName = norm(u.districtName || u.district || u.assignedDistrict);
      if (userDistrictId && uDistrictId && userDistrictId === uDistrictId) return true;
      if (userDistrictName && uDistrictName && userDistrictName === uDistrictName) return true;
      return !userDistrictId && !userDistrictName;
    };

    const matchDivision = (u) => {
      if (!matchDistrict(u)) return false;
      if (userLevel <= 2 || isGlobalAdmin) return true;
      const uDivisionId = norm(u.divisionId || u.assignedDivisionId);
      const uDivisionName = norm(u.divisionName || u.division || u.assignedDivision);
      if (userDivisionId && uDivisionId && userDivisionId === uDivisionId) return true;
      if (userDivisionName && uDivisionName && userDivisionName === uDivisionName) return true;
      return !userDivisionId && !userDivisionName;
    };

    const matchPincode = (u) => {
      if (!matchDivision(u)) return false;
      if (userLevel <= 3 || isGlobalAdmin) return true;
      const uPincodeId = norm(u.pincodeId || u.assignedPincodeId);
      const uPin = norm(u.pincodeCode || u.pincode || u.assignedPincode);
      if (userPincodeId && uPincodeId && userPincodeId === uPincodeId) return true;
      if (userPincode && uPin && userPincode === uPin) return true;
      return !userPincodeId && !userPincode;
    };

    // Helper to format role titles
    const formatRoleTitle = (role) => {
      const r = String(role || '').toLowerCase();
      if (r.includes('state')) return 'State Agent Manager (Level 1)';
      if (r.includes('district')) return 'District Agent Manager (Level 2)';
      if (r.includes('division') || r.includes('divisional')) return 'Division Agent Manager (Level 3)';
      if (r.includes('pincode')) return 'Pincode Agent Manager (Level 4)';
      return String(role || 'Manager');
    };

    const currentUserId = String(user.id || user._id || '');

    // Filter peers (equal level, excluding current user)
    const rawPeers = uniqueUsers.filter(u => {
      const uId = String(u._id || u.id || '');
      if (uId === currentUserId) return false;
      const uLevel = getLevel(u.role);
      if (uLevel !== userLevel && !isGlobalAdmin) return false;

      if (userLevel === 1) return matchState(u);
      if (userLevel === 2) return matchDistrict(u);
      if (userLevel === 3) return matchDivision(u);
      if (userLevel === 4) return matchPincode(u);
      return true;
    });

    // Filter subordinates (under current user's level, excluding current user)
    const rawSubordinates = uniqueUsers.filter(u => {
      const uId = String(u._id || u.id || '');
      if (uId === currentUserId) return false;
      const uLevel = getLevel(u.role);
      if (uLevel <= userLevel && !isGlobalAdmin) return false;

      if (userLevel === 1) return matchState(u);
      if (userLevel === 2) return matchDistrict(u);
      if (userLevel === 3) return matchDivision(u);
      return isGlobalAdmin;
    });

    // Helper to populate manager details
    const populateManager = async (m, relation) => {
      const [state, district, division, pincode] = await Promise.all([
        m.stateId ? db.states.findById(m.stateId) : null,
        m.districtId ? db.districts.findById(m.districtId) : null,
        m.divisionId ? db.divisions.findById(m.divisionId) : null,
        m.pincodeId ? db.pincodes.findById(m.pincodeId) : null
      ]);

      const mId = String(m._id || m.id || '');
      const isSelf = mId === currentUserId;
      const rawRole = String(m.role || '').toLowerCase();
      let normLevel = m.level;
      if (!normLevel || typeof normLevel === 'number') {
        if (normLevel === 1 || rawRole.includes('state')) normLevel = 'state';
        else if (normLevel === 2 || rawRole.includes('district')) normLevel = 'district';
        else if (normLevel === 3 || rawRole.includes('division')) normLevel = 'division';
        else normLevel = 'pincode';
      } else {
        normLevel = String(normLevel).toLowerCase();
      }

      return {
        id: mId,
        name: String(m.name || 'Manager'),
        email: String(m.email || ''),
        mobile: String(m.mobile || m.phone || ''),
        role: String(m.role || 'manager'),
        roleTitle: formatRoleTitle(m.role),
        level: normLevel,
        status: String(m.status || 'active').toLowerCase(),
        relation, // 'peer' or 'subordinate'
        relationLabel: isSelf ? 'You (Current User)' : (relation === 'peer' ? 'Equal Level (Peer)' : 'Under Your Scope (Subordinate)'),
        isSelf,
        stateId: m.stateId || null,
        stateName: state?.name || m.state || null,
        districtId: m.districtId || null,
        districtName: district?.name || m.district || null,
        divisionId: m.divisionId || null,
        divisionName: division?.name || m.division || null,
        pincodeId: m.pincodeId || null,
        pincodeCode: pincode?.code || m.pincodeCode || m.pincode || null,
        pincodeArea: pincode?.areaName || pincode?.name || m.area || null
      };
    };

    const peers = await Promise.all(rawPeers.map(m => populateManager(m, 'peer')));
    const subordinates = await Promise.all(rawSubordinates.map(m => populateManager(m, 'subordinate')));
    const all = [...peers, ...subordinates];

    res.json({
      success: true,
      count: all.length,
      data: subordinates, // Maintains backwards compatibility with subordinate-only checks
      subordinates,
      peers,
      all,
      stats: {
        total: all.length,
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
