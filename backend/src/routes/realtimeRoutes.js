const express = require('express');
const router = express.Router();
const { getRealtimeMetrics } = require('../realtime');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: getRealtimeMetrics()
  });
});

module.exports = router;
