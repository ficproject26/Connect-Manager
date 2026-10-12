const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// GET /api/issues - List issues scoped to territory
router.get('/', issueController.getIssues);

// GET /api/issues/:id - Get single issue
router.get('/:id', issueController.getIssueById);

// PATCH /api/issues/:id/status - Update issue status
router.patch('/:id/status', issueController.updateIssueStatus);

module.exports = router;
