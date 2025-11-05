import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FolderKanban, UserPlus } from 'lucide-react';
import { teamService } from '@/services/teamService';
import { projectService } from '@/services/projectService';
import { useSocketStore } from '@/stores/socketStore';
import { Button, Card, Loading, Modal, Input } from '@/components/common';
import { formatRelative } from '@/utils/dateUtils';
import { toast } from 'react-hot-toast'; // Add toast for notifications

const TeamPage = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isConnected, on, off, emit } = useSocketStore();
  
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const { 
    data: team, 
    isLoading: loadingTeam,
    error: teamError
  } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamService.getTeam(teamId!),
    enabled: !!teamId,
  });

  const { 
    data: projects, 
    isLoading: loadingProjects,
    error: projectsError
  } = useQuery({
    queryKey: ['projects', teamId],
    queryFn: () => projectService.getProjects(teamId!),
    enabled: !!teamId,
  });

  // Join team room when component mounts and teamId is available
  useEffect(() => {
    if (teamId && isConnected) {
      emit('join:team', teamId);
      console.log(`✅ Joined team room: ${teamId}`);
    }
  }, [teamId, isConnected, emit]);

  // Set up real-time listeners for team and project updates
  useEffect(() => {
    if (!teamId || !isConnected) return;

    console.log('🔊 Setting up socket listeners for team:', teamId);

    // Listen for member joined events
    const handleMemberJoined = (data: { teamId: string; member: any }) => {
      console.log('🆕 Member joined team:', data);
      if (data.teamId === teamId) {
        queryClient.setQueryData(['team', teamId], (oldData: any) => {
          if (!oldData) return oldData;
          
          // Check if member already exists to avoid duplicates
          const memberExists = oldData.members?.some((m: any) => 
            m._id === data.member._id || m.user?._id === data.member.user?._id
          );
          
          if (memberExists) return oldData;
          
          return {
            ...oldData,
            members: [...(oldData.members || []), data.member]
          };
        });
      }
    };

    // Listen for team updates
    const handleTeamUpdated = (updatedTeam: any) => {
      console.log('🔄 Team updated:', updatedTeam);
      if (updatedTeam._id === teamId) {
        queryClient.setQueryData(['team', teamId], updatedTeam);
      }
    };

    // Listen for member role changes
    const handleMemberRoleChanged = (data: { teamId: string; userId: string; newRole: string }) => {
      console.log('🎭 Member role changed:', data);
      if (data.teamId === teamId) {
        queryClient.setQueryData(['team', teamId], (oldData: any) => {
          if (!oldData?.members) return oldData;
          
          return {
            ...oldData,
            members: oldData.members.map((member: any) => 
              member.user?._id === data.userId 
                ? { ...member, role: data.newRole }
                : member
            )
          };
        });
      }
    };

    // Listen for member removed
    const handleMemberRemoved = (data: { teamId: string; removedUserId: string }) => {
      console.log('❌ Member removed:', data);
      if (data.teamId === teamId) {
        queryClient.setQueryData(['team', teamId], (oldData: any) => {
          if (!oldData?.members) return oldData;
          
          return {
            ...oldData,
            members: oldData.members.filter((member: any) => 
              member.user?._id !== data.removedUserId
            )
          };
        });
      }
    };

    // Listen for team deletion
    const handleTeamDeleted = (data: { teamId: string }) => {
      console.log('🗑️ Team deleted:', data);
      if (data.teamId === teamId) {
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        navigate('/teams');
      }
    };

    // PROJECT REAL-TIME LISTENERS
    const handleProjectCreated = (newProject: any) => {
      console.log('🆕 Project created:', newProject);
      if (newProject.teamId === teamId) {
        queryClient.setQueryData(['projects', teamId], (oldData: any) => {
          if (!oldData) return [newProject];
          
          // Check if project already exists to avoid duplicates
          const projectExists = oldData.some((p: any) => p._id === newProject._id);
          if (projectExists) return oldData;
          
          return [newProject, ...oldData];
        });
      }
    };

    const handleProjectUpdated = (updatedProject: any) => {
      console.log('🔄 Project updated:', updatedProject);
      if (updatedProject.teamId === teamId) {
        queryClient.setQueryData(['projects', teamId], (oldData: any) => {
          if (!oldData) return [updatedProject];
          
          return oldData.map((project: any) =>
            project._id === updatedProject._id ? updatedProject : project
          );
        });
      }
    };

    const handleProjectDeleted = (data: { projectId: string; teamId: string }) => {
      console.log('🗑️ Project deleted:', data);
      if (data.teamId === teamId) {
        queryClient.setQueryData(['projects', teamId], (oldData: any) => {
          if (!oldData) return [];
          
          return oldData.filter((project: any) => project._id !== data.projectId);
        });
      }
    };

    // INVITATION REAL-TIME LISTENERS
    const handleInvitationSent = (data: { 
      teamId: string; 
      invitation: any; 
      invitedBy: string;
    }) => {
      console.log('📧 Invitation sent:', data);
      if (data.teamId === teamId) {
        toast.success(`Invitation sent to ${data.invitation.email}`);
        console.log('✅ Invitation sent successfully in real-time');
      }
    };

    const handleInvitationAccepted = (data: { 
      teamId: string; 
      member: any;
    }) => {
      console.log('✅ Invitation accepted:', data);
      if (data.teamId === teamId) {
        // Update team members list immediately
        queryClient.setQueryData(['team', teamId], (oldData: any) => {
          if (!oldData) return oldData;
          
          // Check if member already exists
          const memberExists = oldData.members?.some((m: any) => 
            m._id === data.member._id || m.user?._id === data.member.user?._id
          );
          
          if (memberExists) return oldData;
          
          return {
            ...oldData,
            members: [...(oldData.members || []), data.member]
          };
        });
        
        toast.success(`${data.member.user.name} joined the team!`);
      }
    };

    const handleInvitationDeclined = (data: { 
      teamId: string; 
      invitationId: string;
    }) => {
      console.log('❌ Invitation declined:', data);
      if (data.teamId === teamId) {
        toast.error('Invitation was declined');
        console.log('Invitation was declined');
      }
    };

    // Subscribe to team events
    on('team:member_joined', handleMemberJoined);
    on('team:updated', handleTeamUpdated);
    on('team:member_role_changed', handleMemberRoleChanged);
    on('team:member_removed', handleMemberRemoved);
    on('team:deleted', handleTeamDeleted);

    // Subscribe to project events
    on('project:created', handleProjectCreated);
    on('project:updated', handleProjectUpdated);
    on('project:deleted', handleProjectDeleted);

    // Subscribe to invitation events
    on('team:invitation_sent', handleInvitationSent);
    on('team:invitation_accepted', handleInvitationAccepted);
    on('team:invitation_declined', handleInvitationDeclined);

    return () => {
      console.log('🧹 Cleaning up socket listeners for team:', teamId);
      // Team events
      off('team:member_joined', handleMemberJoined);
      off('team:updated', handleTeamUpdated);
      off('team:member_role_changed', handleMemberRoleChanged);
      off('team:member_removed', handleMemberRemoved);
      off('team:deleted', handleTeamDeleted);
      
      // Project events
      off('project:created', handleProjectCreated);
      off('project:updated', handleProjectUpdated);
      off('project:deleted', handleProjectDeleted);
      
      // Invitation events cleanup
      off('team:invitation_sent', handleInvitationSent);
      off('team:invitation_accepted', handleInvitationAccepted);
      off('team:invitation_declined', handleInvitationDeclined);
    };
  }, [teamId, isConnected, on, off, queryClient, navigate]);

  // Leave team room when component unmounts
  useEffect(() => {
    return () => {
      if (teamId && isConnected) {
        emit('leave:team', teamId);
        console.log(`🚪 Left team room: ${teamId}`);
      }
    };
  }, [teamId, isConnected, emit]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    
    setCreating(true);

    try {
      const newProject = await projectService.createProject({
        name: projectName,
        description: projectDescription,
        teamId: teamId!,
      });
      
      // The real-time event should handle the UI update, but we can also update locally
      queryClient.setQueryData(['projects', teamId], (oldData: any) => {
        if (!oldData) return [newProject];
        return [newProject, ...oldData];
      });
      
      setShowCreateProject(false);
      setProjectName('');
      setProjectDescription('');
      toast.success('Project created successfully!');
    } catch (error: any) {
      console.error('Failed to create project:', error);
      toast.error(error.response?.data?.error || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    setInviting(true);

    try {
      await teamService.inviteMember(teamId!, inviteEmail);
      setShowInviteMember(false);
      setInviteEmail('');
      console.log('✅ Invitation sent successfully');
      
      // The real-time event will show the toast, but we can show immediate feedback too
      toast.success(`Sending invitation to ${inviteEmail}...`);
    } catch (error: any) {
      console.error('Failed to invite member:', error);
      toast.error(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  // Add error handling
  if (teamError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Error loading team
          </h2>
          <Button 
            onClick={() => navigate('/teams')} 
            className="mt-4"
          >
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  if (loadingTeam || loadingProjects) {
    return <Loading fullScreen />;
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Team not found
          </h2>
          <Button 
            onClick={() => navigate('/teams')} 
            className="mt-4"
          >
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {team.name}
            </h1>
            {team.description && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {team.description}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={() => setShowInviteMember(true)}
            >
              <UserPlus className="w-5 h-5" />
              Invite Member
            </Button>
            <Button onClick={() => setShowCreateProject(true)}>
              <Plus className="w-5 h-5" />
              New Project
            </Button>
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {team.members?.length || 0}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {projects?.length || 0}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatRelative(team.createdAt)}
              </p>
            </div>
          </Card>
        </div>

        {/* Members List */}
        {team.members && team.members.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Team Members ({team.members.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {team.members.map((member: any) => (
                <motion.div
                  key={member._id || member.user?._id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {member.user?.avatar ? (
                      <img 
                        src={member.user.avatar} 
                        alt={member.user?.name} 
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-medium">
                        {(member.user?.name || member.user?.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {member.user?.name || member.user?.email}
                    </span>
                  </div>
                  {member.role === 'owner' && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      Owner
                    </span>
                  )}
                  {member.role === 'admin' && (
                    <span className="text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                      Admin
                    </span>
                  )}
                  {member.role === 'editor' && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                      Editor
                    </span>
                  )}
                  {member.role === 'viewer' && (
                    <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                      Viewer
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Projects
        </h2>
        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  hover 
                  onClick={() => navigate(`/projects/${project._id}`)}
                  className="cursor-pointer h-full"
                >
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {project.name}
                      </h3>
                    </div>
                    {project.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-grow">
                        {project.description}
                      </p>
                    )}
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-auto">
                      Created {formatRelative(project.createdAt)}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <FolderKanban className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No projects yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first project to get started
            </p>
            <Button onClick={() => setShowCreateProject(true)}>
              <Plus className="w-5 h-5" />
              New Project
            </Button>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        title="Create New Project"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Enter project description"
              rows={3}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateProject(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invite Member Modal */}
      <Modal
        isOpen={showInviteMember}
        onClose={() => setShowInviteMember(false)}
        title="Invite Team Member"
      >
        <form onSubmit={handleInviteMember} className="space-y-4">
          <Input
            type="email"
            label="Email Address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
          />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            They will receive an email invitation to join this team.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowInviteMember(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={inviting}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeamPage;