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

    let peerRoleFilter = user.role;
    let subordinateRoleFilter = [];
    let peerLocationFilter = {};
    let subordinateLocationFilter = {};

    const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(user.role) || user.email === 'admin@example.com';

    if (isGlobalAdmin) {
      peerLocationFilter = {};
      subordinateRoleFilter = ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'];
      subordinateLocationFilter = {};
    } else if (user.role === 'state_manager') {
      peerLocationFilter = { stateId: user.stateId };
      subordinateRoleFilter = ['district_manager', 'division_manager', 'pincode_manager'];
      subordinateLocationFilter = { stateId: user.stateId };
    } else if (user.role === 'district_manager') {
      peerLocationFilter = { districtId: user.districtId };
      subordinateRoleFilter = ['division_manager', 'pincode_manager'];
      subordinateLocationFilter = { districtId: user.districtId };
    } else if (user.role === 'division_manager') {
      peerLocationFilter = { divisionId: user.divisionId };
      subordinateRoleFilter = ['pincode_manager'];
      subordinateLocationFilter = { divisionId: user.divisionId };
    } else if (user.role === 'pincode_manager') {
      peerLocationFilter = { pincodeId: user.pincodeId };
      subordinateRoleFilter = [];
      subordinateLocationFilter = {};
    }

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
      const uRole = String(u.role || '').toLowerCase();
      if (uRole !== String(peerRoleFilter || '').toLowerCase()) return false;
      if (peerLocationFilter.stateId && String(u.stateId || '') !== String(peerLocationFilter.stateId)) return false;
      if (peerLocationFilter.districtId && String(u.districtId || '') !== String(peerLocationFilter.districtId)) return false;
      if (peerLocationFilter.divisionId && String(u.divisionId || '') !== String(peerLocationFilter.divisionId)) return false;
      if (peerLocationFilter.pincodeId && String(u.pincodeId || '') !== String(peerLocationFilter.pincodeId)) return false;
      return true;
    });

    // Filter subordinates (under, excluding current user)
    const rawSubordinates = subordinateRoleFilter.length > 0 ? uniqueUsers.filter(u => {
      const uId = String(u._id || u.id || '');
      if (uId === currentUserId) return false;
      const uRole = String(u.role || '').toLowerCase();
      if (!subordinateRoleFilter.some(sr => sr.toLowerCase() === uRole)) return false;
      if (subordinateLocationFilter.stateId && String(u.stateId || '') !== String(subordinateLocationFilter.stateId)) return false;
      if (subordinateLocationFilter.districtId && String(u.districtId || '') !== String(subordinateLocationFilter.districtId)) return false;
      if (subordinateLocationFilter.divisionId && String(u.divisionId || '') !== String(subordinateLocationFilter.divisionId)) return false;
      return true;
    }) : [];

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
