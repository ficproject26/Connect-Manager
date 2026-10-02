const db = require('../config/db');
const { getScopeFilter } = require('../middleware/scopeMiddleware');
const { broadcastNotification } = require('../routes/notificationRoutes');
const { publishEntityEvent } = require('../realtime');

// GET /api/qc-tasks/tasks - Get scoped operational & QC tasks
const getTasks = async (req, res) => {
  try {
    const user = req.user;
    const scopeFilter = getScopeFilter(user);
    const { status, category, priority, search, state, district, division, pincode, agentId, agentRole } = req.query;

    const allTasks = await db.tasks.find();

    let filtered = allTasks.filter(t => {
      // Scope authorization filtering based on authenticated manager
      if (user.role === 'state_manager') {
        const uState = (user.state || user.assignedState || '').toLowerCase();
        const tState = (t.state || t.stateName || '').toLowerCase();
        if (user.stateId && t.stateId && t.stateId !== user.stateId && (!uState || !tState || uState !== tState)) return false;
      }
      if (user.role === 'district_manager') {
        const uDist = (user.district || '').toLowerCase();
        const tDist = (t.district || '').toLowerCase();
        if (user.districtId && t.districtId && t.districtId !== user.districtId && (!uDist || !tDist || uDist !== tDist)) return false;
      }
      if (user.role === 'division_manager') {
        const uDiv = (user.division || '').toLowerCase();
        const tDiv = (t.division || '').toLowerCase();
        if (user.divisionId && t.divisionId && t.divisionId !== user.divisionId && (!uDiv || !tDiv || uDiv !== tDiv)) return false;
      }
      if (user.role === 'pincode_manager') {
        const uPin = String(user.pincode || user.pincodeCode || '');
        const tPin = String(t.pincode || '');
        if (user.pincodeId && t.pincodeId && t.pincodeId !== user.pincodeId && (!uPin || !tPin || uPin !== tPin)) return false;
      }

      // Query-level optional filters
      if (status && status !== 'All' && t.status !== status) return false;
      if (category && category !== 'All' && t.category !== category) return false;
      if (priority && priority !== 'All' && t.priority !== priority) return false;
      if (state && t.state && !t.state.toLowerCase().includes(state.toLowerCase())) return false;
      if (district && t.district && !t.district.toLowerCase().includes(district.toLowerCase())) return false;
      if (division && t.division && !t.division.toLowerCase().includes(division.toLowerCase())) return false;
      if (pincode && t.pincode && !String(t.pincode).includes(String(pincode))) return false;
      if (agentId && t.assignedAgentId !== agentId && t.assignedManagerId !== agentId) return false;
      if (agentRole && t.assignedManagerRole !== agentRole && t.assignedAgentRole !== agentRole) return false;

      // Search filter
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (t.taskNumber || '').toLowerCase().includes(q);
        const matchVendor = (t.vendor || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchLoc = (t.location || '').toLowerCase().includes(q);
        const matchAssignee = (t.assignedManagerName || t.assignedAgentName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchVendor && !matchDesc && !matchLoc && !matchAssignee) return false;
      }

      return true;
    });

    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const enriched = filtered.map(t => {
      const assignmentStatus = t.assignmentStatus || (['Assigned', 'Accepted', 'In Progress', 'Completed', 'Closed'].includes(t.status) ? 'ACCEPTED' : (t.status === 'Rejected' ? 'REJECTED' : t.status === 'Cancelled' ? 'CANCELLED' : 'ACCEPTED'));
      const executionStatus = t.executionStatus || (['Completed', 'Closed', 'Resolved'].includes(t.status) ? 'COMPLETED' : t.status === 'In Progress' ? 'IN_PROGRESS' : 'NOT_STARTED');
      return {
        ...t,
        assignmentStatus,
        executionStatus
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
      tasks: enriched
    });
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
    const { action, remarks, reworkPhoto, reworkAudio, reworkRemarks, completionPhotos, resolutionDetails } = req.body;

    const task = await db.tasks.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in database' });
    }

    // ── Primary Ownership & Authorization Check ──
    const isAssignedManager = Boolean(
      (task.assignedManagerId && [String(user.id), String(user._id), String(user.managerId)].includes(String(task.assignedManagerId))) ||
      (task.assignedManagerName && user.name && task.assignedManagerName.trim().toLowerCase() === user.name.trim().toLowerCase())
    );

    const isAdmin = ['admin', 'system_admin', 'state_manager'].includes(user.role) ||
      (task.createdByAdminId && [String(user.id), String(user._id), String(user.managerId)].includes(String(task.createdByAdminId)));

    const { status: directStatus, progress, completionPercentage } = req.body;

    // ── Rule: Administrative Acceptance is Controlled by Admin ──
    const isAdminAction = Boolean(
      req.body.assignmentStatus ||
      ['accept', 'reject', 'cancel'].includes(action) ||
      ['Accepted', 'Rejected', 'Cancelled', 'Pending'].includes(directStatus)
    );

    if (isAdminAction && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Administrative assignment status is controlled by Admin.'
      });
    }

    // ── Rule: Only Assigned Manager Can Execute the Task ──
    const isExecutionAction = Boolean(
      req.body.executionStatus ||
      ['start', 'in_progress', 'complete', 'resolve', 'solved', 'rework', 'suspend'].includes(action) ||
      ['In Progress', 'Completed', 'Rework Required', 'Suspended'].includes(directStatus) ||
      reworkPhoto ||
      completionPhotos
    );

    const currentAssignmentStatus = task.assignmentStatus || (['Assigned', 'Accepted', 'In Progress', 'Completed', 'Closed'].includes(task.status) ? 'ACCEPTED' : 'PENDING');
    const currentExecutionStatus = task.executionStatus || (['Completed', 'Closed', 'Resolved'].includes(task.status) ? 'COMPLETED' : task.status === 'In Progress' ? 'IN_PROGRESS' : 'NOT_STARTED');

    if (isExecutionAction) {
      if (!isAssignedManager) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only the assigned manager can execute this task or update its status.'
        });
      }

      if (currentAssignmentStatus !== 'ACCEPTED') {
        return res.status(400).json({
          success: false,
          message: 'Task must be accepted by Admin before work can begin.'
        });
      }

      const isStarting = action === 'start' || action === 'in_progress' || directStatus === 'In Progress' || req.body.executionStatus === 'IN_PROGRESS';
      const isCompleting = action === 'complete' || action === 'resolve' || action === 'solved' || directStatus === 'Completed' || req.body.executionStatus === 'COMPLETED';

      // Verify mandatory task fields: photo and remarks
      const hasPhoto = Boolean(
        req.body.shopPhoto ||
        req.body.actionPhoto ||
        (req.body.photos && req.body.photos.length > 0) ||
        task.shopPhoto ||
        (task.photos && task.photos.length > 0) ||
        (task.completionDetails?.completionPhotos && task.completionDetails.completionPhotos.length > 0) ||
        (completionPhotos && completionPhotos.length > 0) ||
        reworkPhoto
      );

      const hasRemarks = Boolean(
        (remarks && remarks.trim().length > 0) ||
        (req.body.actionReason && req.body.actionReason.trim().length > 0) ||
        (task.remarks && task.remarks.trim().length > 0) ||
        (resolutionDetails && resolutionDetails.trim().length > 0) ||
        (reworkRemarks && reworkRemarks.trim().length > 0)
      );

      // Transition check: NOT_STARTED -> IN_PROGRESS
      if (isStarting) {
        if (!hasPhoto || !hasRemarks) {
          return res.status(400).json({
            success: false,
            message: 'Mandatory task data required: Please attach photo proof and enter field remarks before starting work.'
          });
        }
      }

      // Transition check: IN_PROGRESS -> COMPLETED (Prevent direct NOT_STARTED -> COMPLETED)
      if (isCompleting) {
        if (currentExecutionStatus !== 'IN_PROGRESS' && task.status !== 'In Progress') {
          return res.status(400).json({
            success: false,
            message: 'Task must be In Progress before it can be marked as Completed.'
          });
        }
        if (!hasPhoto || !hasRemarks) {
          return res.status(400).json({
            success: false,
            message: 'Complete the required task information before marking this task as completed.'
          });
        }
      }
    }

    let nextStatus = task.status;
    let nextAssignmentStatus = currentAssignmentStatus;
    let nextExecutionStatus = currentExecutionStatus;
    let updateFields = {};

    if (directStatus && ['Assigned', 'Accepted', 'In Progress', 'Pending', 'Completed', 'Rejected', 'Cancelled', 'Overdue', 'Suspended', 'Rework'].includes(directStatus)) {
      nextStatus = directStatus;
      if (directStatus === 'In Progress') {
        nextExecutionStatus = 'IN_PROGRESS';
      } else if (directStatus === 'Completed') {
        nextExecutionStatus = 'COMPLETED';
      } else if (directStatus === 'Accepted') {
        nextAssignmentStatus = 'ACCEPTED';
      } else if (directStatus === 'Rejected') {
        nextAssignmentStatus = 'REJECTED';
      } else if (directStatus === 'Cancelled') {
        nextAssignmentStatus = 'CANCELLED';
      }
    } else if (action === 'start' || action === 'in_progress' || action === 'not_solved') {
      nextStatus = 'In Progress';
      nextExecutionStatus = 'IN_PROGRESS';
      if (reworkPhoto || reworkAudio || reworkRemarks) {
        updateFields.reworkDetails = {
          reworkPhoto: reworkPhoto || task.reworkDetails?.reworkPhoto || '',
          reworkAudio: reworkAudio || task.reworkDetails?.reworkAudio || null,
          reworkRemarks: reworkRemarks || remarks || 'Rework initiated on field',
          updatedAt: new Date().toISOString()
        };
      }
    } else if (action === 'complete' || action === 'resolve' || action === 'solved') {
      nextStatus = 'Completed';
      nextExecutionStatus = 'COMPLETED';
      updateFields.completionDetails = {
        workCompleted: remarks || resolutionDetails || 'Operational task resolved on-site.',
        resolutionDetails: resolutionDetails || remarks || '',
        completionPhotos: completionPhotos || (req.body.actionPhoto ? [req.body.actionPhoto] : []),
        completedAt: new Date().toISOString(),
        completedBy: user.name
      };
      updateFields.completedDate = new Date().toISOString();
      updateFields.progress = 100;
    } else if (action === 'accept') {
      nextStatus = 'Accepted';
      nextAssignmentStatus = 'ACCEPTED';
    } else if (action === 'reject') {
      nextStatus = 'Rejected';
      nextAssignmentStatus = 'REJECTED';
    } else if (action === 'cancel') {
      nextStatus = 'Cancelled';
      nextAssignmentStatus = 'CANCELLED';
    } else if (action === 'pending') {
      nextStatus = 'Pending';
      nextAssignmentStatus = 'PENDING';
    } else if (action === 'rework') {
      nextStatus = 'Rework';
      updateFields.reworkDetails = {
        reworkPhoto: reworkPhoto || '',
        reworkAudio: reworkAudio || null,
        reworkRemarks: reworkRemarks || remarks || 'Rework requested',
        requestedAt: new Date().toISOString()
      };
    } else if (action === 'suspend') {
      nextStatus = 'Suspended';
    }

    if (req.body.actionPhoto) {
      updateFields.shopPhoto = req.body.actionPhoto;
      updateFields.photos = [req.body.actionPhoto];
    }
    if (req.body.actionReason) {
      updateFields.remarks = req.body.actionReason;
    }

    updateFields.assignmentStatus = nextAssignmentStatus;
    updateFields.executionStatus = nextExecutionStatus;

    if (progress !== undefined || completionPercentage !== undefined) {
      updateFields.progress = Number(progress !== undefined ? progress : completionPercentage);
    }

    updateFields.status = nextStatus;
    updateFields.lastUpdate = new Date().toISOString();
    if (remarks) updateFields.remarks = remarks;

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
      title: `Task ${task.taskNumber} ${nextStatus}`,
      message: `${user.name} marked task ${task.taskNumber} as ${nextStatus}.`,
      recordId: id,
      userId: task.assignedManagerId || user.id,
      createdAt: new Date().toISOString()
    });

    // Broadcast real-time ecosystem event
    publishEntityEvent({
      entity: 'task',
      action: 'updated',
      entityId: updatedTask._id,
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

module.exports = {
  getTasks,
  createTask,
  updateTaskStatus,
  submitSuspendRequest
};
