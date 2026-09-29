const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getRealtimeMetrics, eventSubscriber } = require('../realtime');
const { JWT_SECRET } = require('../middleware/authMiddleware');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: getRealtimeMetrics()
  });
});

// GET /api/realtime/events - HTTP polling fallback for environments without WebSocket support (e.g. Vercel)
router.get('/events', (req, res) => {
  try {
    const since = parseInt(req.query.since || '0', 10);
    const token = req.query.token || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);

    let user = null;
    if (token) {
      try {
        user = jwt.verify(token, JWT_SECRET);
      } catch (e) {}
    }

    const events = eventSubscriber.getRecentEvents(since);

    // Territory filtering if authenticated
    const filteredEvents = user ? events.filter(ev => {
      const role = user.role || '';
      if (['admin', 'super-admin', 'super_admin'].includes(role) || user.email === 'admin@example.com') return true;
      if (!ev.scope) return true;
      if (user.stateId && ev.scope.stateId && String(user.stateId) !== String(ev.scope.stateId)) return false;
      if (user.districtId && ev.scope.districtId && String(user.districtId) !== String(ev.scope.districtId)) return false;
      if (user.divisionId && ev.scope.divisionId && String(user.divisionId) !== String(ev.scope.divisionId)) return false;
      if (user.pincodeId && ev.scope.pincodeId && String(user.pincodeId) !== String(ev.scope.pincodeId)) return false;
      return true;
    }) : events;

    res.json({
      success: true,
      timestamp: Date.now(),
      count: filteredEvents.length,
      events: filteredEvents
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
