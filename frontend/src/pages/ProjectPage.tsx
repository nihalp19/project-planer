import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Calendar, RefreshCw, Edit2, Trash2, Settings, Users, UserPlus, Mail } from 'lucide-react';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { projectService } from '@/services/projectService';
import { taskService } from '@/services/taskService';
import { teamService } from '@/services/teamService';
import { userService } from '@/services/userService';
import { Button, Loading, Modal, Input, Select, ConfirmDialog, Card, Avatar } from '@/components/common';
import { Task, TaskStatus, User } from '@/types';
import { useSocketStore } from '@/stores/socketStore';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';

const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { socket, on, off } = useSocketStore();
  const { addToast } = useToastStore();
  const { user: currentUser } = useAuthStore();
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [duration, setDuration] = useState('1');
  const [assignee, setAssignee] = useState('');
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const { data: project, isLoading: loadingProject, refetch: refetchProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks, isLoading: loadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskService.getTasks(projectId!),
    enabled: !!projectId,
  });

  // Fetch team info for member management
  const { data: team, refetch: refetchTeam } = useQuery({
    queryKey: ['team', project?.team],
    queryFn: () => {
      if (typeof project?.team === 'string') {
        return teamService.getTeam(project.team);
      } else if (project?.team?._id) {
        return teamService.getTeam(project.team._id);
      }
      return null;
    },
    enabled: !!project?.team,
  });

  // Join/leave project room and listen for real-time updates
  useEffect(() => {
    if (!socket || !projectId) return;

    // Join project room
    socket.emit('join:project', projectId);
    console.log(`[Socket] Joined project room: ${projectId}`);

    // Listen for real-time task events
    const handleTaskCreated = () => {
      console.log('[Socket] Task created, refetching tasks...');
      refetchTasks();
    };

    const handleTaskUpdated = () => {
      console.log('[Socket] Task updated, refetching tasks...');
      refetchTasks();
    };

    const handleTaskDeleted = () => {
      console.log('[Socket] Task deleted, refetching tasks...');
      refetchTasks();
    };

    // Listen for real-time project events
    const handleProjectUpdated = () => {
      console.log('[Socket] Project updated, refetching project...');
      refetchProject();
    };

    const handleProjectDeleted = () => {
      console.log('[Socket] Project deleted, navigating to dashboard...');
      addToast({
        message: 'This project has been deleted',
        type: 'info',
      });
      navigate('/dashboard');
    };

    on('task:created', handleTaskCreated);
    on('task:updated', handleTaskUpdated);
    on('task:deleted', handleTaskDeleted);
    on('project:updated', handleProjectUpdated);
    on('project:deleted', handleProjectDeleted);

    // Leave project room on unmount
    return () => {
      off('task:created', handleTaskCreated);
      off('task:updated', handleTaskUpdated);
      off('task:deleted', handleTaskDeleted);
      off('project:updated', handleProjectUpdated);
      off('project:deleted', handleProjectDeleted);
      
      socket.emit('leave:project', projectId);
      console.log(`[Socket] Left project room: ${projectId}`);
    };
  }, [socket, projectId, on, off, refetchTasks, refetchProject, navigate, addToast]);

  // Debounced user search
  useEffect(() => {
    if (!inviteEmail || inviteEmail.length < 2) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const results = await userService.searchUsers(inviteEmail);
        setUserSearchResults(results);
        setShowUserDropdown(results.length > 0);
      } catch (error) {
        console.error('Failed to search users:', error);
        setUserSearchResults([]);
        setShowUserDropdown(false);
      } finally {
        setSearchingUsers(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [inviteEmail]);

  // Team member management - permission checkers
  const canManageMembers = () => {
    if (!team || !currentUser) return false;
    const currentMember = team.members.find(m => 
      (typeof m.user === 'object' ? m.user._id : m.user) === currentUser._id
    );
    return currentMember?.role === 'owner' || currentMember?.role === 'admin';
  };

  const isOwner = (member: any) => {
    return team?.owner.toString() === 
      (typeof member.user === 'object' ? member.user._id : member.user);
  };

  // Add socket listeners for team events
  useEffect(() => {
    if (!socket || !team) return;
    
    socket.emit('join:team', team._id);
    console.log(`[Socket] Joined team room: ${team._id}`);
    
    const handleMemberRoleChanged = () => {
      console.log('[Socket] Member role changed, refetching team...');
      refetchTeam();
    };
    
    const handleMemberRemoved = (data: any) => {
      console.log('[Socket] Member removed:', data);
      if (data.removedUserId === currentUser?._id) {
        addToast({ 
          message: 'You have been removed from this team', 
          type: 'info' 
        });
        navigate('/dashboard');
      } else {
        refetchTeam();
      }
    };
    
    on('team:member_role_changed', handleMemberRoleChanged);
    on('team:member_removed', handleMemberRemoved);
    
    return () => {
      off('team:member_role_changed', handleMemberRoleChanged);
      off('team:member_removed', handleMemberRemoved);
      socket.emit('leave:team', team._id);
      console.log(`[Socket] Left team room: ${team._id}`);
    };
  }, [socket, team, on, off, refetchTeam, currentUser, navigate, addToast]);

  const handleCalculateSchedule = async () => {
    setCalculating(true);
    try {
      await projectService.recalculateSchedule(projectId!);
      await refetchTasks();
    } catch (error) {
      console.error('Failed to calculate schedule:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      await taskService.createTask({
        projectId: projectId!,
        name: taskName,
        duration: Number(duration),
        assignedTo: assignee ? [assignee] : undefined,
        dependencies: dependencies.length > 0 ? dependencies : undefined,
      });
      setShowCreateTask(false);
      setTaskName('');
      setTaskDescription('');
      setDuration('1');
      setAssignee('');
      setDependencies([]);
      
      // Auto-calculate schedule after creating task
      await refetchTasks();
      await handleCalculateSchedule();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskName(task.name);
    setDuration(task.duration.toString());
    setDependencies(
      Array.isArray(task.dependencies)
        ? task.dependencies
            .filter(dep => typeof dep === 'string')
            .map(dep => dep as string)
        : []
    );
    setShowEditTask(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setUpdating(true);

    try {
      await taskService.updateTask(editingTask._id, {
        name: taskName,
        duration: Number(duration),
        dependencies: dependencies.length > 0 ? dependencies : undefined,
      });
      setShowEditTask(false);
      setEditingTask(null);
      setTaskName('');
      setDuration('1');
      setDependencies([]);
      await refetchTasks();
      await handleCalculateSchedule();
    } catch (error) {
      console.error('Failed to update task:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      setDeletingTaskId(null);
      await refetchTasks();
      await handleCalculateSchedule();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await taskService.updateTask(taskId, { status: newStatus });
      await refetchTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleEditProjectClick = () => {
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || '');
      setShowEditProject(true);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);

    try {
      await projectService.updateProject(projectId!, {
        name: projectName,
        description: projectDescription,
      });
      setShowEditProject(false);
      await refetchProject();
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.deleteProject(projectId!);
      // Navigate to dashboard after deletion
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleSelectUser = (user: User) => {
    setInviteEmail(user.email);
    setShowUserDropdown(false);
    setUserSearchResults([]);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    
    setInviting(true);
    try {
      await teamService.inviteMember(team._id, inviteEmail);
      addToast({
        message: 'Invitation sent successfully!',
        type: 'success',
      });
      setShowInviteMember(false);
      setInviteEmail('');
      setUserSearchResults([]);
      setShowUserDropdown(false);
      refetchTeam();
    } catch (error: any) {
      console.error('Failed to invite member:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to send invitation';
      addToast({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!team) return;
    setChangingRoleUserId(userId);
    try {
      await teamService.changeMemberRole(team._id, userId, newRole);
      addToast({ message: 'Role updated successfully', type: 'success' });
      refetchTeam();
    } catch (error: any) {
      console.error('Failed to change role:', error);
      addToast({ 
        message: error?.response?.data?.message || 'Failed to update role', 
        type: 'error' 
      });
    } finally {
      setChangingRoleUserId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!team || !removingUserId) return;
    try {
      await teamService.removeMember(team._id, removingUserId);
      addToast({ message: 'Member removed successfully', type: 'success' });
      setShowRemoveConfirm(false);
      setRemovingUserId(null);
      refetchTeam();
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      addToast({ 
        message: error?.response?.data?.message || 'Failed to remove member', 
        type: 'error' 
      });
    }
  };

  // Convert tasks to Gantt format
  const ganttTasks: GanttTask[] = tasks && tasks.length > 0
    ? tasks
        .filter(task => task.actualStart && task.actualEnd)
        .map(task => ({
          id: task._id,
          name: task.name,
          start: new Date(task.actualStart!),
          end: new Date(task.actualEnd!),
          progress: task.status === 'completed' ? 100 : 
                    task.status === 'in-progress' ? 50 : 0,
          type: 'task' as const,
          dependencies: Array.isArray(task.dependencies)
            ? task.dependencies
                .filter(dep => typeof dep === 'string')
                .map(dep => dep as string)
            : [],
          styles: {
            backgroundColor: task.status === 'completed' 
              ? '#10b981' 
              : task.status === 'in-progress'
              ? '#3b82f6'
              : '#8b5cf6',
            backgroundSelectedColor: task.status === 'completed'
              ? '#059669'
              : task.status === 'in-progress'
              ? '#2563eb'
              : '#7c3aed',
          },
        }))
    : [];

  if (loadingProject || loadingTasks) {
    return <Loading fullScreen />;
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Project not found
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowTeamManagement(true)}>
            <Users className="w-5 h-5" />
            Team
          </Button>
          <Button variant="secondary" onClick={handleEditProjectClick}>
            <Settings className="w-5 h-5" />
            Settings
          </Button>
          <Button onClick={() => setShowCreateTask(true)}>
            <Plus className="w-5 h-5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Project Timeline
          </h2>
          <div className="flex items-center gap-3">
            {tasks && tasks.length > 0 && (
              <>
                {/* View Mode Selector */}
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setViewMode(ViewMode.Day)}
                    className={`px-3 py-1 text-sm font-medium transition-colors ${
                      viewMode === ViewMode.Day
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Day
                  </button>
                  <button
                    onClick={() => setViewMode(ViewMode.Week)}
                    className={`px-3 py-1 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-colors ${
                      viewMode === ViewMode.Week
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setViewMode(ViewMode.Month)}
                    className={`px-3 py-1 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-colors ${
                      viewMode === ViewMode.Month
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Month
                  </button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCalculateSchedule}
                  loading={calculating}
                >
                  <RefreshCw className="w-4 h-4" />
                  Recalculate
                </Button>
              </>
            )}
          </div>
        </div>

        {ganttTasks.length > 0 ? (
          <div className="gantt-container overflow-x-auto">
            <Gantt
              tasks={ganttTasks}
              viewMode={viewMode}
              locale="en"
              listCellWidth=""
              columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 65}
            />
          </div>
        ) : (
          <div className="h-96 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {tasks && tasks.length > 0 
                  ? 'Schedule not calculated yet'
                  : 'No tasks yet'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                {tasks && tasks.length > 0
                  ? 'Click "Recalculate" to generate the timeline'
                  : 'Create tasks to see the Gantt chart'}
              </p>
              {tasks && tasks.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={handleCalculateSchedule}
                  loading={calculating}
                >
                  <RefreshCw className="w-4 h-4" />
                  Calculate Schedule
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Tasks
        </h2>
        {tasks && tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {task.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>Duration: {task.duration} days</span>
                      {task.dependencies && task.dependencies.length > 0 && (
                        <span>Dependencies: {task.dependencies.length}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Dropdown */}
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task._id, e.target.value as TaskStatus)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${
                        task.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : task.status === 'in-progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEditTask(task)}
                      className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      title="Edit task"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeletingTaskId(task._id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              No tasks yet. Create your first task to get started.
            </p>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        title="Create New Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Task Name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Enter task name"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Enter task description"
              rows={3}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <Input
            type="number"
            label="Duration (days)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="1"
            required
          />
          {tasks && tasks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dependencies (Optional)
              </label>
              <Select
                label=""
                value=""
                onChange={(e) => {
                  if (e.target.value && !dependencies.includes(e.target.value)) {
                    setDependencies([...dependencies, e.target.value]);
                  }
                }}
                options={[
                  { value: '', label: 'Select a task...' },
                  ...tasks.map((task) => ({
                    value: task._id,
                    label: task.name,
                  })),
                ]}
              />
              {dependencies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {dependencies.map((depId) => {
                    const task = tasks.find((t) => t._id === depId);
                    return task ? (
                      <span
                        key={depId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 rounded text-sm"
                      >
                        {task.name}
                        <button
                          type="button"
                          onClick={() => setDependencies(dependencies.filter((id) => id !== depId))}
                          className="hover:text-primary-900 dark:hover:text-primary-300"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateTask(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={showEditTask}
        onClose={() => {
          setShowEditTask(false);
          setEditingTask(null);
          setTaskName('');
          setDuration('1');
          setDependencies([]);
        }}
        title="Edit Task"
      >
        <form onSubmit={handleUpdateTask} className="space-y-4">
          <Input
            label="Task Name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Enter task name"
            required
          />
          <Input
            type="number"
            label="Duration (days)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="1"
            required
          />
          {tasks && tasks.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dependencies (Optional)
              </label>
              <Select
                label=""
                value=""
                onChange={(e) => {
                  if (e.target.value && !dependencies.includes(e.target.value)) {
                    setDependencies([...dependencies, e.target.value]);
                  }
                }}
                options={[
                  { value: '', label: 'Select a task...' },
                  ...tasks
                    .filter(t => t._id !== editingTask?._id)
                    .map((task) => ({
                      value: task._id,
                      label: task.name,
                    })),
                ]}
              />
              {dependencies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {dependencies.map((depId) => {
                    const task = tasks.find((t) => t._id === depId);
                    return task ? (
                      <span
                        key={depId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 rounded text-sm"
                      >
                        {task.name}
                        <button
                          type="button"
                          onClick={() => setDependencies(dependencies.filter((id) => id !== depId))}
                          className="hover:text-primary-900 dark:hover:text-primary-300"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowEditTask(false);
                setEditingTask(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={updating}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={showEditProject}
        onClose={() => setShowEditProject(false)}
        title="Project Settings"
      >
        <form onSubmit={handleUpdateProject} className="space-y-4">
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
          
          {/* Danger Zone */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
              Danger Zone
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Once you delete a project, there is no going back. Please be certain.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowEditProject(false);
                setShowDeleteProject(true);
              }}
              className="!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
              Delete Project
            </Button>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowEditProject(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={updating}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Task Confirmation */}
      <ConfirmDialog
        isOpen={deletingTaskId !== null}
        onClose={() => setDeletingTaskId(null)}
        onConfirm={() => {
          if (deletingTaskId) {
            return handleDeleteTask(deletingTaskId);
          }
        }}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      {/* Delete Project Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteProject}
        onClose={() => setShowDeleteProject(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message="Are you sure you want to delete this project? All tasks and data will be permanently deleted."
        confirmText="Delete Project"
        variant="danger"
      />

      {/* Team Management Modal */}
      <Modal
        isOpen={showTeamManagement}
        onClose={() => setShowTeamManagement(false)}
        title="Team Management"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage team members and their access to this project
            </p>
            <Button size="sm" onClick={() => {
              setShowTeamManagement(false);
              setShowInviteMember(true);
            }}>
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>
          </div>

          {team && team.members && team.members.length > 0 ? (
            <div className="space-y-2">
              {team.members.map((member: any) => (
                <Card key={member.user._id || member.user}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {typeof member.user === 'object' && (
                        <Avatar user={member.user} size="md" />
                      )}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {typeof member.user === 'object' 
                            ? (member.user._id === currentUser?._id 
                                ? `${member.user.name} (You)` 
                                : member.user.name)
                            : 'Unknown User'}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {typeof member.user === 'object' ? member.user.email : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Role Dropdown (if can manage and not owner and not self) */}
                      {canManageMembers() && 
                       !isOwner(member) && 
                       typeof member.user === 'object' &&
                       member.user._id !== currentUser?._id ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.user._id, e.target.value)}
                          disabled={changingRoleUserId === member.user._id}
                          className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer transition-colors ${
                            member.role === 'admin'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : member.role === 'editor'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          } ${changingRoleUserId === member.user._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          member.role === 'owner' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : member.role === 'admin'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : member.role === 'editor'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {member.role}
                        </span>
                      )}
                      
                      {/* Remove Button (if can manage and not owner and not self) */}
                      {canManageMembers() && 
                       !isOwner(member) && 
                       typeof member.user === 'object' &&
                       member.user._id !== currentUser?._id && (
                        <button
                          onClick={() => {
                            setRemovingUserId(member.user._id);
                            setShowRemoveConfirm(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No team members yet</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Invite Member Modal */}
      <Modal
        isOpen={showInviteMember}
        onClose={() => {
          setShowInviteMember(false);
          setInviteEmail('');
          setUserSearchResults([]);
          setShowUserDropdown(false);
        }}
        title="Invite Team Member"
      >
        <form onSubmit={handleInviteMember} className="space-y-4">
          <div className="relative">
            <Input
              type="text"
              label="Email Address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Start typing name or email..."
              required
              autoComplete="off"
            />
            
            {/* User Search Dropdown */}
            {showUserDropdown && userSearchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {userSearchResults.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <Avatar user={user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {user.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Loading indicator */}
            {searchingUsers && (
              <div className="absolute right-3 top-9 text-gray-400">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full" />
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            They will receive an email invitation to join this project's team.
          </p>
          
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowInviteMember(false);
                setInviteEmail('');
                setUserSearchResults([]);
                setShowUserDropdown(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={inviting}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false);
          setRemovingUserId(null);
        }}
        onConfirm={handleRemoveMember}
        title="Remove Team Member"
        message="Are you sure you want to remove this member from the team? They will lose access to all team projects."
        confirmText="Remove Member"
        variant="danger"
      />
    </div>
  );
};

export default ProjectPage;

