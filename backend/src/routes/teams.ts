import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createTeam,
  getTeams,
  getPersonalWorkspace,
  getTeamById,
  updateTeam,
  deleteTeam,
  inviteMember,
  changeMemberRole,
  removeMember,
} from '../controllers/teamController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { checkTeamRole } from '../middleware/roleCheck';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create team
router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Team name is required'),
    body('description').optional().trim(),
  ]),
  createTeam
);

// Get user's teams
router.get('/', getTeams);

// Get user's personal workspace (MUST be before /:id route)
router.get('/personal-workspace', getPersonalWorkspace);

// Get team by ID
router.get('/:id', validate([param('id').isMongoId().withMessage('Invalid team ID')]), getTeamById);

// Update team
router.patch(
  '/:id',
  checkTeamRole(['owner', 'admin']),
  validate([
    param('id').isMongoId().withMessage('Invalid team ID'),
    body('name').optional().trim().notEmpty().withMessage('Team name cannot be empty'),
    body('description').optional().trim(),
  ]),
  updateTeam
);

// Delete team
router.delete(
  '/:id',
  checkTeamRole(['owner']),
  validate([param('id').isMongoId().withMessage('Invalid team ID')]),
  deleteTeam
);

// Invite member
router.post(
  '/:id/invite',
  checkTeamRole(['owner', 'admin']),
  validate([
    param('id').isMongoId().withMessage('Invalid team ID'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ]),
  inviteMember
);

// Change member role
router.patch(
  '/:id/members/:userId/role',
  checkTeamRole(['owner', 'admin']),
  validate([
    param('id').isMongoId().withMessage('Invalid team ID'),
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('role')
      .isIn(['owner', 'admin', 'editor', 'viewer'])
      .withMessage('Invalid role'),
  ]),
  changeMemberRole
);

// Remove member
router.delete(
  '/:id/members/:userId',
  checkTeamRole(['owner', 'admin']),
  validate([
    param('id').isMongoId().withMessage('Invalid team ID'),
    param('userId').isMongoId().withMessage('Invalid user ID'),
  ]),
  removeMember
);

export default router;

