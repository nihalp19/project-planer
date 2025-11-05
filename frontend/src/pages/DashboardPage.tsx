import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Folder, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '@/services/projectService';
import { teamService } from '@/services/teamService';
import { Button, Card, Loading, Modal, Input } from '@/components/common';
import { formatRelative } from '@/utils/dateUtils';
import { Project } from '@/types';
import { useToastStore } from '@/stores/toastStore';
import { useSocketStore } from '@/stores/socketStore';

const DashboardPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { on, off, emit, isConnected } = useSocketStore();
  const queryClient = useQueryClient();

  // Fetch all projects
  const { data: projects, isLoading: loadingProjects, refetch } = useQuery({
    queryKey: ['my-projects'],
    queryFn: () => projectService.getMyProjects(),
  });

  // Fetch all teams (to join their rooms)
  const { data: teams, refetch: refetchTeams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => teamService.getAllTeams(),
  });

  // Join all team rooms to receive project updates
  useEffect(() => {
    if (!isConnected || !teams || teams.length === 0) return;
    
    teams.forEach(team => {
      emit('join:team', team._id);
      console.log(`[Dashboard] Joined team room: ${team._id}`);
    });
    
    return () => {
      teams.forEach(team => {
        emit('leave:team', team._id);
        console.log(`[Dashboard] Left team room: ${team._id}`);
      });
    };
  }, [isConnected, teams, emit]);

  // Listen for real-time team membership changes
  useEffect(() => {
    if (!isConnected) return;

    const handleTeamJoined = (data: { teamId: string; team: any }) => {
      console.log('[Dashboard] Team joined:', data);
      
      // Join the new team room
      emit('join:team', data.teamId);
      
      // Refresh teams list and projects list
      refetchTeams();
      refetch();
      
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      
      addToast({
        message: `You joined ${data.team.name}! Projects are now available.`,
        type: 'success',
      });
    };

    const handleTeamLeft = (data: { teamId: string; teamName: string }) => {
      console.log('[Dashboard] Team left:', data);
      
      // Leave the team room
      emit('leave:team', data.teamId);
      
      // Immediately remove all projects from this team from cache
      queryClient.setQueryData(['my-projects'], (oldData: Project[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(project => {
          // Handle both string and object team references
          const projectTeamId = typeof project.team === 'string' 
            ? project.team 
            : project.team?._id;
          return projectTeamId !== data.teamId;
        });
      });
      
      // Refresh teams list and projects list
      refetchTeams();
      refetch();
      
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      
      addToast({
        message: `You were removed from ${data.teamName}.`,
        type: 'info',
      });
    };

    const handleProjectAccessRevoked = (data: { 
      projectId: string; 
      projectName: string; 
      teamId: string;
      teamName: string;
    }) => {
      console.log('[Dashboard] Project access revoked:', data);
      
      // Remove project from cache immediately
      queryClient.setQueryData(['my-projects'], (oldData: Project[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(project => project._id !== data.projectId);
      });
      
      addToast({
        message: `Access to "${data.projectName}" has been revoked.`,
        type: 'info',
      });

      // Ensure fresh list
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
    };

    const handleTaskAssigned = (data: {
      taskId: string;
      taskName: string;
      projectId: string;
      projectName: string;
      assignedBy: string;
      assignedByEmail: string;
    }) => {
      console.log('[Dashboard] Task assigned to you:', data);
      
      // Show toast notification
      addToast({
        message: `${data.assignedBy} assigned you to "${data.taskName}" in ${data.projectName}`,
        type: 'success',
      });
    };

    on('team:joined', handleTeamJoined);
    on('team:left', handleTeamLeft);
    on('project:access_revoked', handleProjectAccessRevoked);
    on('task:assigned', handleTaskAssigned);

    // Team-level task updates: ensure dashboards stay fresh if any list depends on them later
    const handleTeamTaskEvent = (data: { projectId: string }) => {
      // Invalidate potential caches tied to this project
      queryClient.invalidateQueries({ queryKey: ['tasks', data.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
    };
    on('task:created', handleTeamTaskEvent);
    on('task:updated', handleTeamTaskEvent);
    on('task:deleted', handleTeamTaskEvent);

    return () => {
      off('team:joined', handleTeamJoined);
      off('team:left', handleTeamLeft);
      off('project:access_revoked', handleProjectAccessRevoked);
      off('task:assigned', handleTaskAssigned);
      off('task:created', handleTeamTaskEvent);
      off('task:updated', handleTeamTaskEvent);
      off('task:deleted', handleTeamTaskEvent);
    };
  }, [isConnected, on, off, emit, refetchTeams, refetch, queryClient, addToast]);

  // Listen for real-time project updates
  useEffect(() => {
    if (!isConnected) return;

    const handleProjectCreated = (data: { project: Project }) => {
      console.log('[Socket] Project created:', data);
      // Add project to cache immediately if it belongs to a team we're in
      queryClient.setQueryData(['my-projects'], (oldData: Project[] | undefined) => {
        if (!oldData) return [data.project];
        // Check if project already exists
        if (oldData.some(p => p._id === data.project._id)) return oldData;
        return [data.project, ...oldData];
      });
      refetch();
    };

    const handleProjectUpdated = (data: { project: Project }) => {
      console.log('[Socket] Project updated:', data);
      // Update project in cache
      queryClient.setQueryData(['my-projects'], (oldData: Project[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(project => 
          project._id === data.project._id ? data.project : project
        );
      });
      refetch();
    };

    const handleProjectDeleted = (data: { projectId: string }) => {
      console.log('[Socket] Project deleted:', data);
      // Remove project from cache
      queryClient.setQueryData(['my-projects'], (oldData: Project[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(project => project._id !== data.projectId);
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
    };

    on('project:created', handleProjectCreated);
    on('project:updated', handleProjectUpdated);
    on('project:deleted', handleProjectDeleted);

    return () => {
      off('project:created', handleProjectCreated);
      off('project:updated', handleProjectUpdated);
      off('project:deleted', handleProjectDeleted);
    };
  }, [isConnected, on, off, refetch, queryClient]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('[Frontend] Creating project:', { projectName, projectDescription });

    setCreating(true);

    try {
      const result = await projectService.createProject({
        name: projectName,
        description: projectDescription,
      });
      console.log('[Frontend] Project created successfully:', result);
      
      addToast({
        message: 'Project created successfully!',
        type: 'success',
      });
      
      setShowCreateModal(false);
      setProjectName('');
      setProjectDescription('');
      refetch();
    } catch (error: any) {
      console.error('[Frontend] Failed to create project:', error);
      console.error('[Frontend] Error response:', error?.response);
      console.error('[Frontend] Error response data:', error?.response?.data);
      
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create project. Please try again.';
      
      addToast({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const getTeamName = (project: Project): string => {
    if (typeof project.team === 'string') return 'Unknown Team';
    return project.team.isPersonal ? 'Personal' : project.team.name;
  };

  if (loadingProjects) {
    return <Loading fullScreen />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Projects
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage and track your projects
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {projects.map((project: Project, index: number) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card hover onClick={() => navigate(`/projects/${project._id}`)}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {project.name}
                    </h3>
                    <Folder className="w-5 h-5 text-primary-600" />
                  </div>
                  {project.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{getTeamName(project)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Created {formatRelative(project.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 mb-8">
          <Folder className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No projects yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create your first project to get started
          </p>
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
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
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DashboardPage;
