const express = require('express');
const router = express.Router();
const shopVisitController = require('../controllers/shopVisitController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// GET /api/shop-visits - List visits
router.get('/', shopVisitController.getShopVisits);

// POST /api/shop-visits - Create visit
router.post('/', shopVisitController.createShopVisit);

// PUT /api/shop-visits/:id - Update visit
router.put('/:id', shopVisitController.updateShopVisit);

module.exports = router;
