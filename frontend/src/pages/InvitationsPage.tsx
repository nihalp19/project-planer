// InvitationsPage.tsx - Updated version
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Mail, Check, X, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { invitationService } from '@/services/invitationService';
import { Button, Card, Loading, Avatar } from '@/components/common';
import { formatRelative } from '@/utils/dateUtils';
import { useToastStore } from '@/stores/toastStore';
import { useSocketStore } from '@/stores/socketStore';
import { useState, useEffect } from 'react';

const InvitationsPage = () => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const queryClient = useQueryClient();
  const { on, off, emit, isConnected } = useSocketStore();

  const { data: invitations, isLoading, refetch } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationService.getInvitations(),
  });

  // Listen for team:joined event when user accepts invitation
  useEffect(() => {
    if (!isConnected) return;

    const handleTeamJoined = (data: { teamId: string; team: any }) => {
      console.log('[Invitations] Team joined via socket:', data);
      
      // Join the team room immediately
      emit('join:team', data.teamId);
      
      // Invalidate queries to refresh teams and projects
      queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      
      // Show success message
      addToast({
        message: `Joined ${data.team.name}! You can now see projects from this team.`,
        type: 'success',
      });
    };

    on('team:joined', handleTeamJoined);

    return () => {
      off('team:joined', handleTeamJoined);
    };
  }, [isConnected, on, off, emit, queryClient, addToast]);

  const handleAccept = async (id: string) => {
    setProcessingId(id);
    try {
      await invitationService.acceptInvitation(id);
      
      // The socket event handler will handle the UI updates and toast
      // But we still refresh invitations list
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Navigate to dashboard after short delay to show the toast
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      
      const errorMessage = error?.response?.data?.message || 'Failed to accept invitation. Please try again.';
      addToast({
        message: errorMessage,
        type: 'error',
      });
      
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await invitationService.rejectInvitation(id);
      
      addToast({
        message: 'Invitation declined',
        type: 'info',
      });
      
      // ✅ FIX: Refresh both invitations and notifications
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      ]);
    } catch (error: any) {
      console.error('Failed to reject invitation:', error);
      
      const errorMessage = error?.response?.data?.message || 'Failed to reject invitation. Please try again.';
      addToast({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Team Invitations
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {invitations && invitations.length > 0
            ? `You have ${invitations.length} pending invitation${invitations.length > 1 ? 's' : ''}`
            : 'No pending invitations'}
        </p>
      </motion.div>

      {/* Invitations List */}
      {invitations && invitations.length > 0 ? (
        <div className="space-y-4">
          {invitations.map((invitation, index) => (
            <motion.div
              key={invitation._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Avatar */}
                      {typeof invitation.invitedBy === 'object' ? (
                        <Avatar user={invitation.invitedBy} size="lg" />
                      ) : (
                        <div className="flex-shrink-0 w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {typeof invitation.team === 'object' 
                            ? invitation.team.name 
                            : 'Team Invitation'}
                        </h3>
                        
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          {typeof invitation.team === 'object' && invitation.team.description && (
                            <p className="line-clamp-2">{invitation.team.description}</p>
                          )}
                          
                          <p className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            Invited by{' '}
                            <span className="font-medium">
                              {typeof invitation.invitedBy === 'object'
                                ? invitation.invitedBy.name
                                : 'Team member'}
                            </span>
                          </p>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {formatRelative(invitation.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAccept(invitation._id)}
                        loading={processingId === invitation._id}
                        disabled={processingId !== null}
                      >
                        <Check className="w-4 h-4" />
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(invitation._id)}
                        disabled={processingId !== null}
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="p-12 text-center">
            <Mail className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No pending invitations
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              When someone invites you to join their team, you'll see it here
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default InvitationsPage;

