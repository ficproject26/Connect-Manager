const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');
const { verifyVendorScope, validateVendorCreationScope } = require('../middleware/scopeMiddleware');

// All vendor routes require valid JWT and Manager role
router.use(authMiddleware);
router.use(checkRole());

// GET /api/vendors - List with search, filtering, pagination (scoped)
router.get('/', vendorController.getVendors);

// POST /api/vendors - Create vendor (validates creation scope)
router.post('/', validateVendorCreationScope, vendorController.createVendor);

// GET /api/vendors/:id - Detail view (scope verified)
router.get('/:id', verifyVendorScope, vendorController.getVendorById);

// PUT /api/vendors/:id - Edit vendor (scope verified)
router.put('/:id', verifyVendorScope, vendorController.updateVendor);

// PATCH /api/vendors/:id/status - Status transition (scope verified)
router.patch('/:id/status', verifyVendorScope, vendorController.updateVendorStatus);

module.exports = router;
