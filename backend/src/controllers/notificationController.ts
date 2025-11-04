import { Response } from 'express';
import { Notification } from '../models';
import { AuthRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { markAsRead, markAllAsRead, deleteNotification } from '../services/notificationService';

// Get notifications
export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { page = 1, limit = 20 } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const notifications = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  const total = await Notification.countDocuments({ user: userId });
  const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

  res.json({
    notifications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
    unreadCount,
  });
});

// Mark notification as read
export const markNotificationAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const notification = await Notification.findById(id);

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  // Verify notification belongs to user
  if (notification.user.toString() !== userId) {
    throw new AppError('Access denied', 403);
  }

  await markAsRead(id);

  res.json({ message: 'Notification marked as read' });
});

// Mark all notifications as read
export const markAllNotificationsAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  await markAllAsRead(userId);

  res.json({ message: 'All notifications marked as read' });
});

// Delete notification
export const deleteNotificationById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const notification = await Notification.findById(id);

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  // Verify notification belongs to user
  if (notification.user.toString() !== userId) {
    throw new AppError('Access denied', 403);
  }

  await deleteNotification(id);

  res.json({ message: 'Notification deleted' });
});

