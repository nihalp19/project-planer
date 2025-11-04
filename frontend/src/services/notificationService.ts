import api from './api';
import { Notification, PaginationInfo } from '@/types';

export const notificationService = {
  async getNotifications(
    page = 1,
    limit = 20
  ): Promise<{ notifications: Notification[]; pagination: PaginationInfo; unreadCount: number }> {
    const response = await api.get('/notifications', { params: { page, limit } });
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};

