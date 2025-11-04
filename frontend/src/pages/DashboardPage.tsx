import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const { socket, on, off } = useSocketStore();

  // Fetch all projects
  const { data: projects, isLoading: loadingProjects, refetch } = useQuery({
    queryKey: ['my-projects'],
    queryFn: () => projectService.getMyProjects(),
  });

  // Fetch all teams (to join their rooms)
  const { data: teams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => teamService.getAllTeams(),
  });

  // Join all team rooms to receive project updates
  useEffect(() => {
    if (!socket || !teams || teams.length === 0) return;
    
    teams.forEach(team => {
      socket.emit('join:team', team._id);
      console.log(`[Dashboard] Joined team room: ${team._id}`);
    });
    
    return () => {
      teams.forEach(team => {
        socket.emit('leave:team', team._id);
        console.log(`[Dashboard] Left team room: ${team._id}`);
      });
    };
  }, [socket, teams]);

  // Listen for real-time project updates
  useEffect(() => {
    const handleProjectCreated = () => {
      console.log('[Socket] Project created, refetching projects...');
      refetch();
    };

    const handleProjectUpdated = () => {
      console.log('[Socket] Project updated, refetching projects...');
      refetch();
    };

    const handleProjectDeleted = () => {
      console.log('[Socket] Project deleted, refetching projects...');
      refetch();
    };

    on('project:created', handleProjectCreated);
    on('project:updated', handleProjectUpdated);
    on('project:deleted', handleProjectDeleted);

    return () => {
      off('project:created', handleProjectCreated);
      off('project:updated', handleProjectUpdated);
      off('project:deleted', handleProjectDeleted);
    };
  }, [on, off, refetch]);

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
