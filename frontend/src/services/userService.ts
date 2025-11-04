import api from './api';
import { User } from '@/types';

export const userService = {
  async updateProfile(data: { name?: string; avatar?: string }): Promise<User> {
    const response = await api.patch('/users/profile', data);
    return response.data.user;
  },

  async updatePreferences(data: { theme?: 'light' | 'dark' }): Promise<{ theme: string }> {
    const response = await api.patch('/users/preferences', data);
    return response.data.preferences;
  },

  async searchUsers(query: string): Promise<User[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const response = await api.get('/users/search', { params: { q: query } });
    return response.data.users;
  },
};

