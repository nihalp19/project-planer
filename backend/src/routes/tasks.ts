import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from '../controllers/taskController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create task
router.post(
  '/',
  validate([
    body('projectId').isMongoId().withMessage('Valid project ID is required'),
    body('name').trim().notEmpty().withMessage('Task name is required'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('dependencies').optional().isArray().withMessage('Dependencies must be an array'),
    body('dependencies.*').optional().isMongoId().withMessage('Invalid dependency ID'),
    body('assignedTo').optional().isArray().withMessage('AssignedTo must be an array'),
    body('assignedTo.*').optional().isMongoId().withMessage('Invalid user ID'),
  ]),
  createTask
);

// Get tasks by project
router.get(
  '/',
  validate([query('projectId').isMongoId().withMessage('Valid project ID is required')]),
  getTasks
);

// Get task by ID
router.get(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid task ID')]),
  getTaskById
);

// Update task
router.patch(
  '/:id',
  validate([
    param('id').isMongoId().withMessage('Invalid task ID'),
    body('name').optional().trim().notEmpty().withMessage('Task name cannot be empty'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('dependencies').optional().isArray().withMessage('Dependencies must be an array'),
    body('dependencies.*').optional().isMongoId().withMessage('Invalid dependency ID'),
    body('assignedTo').optional().isArray().withMessage('AssignedTo must be an array'),
    body('assignedTo.*').optional().isMongoId().withMessage('Invalid user ID'),
    body('status')
      .optional()
      .isIn(['pending', 'in-progress', 'completed'])
      .withMessage('Invalid status'),
  ]),
  updateTask
);

// Delete task
router.delete(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid task ID')]),
  deleteTask
);

export default router;

