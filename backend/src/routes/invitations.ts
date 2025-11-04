import { Router } from 'express';
import { param } from 'express-validator';
import {
  getInvitations,
  acceptInvitation,
  rejectInvitation,
} from '../controllers/invitationController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's invitations
router.get('/', getInvitations);

// Accept invitation
router.post(
  '/:id/accept',
  validate([param('id').isMongoId().withMessage('Invalid invitation ID')]),
  acceptInvitation
);

// Reject invitation
router.post(
  '/:id/reject',
  validate([param('id').isMongoId().withMessage('Invalid invitation ID')]),
  rejectInvitation
);

export default router;

