import api from './api';
import { Invitation } from '@/types';

export const invitationService = {
  async getInvitations(): Promise<Invitation[]> {
    const response = await api.get('/invitations');
    return response.data.invitations;
  },

  async acceptInvitation(id: string): Promise<void> {
    await api.post(`/invitations/${id}/accept`);
  },

  async rejectInvitation(id: string): Promise<void> {
    await api.post(`/invitations/${id}/reject`);
  },
};

