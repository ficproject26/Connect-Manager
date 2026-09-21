const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// Role-specific dashboard stats
router.get('/dashboard', reportController.getDashboardStats);

// Performance leaderboard data (live from database)
router.get('/leaderboard', reportController.getLeaderboardData);

// Branch-scoped vendor reports data
router.get('/vendors', reportController.getVendorReportData);

module.exports = router;
