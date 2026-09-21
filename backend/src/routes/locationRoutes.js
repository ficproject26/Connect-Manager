const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole, blockManagersFromAdminEndpoints } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// Read-only location routes (scoped to manager branch)
router.get('/states', locationController.getStates);
router.get('/districts', locationController.getDistricts);
router.get('/divisions', locationController.getDivisions);
router.get('/pincodes', locationController.getPincodes);

// Location-write endpoints are strictly forbidden for managers
router.post('/states', blockManagersFromAdminEndpoints);
router.post('/districts', blockManagersFromAdminEndpoints);
router.post('/divisions', blockManagersFromAdminEndpoints);
router.post('/pincodes', blockManagersFromAdminEndpoints);
router.put('*', blockManagersFromAdminEndpoints);
router.delete('*', blockManagersFromAdminEndpoints);

module.exports = router;
