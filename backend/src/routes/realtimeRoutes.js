const express = require('express');
const router = express.Router();
const { realtimeWebSocketServer } = require('../realtime');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: realtimeWebSocketServer.getHealth()
  });
});

module.exports = router;
