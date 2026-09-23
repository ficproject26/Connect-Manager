const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authMiddleware, JWT_SECRET } = require('../middleware/authMiddleware');

// In-memory or database notifications
let notificationsStore = [];

// SSE Clients set
const clients = new Set();

// Helper to push notification to connected SSE clients
const broadcastNotification = (notification) => {
  notificationsStore.unshift(notification);
  if (notificationsStore.length > 200) notificationsStore.pop();

  const dataString = `data: ${JSON.stringify({ type: 'notification', data: notification })}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(dataString);
    } catch (e) {
      clients.delete(client);
    }
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

// Unread count
router.get('/unread-count', (req, res) => {
  const unreadCount = notificationsStore.filter(n => !n.isRead && (n.userId === req.user.id || !n.userId)).length;
  res.json({ success: true, unreadCount });
});

// List notifications
router.get('/', (req, res) => {
  const userNotifications = notificationsStore.filter(n => n.userId === req.user.id || !n.userId);
  res.json({ success: true, notifications: userNotifications });
});

// Mark single as read
router.patch('/:id/read', (req, res) => {
  const notif = notificationsStore.find(n => n._id === req.params.id || n.id === req.params.id);
  if (notif) notif.isRead = true;
  res.json({ success: true });
});

// Mark all as read
router.post('/mark-all-read', (req, res) => {
  notificationsStore.forEach(n => {
    if (n.userId === req.user.id || !n.userId) n.isRead = true;
  });
  res.json({ success: true });
});

// Delete single notification
router.delete('/:id', (req, res) => {
  notificationsStore = notificationsStore.filter(n => n._id !== req.params.id && n.id !== req.params.id);
  res.json({ success: true });
});

module.exports = {
  router,
  broadcastNotification
};
