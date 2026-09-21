const express = require('express');
const router = express.Router();
const managerDirectoryController = require('../controllers/managerDirectoryController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole, blockManagersFromAdminEndpoints } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// GET /api/managers - Scoped read-only access to lower-level managers
router.get('/', managerDirectoryController.getLowerLevelManagers);

// Creating/editing managers is Admin-only and forbidden for field managers
router.post('/', blockManagersFromAdminEndpoints);
router.put('*', blockManagersFromAdminEndpoints);
router.delete('*', blockManagersFromAdminEndpoints);

module.exports = router;
