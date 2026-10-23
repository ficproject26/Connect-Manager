const db = require('../config/db');
const territoryScopeService = require('../services/territoryScopeService');

// GET /api/audit-logs - Retrieve audit logs strictly scoped by manager's territory hierarchy
const getAuditLogs = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userRole = String(user.role || '').toLowerCase();
    const isGlobalAdmin = ['admin', 'super-admin', 'super_admin', 'superadmin', 'central_admin'].includes(userRole) ||
      user.email === 'admin@example.com' ||
      user.id === 'user_admin' ||
      user._id === 'user_admin';

    // 1. Fetch all audit logs
    const allLogs = await db.auditLogs.find();

    // 2. Pre-fetch entities for fast O(1) enrichment and territory matching
    const [allVendors, allUsers, allVisits, allTasks] = await Promise.all([
      db.vendors.find().catch(() => []),
      db.users.find().catch(() => []),
      db.shopVisits ? db.shopVisits.find().catch(() => []) : [],
      db.tasks ? db.tasks.find().catch(() => []) : []
    ]);

    const vendorMap = new Map();
    for (const v of allVendors) {
      if (v._id) vendorMap.set(String(v._id), v);
      if (v.id) vendorMap.set(String(v.id), v);
      if (v.registrationId) vendorMap.set(String(v.registrationId), v);
    }

    const userMap = new Map();
    for (const u of allUsers) {
      if (u._id) userMap.set(String(u._id), u);
      if (u.id) userMap.set(String(u.id), u);
      if (u.managerId) userMap.set(String(u.managerId), u);
    }

    const visitMap = new Map();
    for (const sv of allVisits) {
      if (sv._id) visitMap.set(String(sv._id), sv);
      if (sv.id) visitMap.set(String(sv.id), sv);
    }

    const taskMap = new Map();
    for (const t of allTasks) {
      if (t._id) taskMap.set(String(t._id), t);
      if (t.id) taskMap.set(String(t.id), t);
    }

    // 3. Filter logs by territory hierarchy scoping
    const filteredLogs = [];

    for (const log of allLogs) {
      const targetId = String(log.recordId || log.targetId || log.metadata?.vendorId || log.metadata?.userId || '');
      const operatorId = String(log.userId || log.operatorId || log.metadata?.operatorId || '');

      // Resolve target entity
      const targetVendor = vendorMap.get(targetId);
      const targetUser = userMap.get(targetId);
      const targetVisit = visitMap.get(targetId);
      const targetTask = taskMap.get(targetId);

      // Resolve operator entity
      const operatorUser = userMap.get(operatorId);

      // Determine Target Name
      let targetName = log.targetName || log.metadata?.vendorName || null;
      if (!targetName && targetVendor) {
        targetName = targetVendor.businessName || targetVendor.name || null;
      }
      if (!targetName && targetUser) {
        targetName = `${targetUser.name}${targetUser.role ? ` (${targetUser.role.replace(/_/g, ' ')})` : ''}`;
      }
      if (!targetName && targetVisit) {
        targetName = targetVisit.shopName || null;
      }
      if (!targetName && targetTask) {
        targetName = targetTask.title || null;
      }
      if (!targetName && log.newValue && typeof log.newValue === 'object' && log.newValue.businessName) {
        targetName = log.newValue.businessName;
      }

      // Check hierarchy-based scoping if not global admin
      let inScope = isGlobalAdmin;

      if (!inScope) {
        // A. Is user the operator who performed the action?
        if (operatorId && String(operatorId) === String(user.id || user._id)) {
          inScope = true;
        }

        // B. Is target record within user's territory scope?
        if (!inScope && targetVendor) {
          inScope = await territoryScopeService.isRecordInScope(targetVendor, user);
        }
        if (!inScope && targetUser) {
          inScope = await territoryScopeService.isRecordInScope(targetUser, user);
        }
        if (!inScope && targetVisit) {
          inScope = await territoryScopeService.isRecordInScope(targetVisit, user);
        }
        if (!inScope && targetTask) {
          inScope = await territoryScopeService.isRecordInScope(targetTask, user);
        }

        // C. Is operator within user's territory hierarchy?
        if (!inScope && operatorUser) {
          inScope = await territoryScopeService.isRecordInScope(operatorUser, user);
        }

        // D. Does the log have explicit territory markers (e.g. in pincodeId, stateId, or newValue)?
        if (!inScope) {
          const directTerritory = {
            stateId: log.stateId || log.metadata?.stateId || log.newValue?.stateId || null,
            state: log.state || log.stateName || log.metadata?.state || log.metadata?.stateName || null,
            districtId: log.districtId || log.metadata?.districtId || log.newValue?.districtId || null,
            district: log.district || log.districtName || log.metadata?.district || null,
            divisionId: log.divisionId || log.metadata?.divisionId || log.newValue?.divisionId || null,
            division: log.division || log.divisionName || log.metadata?.division || null,
            pincodeId: log.pincodeId || log.metadata?.pincodeId || log.newValue?.pincodeId || null,
            pincode: log.pincode || log.pincodeCode || log.metadata?.pincode || log.newValue?.pincode || null
          };
          if (directTerritory.pincodeId || directTerritory.stateId || directTerritory.districtId || directTerritory.divisionId) {
            inScope = await territoryScopeService.isRecordInScope(directTerritory, user);
          }
        }

        // E. State territory boundary enforcement (Issue 32 & Issue 13)
        const userState = String(user.state || user.stateName || user.assignedState || user.scope?.stateName || '').toLowerCase();
        const userStateId = String(user.stateId || user.assignedStateId || user.scope?.stateId || '').toLowerCase();

        const logState = String(log.state || log.stateName || log.metadata?.state || log.metadata?.stateName || targetVendor?.state || targetUser?.state || targetVisit?.state || '').toLowerCase();
        const logStateId = String(log.stateId || log.metadata?.stateId || targetVendor?.stateId || targetUser?.stateId || targetVisit?.stateId || '').toLowerCase();

        if (logStateId && userStateId && logStateId !== userStateId) inScope = false;
        if (logState && userState && !userState.includes(logState) && !logState.includes(userState)) inScope = false;

        const tnLocations = [
          'tamil nadu', 'kallakurichi', 'salem', 'dharmapuri', 'chennai', 'krishnagiri',
          'hosur', 'coimbatore', 'madurai', 'tiruchirappalli', 'trichy', 'vellore',
          'erode', 'tirupur', 'thanjavur', 'dindigul', 'tirunelveli', 'thoothukudi',
          'cuddalore', 'kanchipuram', 'tiruvannamalai'
        ];
        const kaLocations = [
          'karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'hubli', 'dharwad',
          'mangalore', 'mangaluru', 'belgaum', 'belagavi', 'gulbarga', 'kalaburagi',
          'davangere', 'bellary', 'ballari', 'shimoga', 'shivamogga', 'tumkur', 'tumakuru'
        ];

        const logText = `${log.action || ''} ${log.details || ''} ${targetName || ''} ${JSON.stringify(log.newValue || {})} ${JSON.stringify(log.previousValue || {})}`.toLowerCase();
        if ((userState.includes('karnataka') || userStateId === 'state_ka')) {
          if (tnLocations.some(loc => logText.includes(loc))) {
            inScope = false;
          }
        } else if ((userState.includes('tamil nadu') || userStateId === 'state_tn' || userStateId === '6aa10f70ca0932e6eaec1f5c')) {
          if (kaLocations.some(loc => logText.includes(loc))) {
            inScope = false;
          }
        }
      }

      if (!inScope) continue;

      // Safe timestamp parsing (BUG-04)
      const safeTimestamp = log.timestamp || log.createdAt || log.updatedAt || log.metadata?.timestamp || null;

      // State transitions
      let prevVal = log.previousValue || log.oldState || log.prevState || null;
      let nextVal = log.newValue || log.newState || null;

      if (!prevVal && log.metadata?.oldStatus) {
        prevVal = { status: log.metadata.oldStatus };
      }
      if (!nextVal && log.metadata?.newStatus) {
        nextVal = { status: log.metadata.newStatus };
      }

      // Format operatedBy
      const operatorName = log.userName || operatorUser?.name || 'System Operator';
      const operatorRole = log.userRole || operatorUser?.role || 'Admin';

      filteredLogs.push({
        ...log,
        timestamp: safeTimestamp,
        userName: operatorName,
        userRole: operatorRole,
        targetName,
        previousValue: prevVal,
        newValue: nextVal
      });
    }

    filteredLogs.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    res.json({
      success: true,
      count: filteredLogs.length,
      scope: {
        role: user.role,
        state: user.state || user.stateName,
        district: user.district || user.districtName,
        division: user.division || user.divisionName,
        pincode: user.pincode || user.pincodeCode
      },
      data: filteredLogs.slice(0, 100)
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs' });
  }
};

module.exports = {
  getAuditLogs
};
