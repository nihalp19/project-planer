import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createProject,
  getProjects,
  getMyProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../controllers/projectController';
import { recalculateSchedule } from '../controllers/taskController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { checkProjectAccess } from '../middleware/roleCheck';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create project
router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Project name is required'),
    body('description').optional().trim(),
    body('teamId').optional().isMongoId().withMessage('Valid team ID is required'),
    body('startDate').optional().isISO8601().withMessage('Invalid date format'),
  ]),
  createProject
);

// Get all user's projects (across all teams)
router.get('/my-projects', getMyProjects);

// Get projects by team
router.get(
  '/',
  validate([query('teamId').isMongoId().withMessage('Valid team ID is required')]),
  getProjects
);

// Get project by ID
router.get(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid project ID')]),
  checkProjectAccess,
  getProjectById
);

// Update project
router.patch(
  '/:id',
  validate([
    param('id').isMongoId().withMessage('Invalid project ID'),
    body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty'),
    body('description').optional().trim(),
    body('startDate').optional().isISO8601().withMessage('Invalid date format'),
  ]),
  checkProjectAccess,
  updateProject
);

// Delete project
router.delete(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid project ID')]),
  checkProjectAccess,
  deleteProject
);

// Recalculate schedule
router.post(
  '/:id/calculate-schedule',
  validate([param('id').isMongoId().withMessage('Invalid project ID')]),
  checkProjectAccess,
  recalculateSchedule
);

export default router;

