const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');
const shopVisitController = require('../controllers/shopVisitController');
const {
  submitVendorOnboarding,
  getManagerOnboardings,
  getAdminOnboardings,
  approveOnboarding,
  rejectOnboarding,
  getOnboardingById
} = require('../controllers/managerOnboardingController');

router.use(authMiddleware);
router.use(checkRole());

// Manager routes - Canonical Field Shop Visit
router.post('/field-visit', shopVisitController.createShopVisit);
router.post('/submit', submitVendorOnboarding);
router.get('/', getManagerOnboardings);

// Admin / Pincode Admin routes
router.get('/admin', getAdminOnboardings);

// Record-level routes
router.get('/:id', getOnboardingById);
router.patch('/:id/approve', approveOnboarding);
router.patch('/:id/reject', rejectOnboarding);

module.exports = router;
