import api from './api';
import { Project } from '@/types';

export const projectService = {
  async createProject(data: {
    name: string;
    description?: string;
    teamId?: string;
    startDate?: string;
  }): Promise<Project> {
    const response = await api.post('/projects', data);
    return response.data.project;
  },

  async getMyProjects(): Promise<Project[]> {
    const response = await api.get('/projects/my-projects');
    return response.data.projects;
  },

  async getProjects(teamId: string): Promise<Project[]> {
    const response = await api.get('/projects', { params: { teamId } });
    return response.data.projects;
  },

  async getProject(id: string): Promise<Project> {
    const response = await api.get(`/projects/${id}`);
    return response.data.project;
  },

  async updateProject(
    id: string,
    data: { name?: string; description?: string; startDate?: string }
  ): Promise<Project> {
    const response = await api.patch(`/projects/${id}`, data);
    return response.data.project;
  },

  async deleteProject(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async recalculateSchedule(id: string): Promise<void> {
    await api.post(`/projects/${id}/calculate-schedule`);
  },
};

