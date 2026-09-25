const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// GET /api/operations/agents - List agents
router.get('/agents', agentController.getAgents);

// POST /api/operations/agents - Create agent
router.post('/agents', agentController.createAgent);

// GET /api/operations/agents/hierarchy - Hierarchy
router.get('/agents/hierarchy', agentController.getAgentHierarchy);

module.exports = router;
