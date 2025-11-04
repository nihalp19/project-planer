import { Router } from 'express';
import { body } from 'express-validator';
import {
  searchUsers,
  getProfile,
  updateProfile,
  updatePreferences,
} from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Search users
router.get('/search', searchUsers);

// Get profile
router.get('/profile', getProfile);

// Update profile
router.patch(
  '/profile',
  validate([
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  ]),
  updateProfile
);

// Update preferences
router.patch(
  '/preferences',
  validate([
    body('theme').optional().isIn(['light', 'dark']).withMessage('Theme must be light or dark'),
  ]),
  updatePreferences
);

export default router;

