const db = require('../config/db');

// GET /api/managers - Retrieve managers directory (equal level peers and subordinate managers)
const getLowerLevelManagers = async (req, res) => {
  try {
    const user = req.user;
    const allUsers = await db.users.find();

    let peerRoleFilter = user.role;
    let subordinateRoleFilter = [];
    let peerLocationFilter = {};
    let subordinateLocationFilter = {};

    if (user.role === 'state_manager') {
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
      switch (role) {
        case 'state_manager': return 'State Agent Manager (Level 1)';
        case 'district_manager': return 'District Agent Manager (Level 2)';
        case 'division_manager': return 'Division Agent Manager (Level 3)';
        case 'pincode_manager': return 'Pincode Agent Manager (Level 4)';
        default: return role;
      }
    };

    const currentUserId = user.id || user._id;

    // Filter peers (equal level, excluding current user)
    const rawPeers = allUsers.filter(u => {
      if (u._id === currentUserId) return false;
      if (u.role !== peerRoleFilter) return false;
      if (peerLocationFilter.stateId && u.stateId !== peerLocationFilter.stateId) return false;
      if (peerLocationFilter.districtId && u.districtId !== peerLocationFilter.districtId) return false;
      if (peerLocationFilter.divisionId && u.divisionId !== peerLocationFilter.divisionId) return false;
      if (peerLocationFilter.pincodeId && u.pincodeId !== peerLocationFilter.pincodeId) return false;
      return true;
    });

    // Filter subordinates (under, excluding current user)
    const rawSubordinates = subordinateRoleFilter.length > 0 ? allUsers.filter(u => {
      if (u._id === currentUserId) return false;
      if (!subordinateRoleFilter.includes(u.role)) return false;
      if (subordinateLocationFilter.stateId && u.stateId !== subordinateLocationFilter.stateId) return false;
      if (subordinateLocationFilter.districtId && u.districtId !== subordinateLocationFilter.districtId) return false;
      if (subordinateLocationFilter.divisionId && u.divisionId !== subordinateLocationFilter.divisionId) return false;
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

      const isSelf = m._id === user.id || m._id === user._id;

      return {
        id: m._id,
        name: m.name,
        email: m.email,
        mobile: m.mobile,
        role: m.role,
        roleTitle: formatRoleTitle(m.role),
        level: m.level,
        status: m.status || 'active',
        relation, // 'peer' or 'subordinate'
        relationLabel: isSelf ? 'You (Current User)' : (relation === 'peer' ? 'Equal Level (Peer)' : 'Under Your Scope (Subordinate)'),
        isSelf,
        stateId: m.stateId,
        stateName: state?.name || null,
        districtId: m.districtId,
        districtName: district?.name || null,
        divisionId: m.divisionId,
        divisionName: division?.name || null,
        pincodeId: m.pincodeId,
        pincodeCode: pincode?.code || null,
        pincodeArea: pincode?.areaName || null
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
