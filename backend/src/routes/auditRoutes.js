const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// GET /api/audit-logs - Scoped audit history
router.get('/', auditController.getAuditLogs);

module.exports = router;
