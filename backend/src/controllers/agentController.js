const db = require('../config/db');
const { publishEntityEvent } = require('../realtime');

// Check if an agent falls within the user's hierarchical scope
const isAgentInScope = (agent, user) => {
  if (!agent || !user) return false;
  const role = (user.role || '').toLowerCase();

  // Central administrators & system administrators have full pan-India scope
  if (['admin', 'super-admin', 'super_admin', 'central_admin'].includes(role) || user.email === 'admin@example.com' || user._id === 'user_admin' || user.id === 'user_admin') {
    return true;
  }

  const norm = (s) => (s || '').toString().trim().toLowerCase();

  const userStateId = norm(user.stateId || user.regionId || user.scope?.stateId);
  const userState = norm(user.state || user.stateName || user.assignedState || user.scope?.stateName);
  const agentStateId = norm(agent.stateId || agent.regionId || agent.territory?.stateId);
  const agentState = norm(agent.territory?.state || agent.state || agent.assignedState);

  const matchState = () => {
    if (userStateId && agentStateId && userStateId === agentStateId) return true;
    if (userState && agentState && userState === agentState) return true;
    if (!userStateId && !userState) return true;
    return false;
  };

  const userDistrictId = norm(user.districtId || user.scope?.districtId);
  const userDistrict = norm(user.district || user.districtName || user.assignedDistrict || user.scope?.districtName);
  const agentDistrictId = norm(agent.districtId || agent.territory?.districtId);
  const agentDistrict = norm(agent.territory?.district || agent.district || agent.assignedDistrict);

  const matchDistrict = () => {
    if (!matchState()) return false;
    if (userDistrictId && agentDistrictId && userDistrictId === agentDistrictId) return true;
    if (userDistrict && agentDistrict && userDistrict === agentDistrict) return true;
    if (!userDistrictId && !userDistrict) return true;
    return false;
  };

  const userDivisionId = norm(user.divisionId || user.scope?.divisionId);
  const userDivision = norm(user.division || user.divisionName || user.assignedDivision || user.scope?.divisionName);
  const agentDivisionId = norm(agent.divisionId || agent.territory?.divisionId);
  const agentDivision = norm(agent.territory?.division || agent.division || agent.assignedDivision);

  const matchDivision = () => {
    if (!matchDistrict()) return false;
    if (userDivisionId && agentDivisionId && userDivisionId === agentDivisionId) return true;
    if (userDivision && agentDivision && userDivision === agentDivision) return true;
    if (!userDivisionId && !userDivision) return true;
    return false;
  };

  const userPincodeId = norm(user.pincodeId || user.scope?.pincodeId);
  const userPincode = norm(user.pincode || user.pincodeCode || user.scope?.pincodeCode || user.pincodeId);
  const agentPincodeId = norm(agent.pincodeId || agent.territory?.pincodeId);
  const agentPincode = norm(agent.territory?.pincode || agent.pincode || agent.pincodeCode);

  // For pincode_manager: match directly by pincode code or ID (no chain through division
  // because division names can differ between agents and managers for the same real area).
  // Fallback: if pincode info missing on either side, fall back to district match.
  const matchPincodeDirect = () => {
    if (userPincodeId && agentPincodeId && userPincodeId === agentPincodeId) return true;
    if (userPincode && agentPincode && userPincode === agentPincode) return true;
    // If agent has no pincode data but is in the same district, include them
    if (!agentPincodeId && !agentPincode) return matchDistrict();
    return false;
  };

  const matchPincode = () => {
    if (!matchState()) return false;
    return matchPincodeDirect();
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
  if (!a) return {};
  const rawRole = (a.role && typeof a.role === 'object') ? (a.role.name || a.role.title || a.role.label || a.role.code || '') : (a.role || '');
  const rawLevel = (a.level && typeof a.level === 'object') ? (a.level.name || a.level.code || a.level.level || '') : a.level;

  const roleStr = String(rawRole).toLowerCase();
  let computedLevel = rawLevel;
  if (!computedLevel || typeof computedLevel === 'number') {
    if (roleStr.includes('state') || computedLevel === 1) computedLevel = 'state';
    else if (roleStr.includes('district') || computedLevel === 2) computedLevel = 'district';
    else if (roleStr.includes('division') || computedLevel === 3) computedLevel = 'division';
    else computedLevel = 'pincode';
  } else {
    computedLevel = String(computedLevel).toLowerCase();
    if (computedLevel === '1') computedLevel = 'state';
    else if (computedLevel === '2') computedLevel = 'district';
    else if (computedLevel === '3') computedLevel = 'division';
    else if (computedLevel === '4') computedLevel = 'pincode';
  }

  const rawState = a.territory?.state || a.state || a.assignedState;
  const rawDistrict = a.territory?.district || a.district || a.assignedDistrict;
  const rawDivision = a.territory?.division || a.division || a.assignedDivision;
  const rawPincode = a.territory?.pincode || a.pincode || a.pincodeCode;

  const state = (rawState && typeof rawState === 'object') ? String(rawState.name || rawState.stateName || '') : String(rawState || '');
  const district = (rawDistrict && typeof rawDistrict === 'object') ? String(rawDistrict.name || rawDistrict.districtName || '') : String(rawDistrict || '');
  const division = (rawDivision && typeof rawDivision === 'object') ? String(rawDivision.name || rawDivision.divisionName || '') : String(rawDivision || '');
  const pincode = (rawPincode && typeof rawPincode === 'object') ? String(rawPincode.code || rawPincode.pincode || rawPincode.name || '') : String(rawPincode || '');

  let coverage = state;
  if (district) coverage += ` > ${district}`;
  if (division) coverage += ` > ${division}`;
  if (pincode) coverage += ` (${pincode})`;

  return {
    ...a,
    level: computedLevel,
    roleLevel: computedLevel,
    role: typeof a.role === 'string' ? a.role : `${computedLevel}_agent`,
    mobile: String(a.mobile || a.phone || ''),
    phone: String(a.phone || a.mobile || ''),
    pincode,
    pincodeCode: pincode,
    pincodeId: a.pincodeId || a.territory?.pincodeId || null,
    divisionId: a.divisionId || a.territory?.divisionId || null,
    districtId: a.districtId || a.territory?.districtId || null,
    stateId: a.stateId || a.territory?.stateId || null,
    state,
    district,
    division,
    area: String(a.area || division || district || state || 'Jurisdiction Area'),
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
        const lvlStr = String(level).toLowerCase();
        const aLvlStr = String(a.level || '').toLowerCase();
        if (lvlStr === 'state' || lvlStr === '1') {
          if (!aLvlStr.includes('state') && aLvlStr !== '1') return false;
        } else if (lvlStr === 'district' || lvlStr === '2') {
          if (!aLvlStr.includes('district') && aLvlStr !== '2') return false;
        } else if (lvlStr === 'division' || lvlStr === '3') {
          if (!aLvlStr.includes('division') && aLvlStr !== '3') return false;
        } else if (lvlStr === 'pincode' || lvlStr === '4') {
          if (!aLvlStr.includes('pincode') && aLvlStr !== '4') return false;
        } else if (aLvlStr !== lvlStr) {
          return false;
        }
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

    // Broadcast real-time ecosystem event
    publishEntityEvent({
      entity: 'agent',
      action: 'created',
      entityId: newAgent._id,
      data: newAgent,
      scope: {
        stateId: newAgent.stateId,
        districtId: newAgent.districtId,
        divisionId: newAgent.divisionId,
        pincodeId: newAgent.pincodeId
      }
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
