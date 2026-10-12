const db = require('../config/db');
const { getManagerTerritoryProfile, isTaskInManagerTerritory } = require('./taskController');

// Helper to normalize issue/ticket status
const normalizeStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  if (['resolved', 'closed', 'completed'].includes(s)) return 'Resolved';
  if (['escalated', 'urgent'].includes(s)) return 'Escalated';
  if (['in progress', 'in_progress', 'progress'].includes(s)) return 'In Progress';
  return 'Open';
};

const normalizePriority = (priority) => {
  const p = String(priority || '').trim().toLowerCase();
  if (['urgent', 'critical'].includes(p)) return 'Urgent';
  if (['high'].includes(p)) return 'High';
  if (['medium', 'med'].includes(p)) return 'Medium';
  return 'Low';
};

// GET /api/issues
const getIssues = async (req, res) => {
  try {
    const user = req.user;
    const taskProfile = await getManagerTerritoryProfile(user);

    // Fetch all tickets from db.tickets
    const rawTickets = (db.tickets && db.tickets.cache && db.tickets.cache.length > 0)
      ? db.tickets.cache
      : (db.tickets ? await db.tickets.find({}) : []);

    // Enrich tickets with creator / agent territory if missing
    const agentsList = (db.agents && db.agents.cache && db.agents.cache.length > 0)
      ? db.agents.cache
      : (db.agents ? await db.agents.find({}) : []);
    const agentMap = new Map(agentsList.map(a => [String(a._id || a.id), a]));

    const enrichedTickets = rawTickets.map(t => {
      const creatorId = String(t.creator || t.creatorId || t.agentId || '');
      const matchedAgent = agentMap.get(creatorId);

      const state = t.state || matchedAgent?.territory?.state || null;
      const district = t.district || matchedAgent?.territory?.district || null;
      const division = t.division || matchedAgent?.territory?.division || null;
      const pincode = t.pincode || matchedAgent?.territory?.pincode || null;

      return {
        _id: t._id || t.id,
        id: t._id || t.id,
        ticketId: t.ticketId || `TKT-${String(t._id || t.id).slice(-8).toUpperCase()}`,
        title: t.title || t.category || 'Territory Support Issue',
        description: t.description || 'No description provided.',
        category: t.category || 'General Issue',
        creator: t.creator,
        creatorName: t.creatorName || matchedAgent?.name || 'Field Agent',
        creatorRole: t.creatorRole || matchedAgent?.role || 'agent',
        priority: normalizePriority(t.priority),
        status: normalizeStatus(t.status),
        state,
        district,
        division,
        pincode,
        stateId: t.stateId || null,
        districtId: t.districtId || null,
        divisionId: t.divisionId || null,
        pincodeId: t.pincodeId || null,
        resolutionNotes: t.resolutionNotes || null,
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || new Date().toISOString()
      };
    });

    // Strictly filter by manager's assigned territory
    const scopedTickets = enrichedTickets.filter(t => isTaskInManagerTerritory(t, taskProfile));

    // Status filter
    const statusQuery = (req.query.status || '').trim();
    const priorityQuery = (req.query.priority || '').trim();
    const searchQuery = (req.query.search || '').trim().toLowerCase();

    let filtered = scopedTickets;

    if (statusQuery && statusQuery.toLowerCase() !== 'all') {
      const targetNorm = normalizeStatus(statusQuery);
      filtered = filtered.filter(t => t.status === targetNorm);
    }

    if (priorityQuery && priorityQuery.toLowerCase() !== 'all') {
      const targetPriority = normalizePriority(priorityQuery);
      filtered = filtered.filter(t => t.priority === targetPriority);
    }

    if (searchQuery) {
      filtered = filtered.filter(t => 
        (t.ticketId && t.ticketId.toLowerCase().includes(searchQuery)) ||
        (t.title && t.title.toLowerCase().includes(searchQuery)) ||
        (t.description && t.description.toLowerCase().includes(searchQuery)) ||
        (t.category && t.category.toLowerCase().includes(searchQuery)) ||
        (t.creatorName && t.creatorName.toLowerCase().includes(searchQuery)) ||
        (t.district && t.district.toLowerCase().includes(searchQuery)) ||
        (t.pincode && String(t.pincode).includes(searchQuery))
      );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const counts = {
      total: scopedTickets.length,
      open: scopedTickets.filter(t => t.status === 'Open').length,
      inProgress: scopedTickets.filter(t => t.status === 'In Progress').length,
      escalated: scopedTickets.filter(t => t.status === 'Escalated').length,
      resolved: scopedTickets.filter(t => t.status === 'Resolved').length
    };

    return res.json({
      success: true,
      data: filtered,
      counts
    });
  } catch (err) {
    console.error('getIssues error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve territory issues' });
  }
};

// GET /api/issues/:id
const getIssueById = async (req, res) => {
  try {
    const user = req.user;
    const taskProfile = await getManagerTerritoryProfile(user);
    const issueId = req.params.id;

    const ticket = await db.tickets.findById(issueId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    if (!isTaskInManagerTerritory(ticket, taskProfile)) {
      return res.status(403).json({ success: false, message: 'Access denied: Issue outside assigned territory' });
    }

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('getIssueById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve issue details' });
  }
};

// PATCH /api/issues/:id/status
const updateIssueStatus = async (req, res) => {
  try {
    const user = req.user;
    const taskProfile = await getManagerTerritoryProfile(user);
    const issueId = req.params.id;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const ticket = await db.tickets.findById(issueId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    if (!isTaskInManagerTerritory(ticket, taskProfile)) {
      return res.status(403).json({ success: false, message: 'Access denied: Issue outside assigned territory' });
    }

    const validStatuses = ['Open', 'In Progress', 'Escalated', 'Resolved'];
    const normStatus = normalizeStatus(status);
    if (!validStatuses.includes(normStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updatePayload = {
      status: normStatus,
      resolutionNotes: notes || ticket.resolutionNotes || '',
      updatedAt: new Date().toISOString()
    };

    const updated = await db.tickets.findByIdAndUpdate(issueId, updatePayload);

    return res.json({
      success: true,
      message: `Issue status updated to ${normStatus}`,
      data: updated
    });
  } catch (err) {
    console.error('updateIssueStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update issue status' });
  }
};

module.exports = {
  getIssues,
  getIssueById,
  updateIssueStatus
};
