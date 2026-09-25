const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/authMiddleware');

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
router.get('/stream', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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

// Require JWT for all other notification operations
router.use(authMiddleware);

// GET /api/notifications/unread-count - Unread count from database
router.get('/unread-count', async (req, res) => {
  try {
    const allNotifs = await db.notifications.find();
    const unreadCount = allNotifs.filter(n => !n.isRead && (n.userId === req.user.id || !n.userId)).length;
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
      .filter(n => n.userId === req.user.id || !n.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, notifications: userNotifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/:id/read - Mark single as read in database
router.patch('/:id/read', async (req, res) => {
  try {
    const notif = await db.notifications.findById(req.params.id);
    if (notif) {
      await db.notifications.findByIdAndUpdate(req.params.id, { $set: { isRead: true } });
    }
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
      if ((n.userId === req.user.id || !n.userId) && !n.isRead) {
        await db.notifications.findByIdAndUpdate(n._id, { $set: { isRead: true } });
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark all notifications read' });
  }
});

// DELETE /api/notifications/:id - Delete single notification from database
router.delete('/:id', async (req, res) => {
  try {
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
