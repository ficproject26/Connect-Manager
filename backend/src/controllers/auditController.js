const db = require('../config/db');
const { getScopeFilter } = require('../middleware/scopeMiddleware');

// GET /api/audit-logs - Retrieve audit logs for resources in scope
const getAuditLogs = async (req, res) => {
  try {
    const user = req.user;
    const scopeFilter = getScopeFilter(user);

    // Find all vendors within user's scope to cross-reference logs
    const scopedVendors = await db.vendors.find(scopeFilter);
    const scopedVendorIds = new Set(scopedVendors.map(v => v._id));

    // Get all audit logs
    const allLogs = await db.auditLogs.find();

    // Filter logs for vendors that belong to caller's scope
    const filteredLogs = allLogs
      .filter(log => scopedVendorIds.has(log.recordId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    res.json({
      success: true,
      data: filteredLogs
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs' });
  }
};

module.exports = {
  getAuditLogs
};
