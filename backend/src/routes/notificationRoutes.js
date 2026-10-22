const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/authMiddleware');
const {
  ALLOWED_MANAGER_ROLES,
  ADMIN_ROLES,
  isAllowedManagerRole,
  isAdminRole,
  isApprovedStatus,
  checkRole
} = require('../middleware/roleMiddleware');

// SSE Clients set
const clients = new Set();

// Helper to push notification to connected SSE clients and persist to database
const broadcastNotification = async (notification) => {
  try {
    const savedNotification = await db.notifications.insertOne({
      type: notification.type || 'system',
      title: notification.title || 'Notification',
      message: notification.message || '',
      recordId: notification.recordId || null,
      userId: notification.userId || null,
      isRead: false,
      createdAt: notification.createdAt || new Date().toISOString()
    });

    const dataString = `data: ${JSON.stringify({ type: 'notification', data: savedNotification })}\n\n`;
    for (const client of clients) {
      try {
        if (!notification.userId || client.id === notification.userId) {
          client.res.write(dataString);
        }
      } catch (e) {
        clients.delete(client);
      }
    }

    return savedNotification;
  } catch (err) {
    console.error('Error broadcasting notification to database:', err);
    return null;
  }
};

// SSE stream (accepts token via query param as EventSource cannot send headers)
router.get('/stream', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    let user = await db.users.findById(decoded.id);
    if (!user) {
      user = await db.managers.findById(decoded.id);
    }
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    const userRole = String(user.role || '').toLowerCase();
    const isManager = isAllowedManagerRole(userRole);
    const isAdmin = isAdminRole(userRole) || user.email === 'admin@example.com' || user.id === 'user_admin' || user._id === 'user_admin';

    if (!isManager && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Role is not authorized for manager notifications' });
    }

    const isApproved = isApprovedStatus(user.status);
    if (!isAdmin && (!isApproved || user.isActive === false)) {
      return res.status(403).json({ success: false, message: 'Access denied: Manager approval is required to access notification stream' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client = { id: decoded.id, res };
    clients.add(client);

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(':keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(client);
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Require JWT and approved manager role for all operational notification endpoints
router.use(authMiddleware);
router.use(checkRole());

const isNotifInUserStateScope = (n, user) => {
  if (!user) return true;
  const userRole = String(user.role || '').toLowerCase();
  const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(userRole) || user.email === 'admin@example.com';
  if (isGlobalAdmin) return true;

  // If notification explicitly targeted this user
  if (n.userId && String(n.userId) === String(user.id || user._id)) return true;
  // If targeted to someone else
  if (n.userId && String(n.userId) !== String(user.id || user._id)) return false;

  const userStateId = String(user.stateId || user.assignedStateId || user.scope?.stateId || '').toLowerCase();
  const userState = String(user.state || user.stateName || user.assignedState || user.scope?.stateName || '').toLowerCase();
  const notifStateId = String(n.stateId || n.metadata?.stateId || '').toLowerCase();
  const notifState = String(n.state || n.stateName || n.metadata?.state || '').toLowerCase();

  if (notifStateId && userStateId && notifStateId !== userStateId) return false;
  if (notifState && userState && !userState.includes(notifState) && !notifState.includes(userState)) return false;

  // Content state cross-contamination check
  const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
  if (userState.includes('karnataka') || userStateId === 'state_ka') {
    if (text.includes('tamil nadu') || text.includes('krishnagiri') || text.includes('hosur') || text.includes('chennai')) {
      return false;
    }
  } else if (userState.includes('tamil nadu') || userStateId === 'state_tn') {
    if (text.includes('karnataka') || text.includes('bengaluru') || text.includes('bangalore') || text.includes('mysuru')) {
      return false;
    }
  }

  return true;
};

// GET /api/notifications/unread-count - Unread count from database
router.get('/unread-count', async (req, res) => {
  try {
    const allNotifs = await db.notifications.find();
    const unreadCount = allNotifs.filter(n => !n.isRead && isNotifInUserStateScope(n, req.user)).length;
    res.json({ success: true, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to count notifications' });
  }
});

// GET /api/notifications - List notifications from database
router.get('/', async (req, res) => {
  try {
    const allNotifs = await db.notifications.find();
    const userNotifications = allNotifs
      .filter(n => isNotifInUserStateScope(n, req.user))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, notifications: userNotifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/:id/read - Mark single as read with IDOR ownership check
router.patch('/:id/read', async (req, res) => {
  try {
    const notif = await db.notifications.findById(req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notif.userId && String(notif.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot modify notification belonging to another user' });
    }
    await db.notifications.findByIdAndUpdate(req.params.id, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark notification read' });
  }
});

// POST /api/notifications/mark-all-read - Mark all as read in database
router.post('/mark-all-read', async (req, res) => {
  try {
    const allNotifs = await db.notifications.find();
    for (const n of allNotifs) {
      if ((!n.userId || String(n.userId) === String(req.user.id)) && !n.isRead) {
        await db.notifications.findByIdAndUpdate(n._id, { $set: { isRead: true } });
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark all notifications read' });
  }
});

// DELETE /api/notifications/:id - Delete single notification with IDOR ownership check
router.delete('/:id', async (req, res) => {
  try {
    const notif = await db.notifications.findById(req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notif.userId && String(notif.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot delete notification belonging to another user' });
    }
    await db.notifications.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

module.exports = {
  router,
  broadcastNotification
};
