const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

const authController = require('../controllers/authController');

// GET /api/settings
router.get('/', settingsController.getSettings);

// PUT /api/settings
router.put('/', settingsController.updateSettings);

// GET /api/settings/sessions
router.get('/sessions', settingsController.getActiveSessions);

// POST /api/settings/sessions/revoke
router.post('/sessions/revoke', settingsController.revokeSession);

// POST /api/settings/sessions/revoke-others
router.post('/sessions/revoke-others', settingsController.revokeAllOtherSessions);

// PUT /api/settings/inactivity-timeout
router.put('/inactivity-timeout', settingsController.updateInactivityTimeout);

// GET /api/settings/bank-details
router.get('/bank-details', authController.getBankDetails);

// PUT /api/settings/bank-details
router.put('/bank-details', authController.updateBankDetails);

// POST /api/settings/bank-details
router.post('/bank-details', authController.updateBankDetails);

module.exports = router;
