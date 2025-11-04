import api from './api';
import { Team } from '@/types';

export const teamService = {
  async createTeam(name: string, description?: string): Promise<Team> {
    const response = await api.post('/teams', { name, description });
    return response.data.team;
  },

  async getTeams(): Promise<Team[]> {
    const response = await api.get('/teams');
    return response.data.teams;
  },

  async getAllTeams(): Promise<Team[]> {
    // Get all teams including personal workspaces
    const response = await api.get('/teams', { params: { includePersonal: 'true' } });
    return response.data.teams;
  },

  async getPersonalWorkspace(): Promise<Team> {
    const response = await api.get('/teams/personal-workspace');
    return response.data.team;
  },

  async getTeam(id: string): Promise<Team> {
    const response = await api.get(`/teams/${id}`);
    return response.data.team;
  },

  async updateTeam(id: string, data: { name?: string; description?: string }): Promise<Team> {
    const response = await api.patch(`/teams/${id}`, data);
    return response.data.team;
  },

  async deleteTeam(id: string): Promise<void> {
    await api.delete(`/teams/${id}`);
  },

  async inviteMember(teamId: string, email: string): Promise<void> {
    await api.post(`/teams/${teamId}/invite`, { email });
  },

  async changeMemberRole(teamId: string, userId: string, role: string): Promise<Team> {
    const response = await api.patch(`/teams/${teamId}/members/${userId}/role`, { role });
    return response.data.team;
  },

  async removeMember(teamId: string, userId: string): Promise<Team> {
    const response = await api.delete(`/teams/${teamId}/members/${userId}`);
    return response.data.team;
  },
};

