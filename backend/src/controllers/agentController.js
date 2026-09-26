const db = require('../config/db');

// Check if an agent falls within the user's hierarchical scope
const isAgentInScope = (agent, user) => {
  if (!agent || !user) return false;
  const role = (user.role || '').toLowerCase();

  // Central administrators & system administrators have full pan-India scope
  if (['admin', 'super-admin', 'super_admin', 'central_admin'].includes(role) || user.email === 'admin@example.com' || user._id === 'user_admin' || user.id === 'user_admin') {
    return true;
  }

  const norm = (s) => (s || '').toString().trim().toLowerCase();

  const userStateId = norm(user.stateId || user.regionId);
  const userState = norm(user.state || user.stateName || user.assignedState);
  const agentStateId = norm(agent.stateId || agent.regionId);
  const agentState = norm(agent.territory?.state || agent.state || agent.assignedState);

  const matchState = () => {
    if (userStateId && agentStateId && userStateId === agentStateId) return true;
    if (userState && agentState && userState === agentState) return true;
    if (!userStateId && !userState) return true;
    return false;
  };

  const userDistrictId = norm(user.districtId);
  const userDistrict = norm(user.district || user.districtName || user.assignedDistrict);
  const agentDistrictId = norm(agent.districtId);
  const agentDistrict = norm(agent.territory?.district || agent.district || agent.assignedDistrict);

  const matchDistrict = () => {
    if (!matchState()) return false;
    if (userDistrictId && agentDistrictId && userDistrictId === agentDistrictId) return true;
    if (userDistrict && agentDistrict && userDistrict === agentDistrict) return true;
    if (!userDistrictId && !userDistrict) return true;
    return false;
  };

  const userDivisionId = norm(user.divisionId);
  const userDivision = norm(user.division || user.divisionName || user.assignedDivision);
  const agentDivisionId = norm(agent.divisionId);
  const agentDivision = norm(agent.territory?.division || agent.division || agent.assignedDivision);

  const matchDivision = () => {
    if (!matchDistrict()) return false;
    if (userDivisionId && agentDivisionId && userDivisionId === agentDivisionId) return true;
    if (userDivision && agentDivision && userDivision === agentDivision) return true;
    if (!userDivisionId && !userDivision) return true;
    return false;
  };

  const userPincodeId = norm(user.pincodeId);
  const userPincode = norm(user.pincode || user.pincodeCode || user.pincodeId);
  const agentPincodeId = norm(agent.pincodeId);
  const agentPincode = norm(agent.territory?.pincode || agent.pincode || agent.pincodeCode);

  const matchPincode = () => {
    if (!matchDivision()) return false;
    if (userPincodeId && agentPincodeId && userPincodeId === agentPincodeId) return true;
    if (userPincode && agentPincode && userPincode === agentPincode) return true;
    if (!userPincodeId && !userPincode) return true;
    return false;
  };

  switch (role) {
    case 'state_admin':
    case 'state_manager':
      return matchState();
    case 'district_manager':
      return matchDistrict();
    case 'division_manager':
      return matchDivision();
    case 'pincode_manager':
      return matchPincode();
    default:
      return false;
  }
};

const normalizeAgent = (a) => {
  const roleStr = String(a.role || '').toLowerCase();
  let computedLevel = a.level;
  if (!computedLevel) {
    if (roleStr.includes('state')) computedLevel = 1;
    else if (roleStr.includes('district')) computedLevel = 2;
    else if (roleStr.includes('division')) computedLevel = 3;
    else computedLevel = 4;
  }

  const state = a.territory?.state || a.state || a.assignedState || '';
  const district = a.territory?.district || a.district || a.assignedDistrict || '';
  const division = a.territory?.division || a.division || a.assignedDivision || '';
  const pincode = a.territory?.pincode || a.pincode || a.pincodeCode || '';

  let coverage = state;
  if (district) coverage += ` > ${district}`;
  if (division) coverage += ` > ${division}`;
  if (pincode) coverage += ` (${pincode})`;

  return {
    ...a,
    level: computedLevel,
    mobile: a.mobile || a.phone || '',
    phone: a.phone || a.mobile || '',
    pincodeCode: pincode,
    state,
    district,
    division,
    area: a.area || division || district || state || 'Jurisdiction Area',
    jurisdictionCoverage: coverage
  };
};

// GET /api/operations/agents - Get scoped agents under manager jurisdiction
const getAgents = async (req, res) => {
  try {
    const user = req.user;
    const { status, level, search } = req.query;

    const allAgents = await db.agents.find();

    // Deduplicate agents by unique identifiers
    const seen = new Set();
    const unique = [];
    for (const a of allAgents) {
      const key = String(a.registrationId || a._id || a.id || a.email || a.phone || a.mobile);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(normalizeAgent(a));
      }
    }

    let filtered = unique.filter(a => {
      // Scope filtering
      if (!isAgentInScope(a, user)) return false;

      // Status filter
      if (status && status !== 'All') {
        const s = status.toLowerCase();
        const aStatus = String(a.status || 'Active').toLowerCase();
        if (s === 'active' && aStatus !== 'active' && aStatus !== 'approved') return false;
        if (s !== 'active' && aStatus !== s) return false;
      }

      // Level filter
      if (level && level !== 'All') {
        const lvlNum = parseInt(level, 10);
        if (!isNaN(lvlNum) && a.level !== lvlNum) return false;
      }

      // Search filter
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const matchName = (a.name || '').toLowerCase().includes(q);
        const matchEmail = (a.email || '').toLowerCase().includes(q);
        const matchMobile = (a.mobile || a.phone || '').toLowerCase().includes(q);
        const matchReg = (a.registrationId || '').toLowerCase().includes(q);
        const matchPincode = (a.pincodeCode || '').toLowerCase().includes(q);
        const matchDistrict = (a.district || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchMobile && !matchReg && !matchPincode && !matchDistrict) return false;
      }

      return true;
    });

    res.json({
      success: true,
      count: filtered.length,
      agents: filtered,
      data: filtered
    });
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve agents from database' });
  }
};

// GET /api/operations/agents/hierarchy - Get agent hierarchy tree
const getAgentHierarchy = async (req, res) => {
  try {
    const user = req.user;
    const allAgents = await db.agents.find();

    const seen = new Set();
    const unique = [];
    for (const a of allAgents) {
      const key = String(a.registrationId || a._id || a.id || a.email || a.phone || a.mobile);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(normalizeAgent(a));
      }
    }

    const scopedAgents = unique.filter(a => isAgentInScope(a, user));

    res.json({
      success: true,
      hierarchy: scopedAgents
    });
  } catch (err) {
    console.error('Error fetching agent hierarchy:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve agent hierarchy' });
  }
};

// POST /api/operations/agents - Onboard new field agent
const createAgent = async (req, res) => {
  try {
    const user = req.user;
    const { name, mobile, email, role, level, stateId, districtId, divisionId, pincodeId, pincodeCode, area } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'Agent name and mobile are required' });
    }

    const newAgent = await db.agents.insertOne({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim() : `${mobile.trim()}@agent.forgeconnect.in`,
      role: role || 'Pincode Field Agent',
      level: level ? parseInt(level, 10) : 4,
      status: 'Active',
      stateId: stateId || user.stateId || 'state_ka',
      districtId: districtId || user.districtId || null,
      divisionId: divisionId || user.divisionId || null,
      pincodeId: pincodeId || user.pincodeId || null,
      pincodeCode: pincodeCode || user.scope?.pincodeCode || null,
      area: area || user.scope?.pincodeArea || null,
      onboardedVendorsCount: 0,
      totalCommissionEarned: 0,
      kycVerified: true,
      joiningDate: new Date().toISOString(),
      managerId: user.id
    });

    await db.auditLogs.insertOne({
      action: 'Agent Onboarded',
      recordId: newAgent._id,
      recordType: 'agent',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Onboarded agent ${newAgent.name} (${newAgent.role})`,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ success: true, message: 'Agent onboarded successfully', data: newAgent });
  } catch (err) {
    console.error('Error creating agent:', err);
    res.status(500).json({ success: false, message: 'Failed to onboard agent' });
  }
};

module.exports = {
  getAgents,
  getAgentHierarchy,
  createAgent
};
