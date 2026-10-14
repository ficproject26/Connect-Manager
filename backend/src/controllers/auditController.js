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

    // Build map for fast vendor target lookup
    const vendorMap = new Map();
    for (const v of scopedVendors) {
      if (v._id) vendorMap.set(String(v._id), v);
      if (v.id) vendorMap.set(String(v.id), v);
      if (v.registrationId) vendorMap.set(String(v.registrationId), v);
    }

    // Filter logs for vendors that belong to caller's scope and enrich with target name
    const filteredLogs = allLogs
      .filter(log => {
        const rId = String(log.recordId || log.targetId || log.metadata?.vendorId || '');
        return scopedVendorIds.has(log.recordId) || vendorMap.has(rId);
      })
      .map(log => {
        const rId = String(log.recordId || log.targetId || log.metadata?.vendorId || '');
        const targetVendor = vendorMap.get(rId);
        const targetName = targetVendor?.businessName || targetVendor?.name || log.metadata?.vendorName || log.targetName || null;
        const safeTimestamp = log.timestamp || log.createdAt || log.updatedAt || log.metadata?.timestamp || null;

        // Enrich state transitions from metadata if top-level fields are absent
        let prevVal = log.previousValue || log.oldState || log.prevState || null;
        let nextVal = log.newValue || log.newState || null;

        if (!prevVal && log.metadata?.oldStatus) {
          prevVal = { status: log.metadata.oldStatus };
        }
        if (!nextVal && log.metadata?.newStatus) {
          nextVal = { status: log.metadata.newStatus };
        }

        return {
          ...log,
          timestamp: safeTimestamp,
          targetName,
          previousValue: prevVal,
          newValue: nextVal
        };
      })
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      })
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
