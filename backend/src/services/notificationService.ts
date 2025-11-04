import { Notification } from '../models';
import { NotificationType, EntityType } from '../types';
import { Types } from 'mongoose';
import { emitToUser } from '../socket';

interface CreateNotificationParams {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: EntityType;
  entityId?: string | Types.ObjectId;
}

export const createNotification = async (params: CreateNotificationParams) => {
  const { userId, type, title, message, entityType, entityId } = params;

  const notification = await Notification.create({
    user: userId,
    type,
    title,
    message,
    relatedEntity: entityType && entityId ? {
      entityType,
      entityId,
    } : undefined,
    isRead: false,
  });

  // Emit real-time event to the user
  emitToUser(userId.toString(), 'notification:new', { notification });
  console.log(`[Notification] Emitted to user ${userId}:`, type);

  return notification;
};

export const getUnreadCount = async (userId: string | Types.ObjectId): Promise<number> => {
  return await Notification.countDocuments({
    user: userId,
    isRead: false,
  });
};

export const markAsRead = async (notificationId: string | Types.ObjectId): Promise<void> => {
  await Notification.findByIdAndUpdate(notificationId, { isRead: true });
};

export const markAllAsRead = async (userId: string | Types.ObjectId): Promise<void> => {
  await Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true }
  );
};

export const deleteNotification = async (notificationId: string | Types.ObjectId): Promise<void> => {
  await Notification.findByIdAndDelete(notificationId);
};

