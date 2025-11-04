import { Router } from 'express';
import { param, query } from 'express-validator';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById,
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  ]),
  getNotifications
);

// Mark notification as read
router.patch(
  '/:id/read',
  validate([param('id').isMongoId().withMessage('Invalid notification ID')]),
  markNotificationAsRead
);

// Mark all as read
router.patch('/read-all', markAllNotificationsAsRead);

// Delete notification
router.delete(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid notification ID')]),
  deleteNotificationById
);

export default router;

