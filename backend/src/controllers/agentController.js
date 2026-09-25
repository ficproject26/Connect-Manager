const db = require('../config/db');

// GET /api/operations/agents - Get scoped agents under manager jurisdiction
const getAgents = async (req, res) => {
  try {
    const user = req.user;
    const { status, level, search } = req.query;

    const allAgents = await db.agents.find();

    let filtered = allAgents.filter(a => {
      // Scope filtering
      if (user.role === 'state_manager' && user.stateId && a.stateId && a.stateId !== user.stateId) return false;
      if (user.role === 'district_manager' && user.districtId && a.districtId && a.districtId !== user.districtId) return false;
      if (user.role === 'division_manager' && user.divisionId && a.divisionId && a.divisionId !== user.divisionId) return false;
      if (user.role === 'pincode_manager' && user.pincodeId && a.pincodeId && a.pincodeId !== user.pincodeId) return false;

      // Status filter
      if (status && status !== 'All' && a.status !== status) return false;

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
        const matchMobile = (a.mobile || '').toLowerCase().includes(q);
        const matchPincode = (a.pincodeCode || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchMobile && !matchPincode) return false;
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

    const scopedAgents = allAgents.filter(a => {
      if (user.role === 'state_manager' && user.stateId && a.stateId && a.stateId !== user.stateId) return false;
      if (user.role === 'district_manager' && user.districtId && a.districtId && a.districtId !== user.districtId) return false;
      if (user.role === 'division_manager' && user.divisionId && a.divisionId && a.divisionId !== user.divisionId) return false;
      if (user.role === 'pincode_manager' && user.pincodeId && a.pincodeId && a.pincodeId !== user.pincodeId) return false;
      return true;
    });

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
