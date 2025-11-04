import api from './api';
import { Task, TaskStatus } from '@/types';

export const taskService = {
  async createTask(data: {
    projectId: string;
    name: string;
    duration: number;
    dependencies?: string[];
    assignedTo?: string[];
  }): Promise<Task> {
    const response = await api.post('/tasks', data);
    return response.data.task;
  },

  async getTasks(projectId: string): Promise<Task[]> {
    const response = await api.get('/tasks', { params: { projectId } });
    return response.data.tasks;
  },

  async getTask(id: string): Promise<Task> {
    const response = await api.get(`/tasks/${id}`);
    return response.data.task;
  },

  async updateTask(
    id: string,
    data: {
      name?: string;
      duration?: number;
      dependencies?: string[];
      assignedTo?: string[];
      status?: TaskStatus;
    }
  ): Promise<Task> {
    const response = await api.patch(`/tasks/${id}`, data);
    return response.data.task;
  },

  async deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },
};

