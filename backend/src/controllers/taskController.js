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

    res.json({
      success: true,
      count: filtered.length,
      data: filtered,
      tasks: filtered
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
      assignedDate: new Date().toISOString(),
      status: 'Assigned',
      progress: 0,
      assignedManagerId: user.id,
      assignedManagerName: assignedTo || user.name,
      assignedManagerRole: assignedManagerRole || user.role,
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
        pincodeId: newTask.pincodeId || newTask.pincode,
        targetUserId: newTask.assignedTo || newTask.assignedManagerId
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

    let nextStatus = task.status;
    let updateFields = {};

    const { status: directStatus, progress, completionPercentage } = req.body;

    if (directStatus && ['Assigned', 'Accepted', 'In Progress', 'Pending', 'Completed', 'Rejected', 'Cancelled', 'Overdue', 'Suspended', 'Rework'].includes(directStatus)) {
      nextStatus = directStatus;
    } else if (action === 'start' || action === 'in_progress' || action === 'not_solved') {
      nextStatus = 'In Progress';
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
      updateFields.completionDetails = {
        workCompleted: remarks || resolutionDetails || 'Operational task resolved on-site.',
        resolutionDetails: resolutionDetails || remarks || '',
        completionPhotos: completionPhotos || [],
        completedAt: new Date().toISOString(),
        completedBy: user.name
      };
      updateFields.completedDate = new Date().toISOString();
      updateFields.progress = 100;
    } else if (action === 'accept') {
      nextStatus = 'Accepted';
    } else if (action === 'reject') {
      nextStatus = 'Rejected';
    } else if (action === 'cancel') {
      nextStatus = 'Cancelled';
    } else if (action === 'pending') {
      nextStatus = 'Pending';
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
      recordType: 'task',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Task ${task.taskNumber || id} status changed to ${nextStatus}`,
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
        pincodeId: updatedTask.pincodeId || updatedTask.pincode,
        targetUserId: updatedTask.assignedTo || updatedTask.assignedManagerId
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
