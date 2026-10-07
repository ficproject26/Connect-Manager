const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { blockManagersFromAdminEndpoints } = require('../middleware/roleMiddleware');

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authMiddleware(req, res, next);
  }
  next();
};

// Read-only location routes (public for registration, filtered if manager authenticated)
router.get('/states', optionalAuth, locationController.getStates);
router.get('/districts', optionalAuth, locationController.getDistricts);
router.get('/divisions', optionalAuth, locationController.getDivisions);
router.get('/pincodes', optionalAuth, locationController.getPincodes);

// Location-write endpoints are strictly forbidden for managers
router.post('/states', authMiddleware, blockManagersFromAdminEndpoints);
router.post('/districts', authMiddleware, blockManagersFromAdminEndpoints);
router.post('/divisions', authMiddleware, blockManagersFromAdminEndpoints);
router.post('/pincodes', authMiddleware, blockManagersFromAdminEndpoints);
router.put(['/states/:id', '/districts/:id', '/divisions/:id', '/pincodes/:id'], authMiddleware, blockManagersFromAdminEndpoints);
router.delete(['/states/:id', '/districts/:id', '/divisions/:id', '/pincodes/:id'], authMiddleware, blockManagersFromAdminEndpoints);

module.exports = router;
