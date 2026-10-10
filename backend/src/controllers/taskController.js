const db = require('../config/db');
const { broadcastNotification } = require('../routes/notificationRoutes');
const { publishEntityEvent, cacheManager } = require('../realtime');

const normalize = (s) => (s || '').toString().trim().toLowerCase();

/**
 * Resolves the authenticated manager's territory profile and hierarchical level.
 * Source of truth: Authenticated manager JWT identity + database record.
 */
const getManagerTerritoryProfile = async (user) => {
  const profileKey = `territory:profile:${user?.id || user?._id || 'mgr'}`;
  const cachedProfile = await cacheManager.get(profileKey);
  if (cachedProfile) {
    return cachedProfile;
  }

  const role = normalize(user.role);
  const levelNum = Number(user.level);
  const levelStr = normalize(user.level);

  let level = 'other';
  if (['admin', 'super_admin', 'super-admin', 'system_admin'].includes(role) || user.email === 'admin@example.com') {
    level = 'admin';
  } else if (role === 'pincode_manager' || role === 'pincode_agent' || role.includes('pincode') || levelNum === 4 || levelStr === 'pincode') {
    level = 'pincode';
  } else if (role === 'division_manager' || role.includes('division') || levelNum === 3 || levelStr === 'division') {
    level = 'division';
  } else if (role === 'district_manager' || role.includes('district') || levelNum === 2 || levelStr === 'district') {
    level = 'district';
  } else if (role === 'state_manager' || role.includes('state') || levelNum === 1 || levelStr === 'state') {
    level = 'state';
  }

  let stateId = user.stateId;
  let state = user.state || user.stateName || user.assignedState || '';
  let districtId = user.districtId;
  let district = user.district || user.districtName || user.assignedDistrict || '';
  let divisionId = user.divisionId;
  let division = user.division || user.divisionName || user.assignedDivision || '';
  let pincodeId = user.pincodeId;
  let pincode = user.pincode || user.pincodeCode || user.assignedPincode || '';

  // If any territory fields are missing from user, enrich from managers collection
  if (!state || !district || (level === 'division' && !division) || (level === 'pincode' && !pincode)) {
    const mgrDoc = await db.managers.findOne({
      $or: [
        { id: user.id },
        { _id: user.id },
        { email: user.email },
        { managerId: user.managerId }
      ]
    }).catch(() => null);

    if (mgrDoc) {
      stateId = stateId || mgrDoc.stateId;
      state = state || mgrDoc.state || mgrDoc.assignedState || '';
      districtId = districtId || mgrDoc.districtId || mgrDoc.assignedDistrictId;
      district = district || mgrDoc.district || mgrDoc.assignedDistrict || '';
      divisionId = divisionId || mgrDoc.divisionId || mgrDoc.assignedDivisionId;
      division = division || mgrDoc.division || mgrDoc.assignedDivision || '';
      pincodeId = pincodeId || mgrDoc.pincodeId || mgrDoc.assignedPincodeId;
      pincode = pincode || mgrDoc.pincode || mgrDoc.pincodeCode || mgrDoc.assignedPincode || '';
    }
  }

  const profile = {
    managerId: user.managerId || user.id || user._id,
    level,
    stateId: normalize(stateId),
    state: normalize(state),
    districtId: normalize(districtId),
    district: normalize(district),
    divisionId: normalize(divisionId),
    division: normalize(division),
    pincodeId: normalize(pincodeId),
    pincode: normalize(pincode)
  };
  await cacheManager.set(profileKey, profile, 600);
  return profile;
};

/**
 * Validates whether a specific task falls strictly within the manager's authorized territory.
 * Strict Hierarchical Access:
 * - State Manager: All tasks inside assigned State (all districts, divisions, pincodes).
 * - District Manager: ONLY tasks inside assigned District (all divisions, pincodes inside that district).
 * - Division Manager: ONLY tasks inside assigned Division (all pincodes inside that division).
 * - Pincode Manager: ONLY tasks assigned to/created for assigned Pincode.
 */
const isTaskInManagerTerritory = (task, profile) => {
  if (!task || !profile) return false;

  // Pan-India access for system administrators
  if (profile.level === 'admin') return true;

  // Operational managers must NOT see mock or benchmark dummy tasks
  const tId = normalize(task.id || task._id || task.taskNumber);
  const tTitle = normalize(task.title);
  const tDesc = normalize(task.description);
  const tVendor = normalize(task.vendor || task.merchantName || task.shopName);
  const isMockTask = 
    tId.startsWith('bench_task_') ||
    tTitle.includes('benchmark task') ||
    tTitle.includes('centralized realtime sync test task') ||
    tVendor.includes('realtime test store') ||
    tDesc.includes('centralized realtime sync test task');
  if (isMockTask) return false;

  const tStateId = normalize(task.stateId);
  const tState = normalize(task.state || task.stateName);
  const tDistId = normalize(task.districtId);
  const tDist = normalize(task.district || task.districtName);
  const tDivId = normalize(task.divisionId);
  const tDiv = normalize(task.division || task.divisionName);
  const tPinId = normalize(task.pincodeId);
  const tPin = normalize(task.pincode || task.pincodeCode);
  const tLoc = normalize(task.location);

  // State check: must match stateId, state name, or location string
  const matchState = () => {
    if (profile.stateId && tStateId && profile.stateId === tStateId) return true;
    if (profile.state && tState && profile.state === tState) return true;
    if (profile.state && tLoc && tLoc.includes(profile.state)) return true;
    return false;
  };

  // District check: must match state AND district
  const matchDistrict = () => {
    if (!matchState()) return false;
    if (profile.districtId && tDistId && profile.districtId === tDistId) return true;
    if (profile.district && tDist && profile.district === tDist) return true;
    if (profile.district && tLoc && tLoc.includes(profile.district)) return true;
    return false;
  };

  // Division check: must match state AND district AND division
  const matchDivision = () => {
    if (!matchDistrict()) return false;
    if (profile.divisionId && tDivId && profile.divisionId === tDivId) return true;
    if (profile.division && tDiv && profile.division === tDiv) return true;
    return false;
  };

  // Pincode check: most restrictive, must match state, district, division (if specified) AND pincode
  const matchPincode = () => {
    if ((tState || tStateId) && !matchState()) return false;
    if ((tDist || tDistId) && !matchDistrict()) return false;
    if ((tDiv || tDivId) && !matchDivision()) return false;

    if (profile.pincodeId && tPinId && profile.pincodeId === tPinId) return true;
    if (profile.pincode && tPin && profile.pincode === tPin) return true;
    if (profile.pincode && tLoc && tLoc.includes(profile.pincode)) return true;
    return false;
  };

  switch (profile.level) {
    case 'state':
      return matchState();
    case 'district':
      return matchDistrict();
    case 'division':
      return matchDivision();
    case 'pincode':
      return matchPincode();
    default:
      return false;
  }
};

// GET /api/qc-tasks/tasks - Get scoped operational & QC tasks strictly by territory
const getTasks = async (req, res) => {
  try {
    const user = req.user;
    const cacheKey = `tasks:list:${user?.id || user?._id || 'mgr'}:${JSON.stringify(req.query)}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const { status, category, priority, search, state, district, division, pincode, agentId, agentRole } = req.query;

    // Resolve authenticated manager's territory profile (source of truth)
    const territoryProfile = await getManagerTerritoryProfile(user);

    // Fetch tasks from database
    const allTasks = await db.tasks.find();

    // 1. Mandatory Strict Territory Enforcement
    let filtered = allTasks.filter(t => isTaskInManagerTerritory(t, territoryProfile));

    // 2. Query-level user UI filters (can only narrow down within authorized territory)
    if (status && status !== 'All') {
      filtered = filtered.filter(t => t.status === status);
    }
    if (category && category !== 'All') {
      filtered = filtered.filter(t => t.category === category);
    }
    if (priority && priority !== 'All') {
      filtered = filtered.filter(t => t.priority === priority);
    }
    if (state && state.trim()) {
      filtered = filtered.filter(t => (t.state || '').toLowerCase().includes(state.trim().toLowerCase()));
    }
    if (district && district.trim()) {
      filtered = filtered.filter(t => (t.district || '').toLowerCase().includes(district.trim().toLowerCase()));
    }
    if (division && division.trim()) {
      filtered = filtered.filter(t => (t.division || '').toLowerCase().includes(division.trim().toLowerCase()));
    }
    if (pincode && String(pincode).trim()) {
      filtered = filtered.filter(t => String(t.pincode || '').includes(String(pincode).trim()));
    }
    if (agentId && agentId.trim()) {
      filtered = filtered.filter(t => t.assignedAgentId === agentId || t.assignedManagerId === agentId);
    }
    if (agentRole && agentRole.trim()) {
      filtered = filtered.filter(t => t.assignedManagerRole === agentRole || t.assignedAgentRole === agentRole);
    }

    // Search filter
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t => {
        const matchTitle = (t.taskNumber || '').toLowerCase().includes(q) || (t.title || '').toLowerCase().includes(q);
        const matchVendor = (t.vendor || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchLoc = (t.location || '').toLowerCase().includes(q);
        const matchAssignee = (t.assignedManagerName || t.assignedAgentName || t.assignedTo || '').toLowerCase().includes(q);
        const matchPin = String(t.pincode || '').includes(q);
        return matchTitle || matchVendor || matchDesc || matchLoc || matchAssignee || matchPin;
      });
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const enriched = filtered.map(t => {
      const assignmentStatus = t.assignmentStatus || (['Assigned', 'Accepted', 'In Progress', 'Completed', 'Closed'].includes(t.status) ? 'ACCEPTED' : (t.status === 'Rejected' ? 'REJECTED' : t.status === 'Cancelled' ? 'CANCELLED' : 'ACCEPTED'));
      const executionStatus = t.executionStatus || (['Completed', 'Closed', 'Resolved'].includes(t.status) ? 'COMPLETED' : t.status === 'In Progress' ? 'IN_PROGRESS' : 'NOT_STARTED');
      return {
        ...t,
        assignmentStatus,
        executionStatus
      };
    });

    const payload = {
      success: true,
      count: enriched.length,
      data: enriched,
      tasks: enriched
    };
    await cacheManager.set(cacheKey, payload, 30);
    res.json(payload);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve tasks from database' });
  }
};

// POST /api/qc-tasks/tasks - Create an operational or QC task
const createTask = async (req, res) => {
  try {
    const user = req.user;
    const {
      vendor,
      vendorId,
      category,
      priority,
      dueDate,
      description,
      remarks,
      pincode,
      pincodeId,
      divisionId,
      districtId,
      stateId,
      location,
      assignedTo,
      assignedManagerRole
    } = req.body;

    const count = await db.tasks.count();
    const taskNumber = `TSK-${100000 + count + 1}`;

    // Verify territory scope: Task destination must fall within creating manager's jurisdiction
    const territoryProfile = await getManagerTerritoryProfile(user);
    const targetTaskScope = {
      stateId: stateId || user.stateId,
      state: req.body.state || user.state,
      districtId: districtId || user.districtId,
      district: req.body.district || user.district,
      divisionId: divisionId || user.divisionId,
      division: req.body.division || user.division,
      pincodeId: pincodeId || user.pincodeId,
      pincode: pincode || user.pincode
    };

    if (!isTaskInManagerTerritory(targetTaskScope, territoryProfile)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot create tasks outside your assigned territory.'
      });
    }

    const newTask = await db.tasks.insertOne({
      taskNumber,
      vendor: vendor || 'Field Operational Task',
      vendorId: vendorId || null,
      category: category || 'Physical QC Audit',
      priority: priority || 'Medium',
      dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString(),
      status: 'Assigned',
      assignmentStatus: 'ACCEPTED',
      executionStatus: 'NOT_STARTED',
      progress: 0,
      assignedManagerId: req.body.assignedManagerId || user.id,
      assignedManagerName: assignedTo || req.body.assignedManagerName || user.name,
      assignedManagerLevel: req.body.assignedManagerLevel || user.level || user.role,
      assignedManagerRole: assignedManagerRole || user.role,
      assignedTerritory: req.body.assignedTerritory || user.territory || null,
      assignedAgentId: req.body.assignedAgentId || null,
      assignedAgentName: req.body.assignedAgentName || null,
      assignedAgentRole: req.body.assignedAgentRole || null,
      createdByAdminName: user.name,
      createdByAdminRole: user.role,
      description: description || 'Field operational deliverable and compliance task.',
      remarks: remarks || '',
      location: location || (user.district ? `${user.district}, ${user.state || 'Tamil Nadu'}` : 'Tamil Nadu'),
      state: req.body.state || user.state || user.assignedState || 'Tamil Nadu',
      district: req.body.district || user.district || '',
      division: req.body.division || user.division || '',
      pincode: pincode || user.pincode || user.pincodeCode || null,
      pincodeId: pincodeId || user.pincodeId || null,
      divisionId: divisionId || user.divisionId || null,
      districtId: districtId || user.districtId || null,
      stateId: stateId || user.stateId || (user.state === 'Karnataka' ? 'state_ka' : '6aa10f70ca0932e6eaec1f5c'),
      photos: [],
      shopPhoto: null,
      reworkDetails: null,
      completionDetails: null,
      lastUpdate: new Date().toISOString()
    });

    // Log to audit trail
    await db.auditLogs.insertOne({
      action: 'Task Created',
      recordId: newTask._id,
      recordType: 'task',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Created task ${taskNumber} for ${newTask.vendor}`,
      timestamp: new Date().toISOString()
    });

    // Broadcast real-time ecosystem event
    publishEntityEvent({
      entity: 'task',
      action: 'created',
      entityId: newTask._id,
      data: newTask,
      scope: {
        stateId: newTask.stateId || newTask.state,
        districtId: newTask.districtId || newTask.district,
        divisionId: newTask.divisionId || newTask.division,
        pincodeId: newTask.pincodeId || newTask.pincode
      }
    });

    res.status(201).json({ success: true, message: 'Task created successfully', data: newTask });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ success: false, message: 'Failed to create task in database' });
  }
};

// PATCH /api/qc-tasks/tasks/:id/status - Update task status / rework / resolution
const updateTaskStatus = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { action, remarks, reason, reworkPhoto, reworkAudio, reworkRemarks, completionPhotos, resolutionDetails } = req.body;

    const task = await db.tasks.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in database' });
    }

    // ── Strict Territory Authorization Check ──
    const territoryProfile = await getManagerTerritoryProfile(user);
    if (!isTaskInManagerTerritory(task, territoryProfile)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Task is outside your assigned territory.'
      });
    }

    const currentUserId = String(user.id || user._id || user.managerId || '').trim();
    const currentUserName = String(user.name || '').trim().toLowerCase();

    // ── Primary Ownership & Authorization Check ──
    const assignedMgrId = String(task.assignedManagerId || task.assignedAgentId || '').trim();
    const assignedMgrName = String(task.assignedManagerName || task.assignedTo || task.assignedAgentName || '').trim().toLowerCase();

    const isAssignedManager = Boolean(
      (assignedMgrId && currentUserId && assignedMgrId.toLowerCase() === currentUserId.toLowerCase()) ||
      (assignedMgrName && currentUserName && assignedMgrName === currentUserName)
    );

    const isAdmin = ['admin', 'super_admin', 'super-admin', 'system_admin', 'state_admin', 'district_admin', 'division_admin', 'pincode_admin'].includes(String(user.role).toLowerCase()) ||
      user.email === 'admin@example.com' ||
      (task.createdByAdminId && String(task.createdByAdminId).toLowerCase() === currentUserId.toLowerCase());

    const { status: directStatus, progress, completionPercentage } = req.body;
    const priority = String(task.priority || 'Medium').toLowerCase();
    const currentStatus = task.status;

    let nextStatus = currentStatus;
    let nextAssignmentStatus = task.assignmentStatus || (['Assigned', 'Accepted', 'In Progress', 'Completed', 'Closed'].includes(currentStatus) ? 'ACCEPTED' : 'PENDING');
    let nextExecutionStatus = task.executionStatus || (['Completed', 'Closed', 'Resolved'].includes(currentStatus) ? 'COMPLETED' : currentStatus === 'In Progress' ? 'IN_PROGRESS' : 'NOT_STARTED');
    let updateFields = {};

    // ── 1. ACCEPT ACTION (LOW/MEDIUM: PENDING ACCEPTANCE → ACCEPTED) ──
    if (action === 'accept' || directStatus === 'Accepted') {
      if (!isAssignedManager && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only the assigned manager can accept this task.'
        });
      }
      if (!['Pending Acceptance', 'Pending'].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          message: `Task cannot be accepted from current status '${currentStatus}'.`
        });
      }
      nextStatus = 'Accepted';
      nextAssignmentStatus = 'ACCEPTED';
      updateFields.acceptedAt = new Date().toISOString();
      updateFields.acceptedBy = user.name;
      updateFields.acceptedById = currentUserId;
      updateFields.needsAcceptance = false;
    }

    // ── 2. REJECT ACTION (PENDING ACCEPTANCE → REJECTED) ──
    else if (action === 'reject' || directStatus === 'Rejected') {
      if (!isAssignedManager && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only the assigned manager can reject this task.'
        });
      }
      if (!['Pending Acceptance', 'Pending'].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          message: `Task cannot be rejected from current status '${currentStatus}'.`
        });
      }
      const rejectionReasonText = (reason || req.body.rejectionReason || remarks || req.body.actionReason || '').trim();
      if (!rejectionReasonText) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is mandatory.'
        });
      }
      nextStatus = 'Rejected';
      nextAssignmentStatus = 'REJECTED';
      updateFields.rejectionDetails = {
        taskId: task.taskNumber || task.id || id,
        rejectingManagerId: currentUserId,
        rejectingManagerName: user.name,
        rejectionReason: rejectionReasonText,
        previousStatus: currentStatus,
        newStatus: 'Rejected',
        timestamp: new Date().toISOString()
      };
      updateFields.rejectionReason = rejectionReasonText;
      updateFields.remarks = rejectionReasonText;
      updateFields.needsAcceptance = false;
    }

    // ── 3. START ACTION (ACCEPTED/ASSIGNED → IN PROGRESS) ──
    else if (action === 'start' || action === 'in_progress' || directStatus === 'In Progress') {
      if (!isAssignedManager && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only the assigned manager can start this task.'
        });
      }
      // Status transition validation
      if (['low', 'medium'].includes(priority) && ['Pending Acceptance', 'Pending'].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Task must be accepted before starting work.'
        });
      }
      if (['Completed', 'Closed'].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Completed tasks cannot be restarted directly. Admin must request rework.'
        });
      }
      nextStatus = 'In Progress';
      nextExecutionStatus = 'IN_PROGRESS';
      updateFields.startedBy = user.name;
      updateFields.startedById = currentUserId;
      updateFields.startedAt = task.startedAt || new Date().toISOString();
      updateFields.progress = task.progress && task.progress > 0 ? task.progress : 50;

      if (reworkPhoto || reworkAudio || reworkRemarks) {
        updateFields.reworkDetails = {
          reworkPhoto: reworkPhoto || task.reworkDetails?.reworkPhoto || '',
          reworkAudio: reworkAudio || task.reworkDetails?.reworkAudio || null,
          reworkRemarks: reworkRemarks || remarks || 'Rework initiated on field',
          updatedAt: new Date().toISOString()
        };
      }
    }

    // ── 4. COMPLETE ACTION (IN PROGRESS → COMPLETED) ──
    else if (action === 'complete' || action === 'resolve' || action === 'solved' || directStatus === 'Completed') {
      if (!isAssignedManager && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only the assigned manager can complete this task.'
        });
      }
      if (currentStatus !== 'In Progress' && !['Rework Required', 'Rework'].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Task must be In Progress before it can be marked as Completed.'
        });
      }

      // Mandatory Field 1: Field Photo
      const photo = req.body.completionPhoto ||
        (Array.isArray(completionPhotos) && completionPhotos[0]) ||
        (Array.isArray(req.body.photos) && req.body.photos[0]) ||
        req.body.actionPhoto ||
        req.body.shopPhoto ||
        reworkPhoto ||
        task.shopPhoto;

      if (!photo) {
        return res.status(400).json({
          success: false,
          message: 'Field photo proof is required to complete the task.'
        });
      }

      // Mandatory Field 2: Field Remarks
      const remarksText = (remarks || resolutionDetails || req.body.workCompleted || req.body.actionReason || reworkRemarks || task.remarks || '').trim();
      if (!remarksText) {
        return res.status(400).json({
          success: false,
          message: 'Field remarks are required to complete the task.'
        });
      }

      // Mandatory Field 3: Field Audio Note
      const audio = req.body.completionAudio || req.body.voiceNote || req.body.audioUrl || reworkAudio || task.voiceNote || null;
      if (!audio) {
        return res.status(400).json({
          success: false,
          message: 'Field audio note recording is required to complete the task.'
        });
      }

      const completedAt = new Date().toISOString();
      const newCompletion = {
        completionPhoto: photo,
        completionPhotos: [photo],
        workCompleted: remarksText,
        resolutionDetails: remarksText,
        completionAudio: audio,
        voiceNote: audio,
        completedBy: user.name,
        completedById: currentUserId,
        completedAt
      };

      // Preserve previous completion details if rework
      if (task.completionDetails) {
        updateFields.previousWork = {
          shopPhoto: task.completionDetails.completionPhoto || task.shopPhoto,
          remarks: task.completionDetails.workCompleted || task.remarks,
          voiceNote: task.completionDetails.completionAudio || task.voiceNote,
          completedBy: task.completionDetails.completedBy,
          completedAt: task.completionDetails.completedAt
        };
      }

      nextStatus = 'Completed';
      nextExecutionStatus = 'COMPLETED';
      updateFields.completionDetails = newCompletion;
      updateFields.shopPhoto = photo;
      updateFields.photos = [photo];
      updateFields.remarks = remarksText;
      updateFields.voiceNote = audio;
      updateFields.completedDate = completedAt;
      updateFields.progress = 100;
      updateFields.isResolved = true;
    }

    // ── 5. REWORK ACTION (ADMIN: COMPLETED → REWORK REQUIRED) ──
    else if (action === 'rework' || directStatus === 'Rework' || directStatus === 'Rework Required') {
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only Admin or Sub-Admin can request rework.'
        });
      }
      nextStatus = 'Rework Required';
      updateFields.previousWork = {
        shopPhoto: task.completionDetails?.completionPhoto || task.shopPhoto,
        remarks: task.completionDetails?.workCompleted || task.remarks,
        voiceNote: task.completionDetails?.completionAudio || task.voiceNote,
        completedBy: task.completionDetails?.completedBy,
        completedAt: task.completionDetails?.completedAt
      };
      updateFields.reworkDetails = {
        reworkRemarks: reworkRemarks || remarks || reason || 'Rework requested by admin',
        requestedBy: user.name,
        requestedById: currentUserId,
        requestedAt: new Date().toISOString()
      };
    }

    // ── 6. SUSPEND ACTION ──
    else if (action === 'suspend' || directStatus === 'Suspended') {
      nextStatus = 'Suspended';
    }

    // ── 7. OTHER PERMITTED ADMIN STATUSES ──
    else if (action === 'cancel' || directStatus === 'Cancelled') {
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Unauthorized: Admin action only.' });
      }
      nextStatus = 'Cancelled';
      nextAssignmentStatus = 'CANCELLED';
    } else {
      return res.status(400).json({
        success: false,
        message: `Invalid action '${action}' or status transition to '${directStatus}'.`
      });
    }

    updateFields.assignmentStatus = nextAssignmentStatus;
    updateFields.executionStatus = nextExecutionStatus;
    updateFields.status = nextStatus;
    updateFields.lastUpdate = new Date().toISOString();

    if (progress !== undefined || completionPercentage !== undefined) {
      updateFields.progress = Number(progress !== undefined ? progress : completionPercentage);
    }

    // Append to task history to maintain complete, immutable audit trail
    const historyItem = {
      action: `Task ${nextStatus}`,
      status: nextStatus,
      actor: user.name,
      actorId: currentUserId,
      actorRole: user.role,
      timestamp: new Date().toISOString(),
      remarks: updateFields.remarks || remarks || '',
      photo: updateFields.shopPhoto || null,
      audio: updateFields.voiceNote || null
    };

    updateFields.history = [...(task.history || []), historyItem];
    updateFields.activityLog = [
      ...(task.activityLog || []),
      {
        action: `Task ${nextStatus}`,
        by: user.name,
        byRole: user.role,
        at: new Date().toISOString(),
        notes: updateFields.remarks || remarks || `Status changed to ${nextStatus}`
      }
    ];

    const updatedTask = await db.tasks.findByIdAndUpdate(id, { $set: updateFields });

    // Log to audit trail
    await db.auditLogs.insertOne({
      action: `Task ${nextStatus}`,
      recordId: id,
      taskId: task.taskNumber || id,
      recordType: 'task',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      actorId: user.id,
      actorRole: user.role,
      actorManagerLevel: user.level || user.role,
      previousStatus: task.status,
      newStatus: nextStatus,
      assignmentStatus: nextAssignmentStatus,
      executionStatus: nextExecutionStatus,
      details: `Task ${task.taskNumber || id} status changed from ${task.status} to ${nextStatus}`,
      timestamp: new Date().toISOString()
    });

    // Broadcast persistent notification
    await broadcastNotification({
      type: 'task_updated',
      title: `Task ${task.taskNumber || id} ${nextStatus}`,
      message: `${user.name} marked task ${task.taskNumber || id} as ${nextStatus}.`,
      recordId: id,
      userId: task.assignedManagerId || user.id,
      createdAt: new Date().toISOString()
    });

    // Broadcast real-time ecosystem event
    publishEntityEvent({
      entity: 'task',
      action: 'updated',
      entityId: updatedTask._id || id,
      data: updatedTask,
      scope: {
        stateId: updatedTask.stateId || updatedTask.state,
        districtId: updatedTask.districtId || updatedTask.district,
        divisionId: updatedTask.divisionId || updatedTask.division,
        pincodeId: updatedTask.pincodeId || updatedTask.pincode
      }
    });

    res.json({ success: true, message: `Task status updated to ${nextStatus}`, data: updatedTask });
  } catch (err) {
    console.error('Error updating task status:', err);
    res.status(500).json({ success: false, message: 'Failed to update task status in database' });
  }
};

// POST /api/qc-tasks/tasks/:id/suspend - Request or execute task suspension
const submitSuspendRequest = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { reason, evidenceUrl } = req.body;

    const task = await db.tasks.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in database' });
    }

    // ── Strict Territory Authorization Check ──
    const territoryProfile = await getManagerTerritoryProfile(user);
    if (!isTaskInManagerTerritory(task, territoryProfile)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Task is outside your assigned territory.'
      });
    }

    const updatedTask = await db.tasks.findByIdAndUpdate(id, {
      $set: {
        status: 'Suspended',
        suspensionDetails: {
          reason: reason || 'Operation suspended by field manager',
          evidenceUrl: evidenceUrl || null,
          suspendedBy: user.name,
          suspendedAt: new Date().toISOString()
        }
      }
    });

    await db.auditLogs.insertOne({
      action: 'Task Suspended',
      recordId: id,
      recordType: 'task',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Suspended task ${task.taskNumber}. Reason: ${reason || 'N/A'}`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Task suspended successfully', data: updatedTask });
  } catch (err) {
    console.error('Error suspending task:', err);
    res.status(500).json({ success: false, message: 'Failed to suspend task in database' });
  }
};

// GET /api/qc-tasks/tasks/:id - Get single task with strict territory validation
const getTaskById = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const task = await db.tasks.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in database' });
    }

    const territoryProfile = await getManagerTerritoryProfile(user);
    if (!isTaskInManagerTerritory(task, territoryProfile)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Task is outside your assigned territory.'
      });
    }

    res.json({ success: true, data: task });
  } catch (err) {
    console.error('Error fetching task by ID:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve task' });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTaskStatus,
  submitSuspendRequest,
  getManagerTerritoryProfile,
  isTaskInManagerTerritory
};
