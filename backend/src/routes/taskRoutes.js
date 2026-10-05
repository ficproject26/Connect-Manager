const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// GET /api/qc-tasks/tasks - List tasks
router.get('/tasks', taskController.getTasks);

// GET /api/qc-tasks/tasks/:id - Get single task with territory validation
router.get('/tasks/:id', taskController.getTaskById);

// POST /api/qc-tasks/tasks - Create task
router.post('/tasks', taskController.createTask);

// PATCH /api/qc-tasks/tasks/:id/status - Update task status / rework
router.patch('/tasks/:id/status', taskController.updateTaskStatus);

// POST /api/qc-tasks/tasks/:id/suspend - Suspend task
router.post('/tasks/:id/suspend', taskController.submitSuspendRequest);

module.exports = router;
