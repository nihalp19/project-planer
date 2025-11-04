import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '@/services/notificationService';
import { formatRelative } from '@/utils/dateUtils';
import { useSocketStore } from '@/stores/socketStore';
import { Notification } from '@/types';

export const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { on, off } = useSocketStore();

  const { data, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications(),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Listen for real-time notifications
  useEffect(() => {
    const handleNewNotification = () => {
      // Refetch notifications when new one arrives
      refetch();
      // Also invalidate query to ensure data is fresh
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const handleInvitationReceived = () => {
      // Refetch when invitation received
      refetch();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    };

    const handleTaskUpdate = () => {
      // Refetch on task updates
      refetch();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const handleProjectUpdate = () => {
      // Refetch on project updates
      refetch();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    on('notification:new', handleNewNotification);
    on('invitation:received', handleInvitationReceived);
    on('task:created', handleTaskUpdate);
    on('task:updated', handleTaskUpdate);
    on('project:updated', handleProjectUpdate);

    return () => {
      off('notification:new', handleNewNotification);
      off('invitation:received', handleInvitationReceived);
      off('task:created', handleTaskUpdate);
      off('task:updated', handleTaskUpdate);
      off('project:updated', handleProjectUpdate);
    };
  }, [on, off, refetch, queryClient]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const recentNotifications = notifications.slice(0, 5);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification._id);
    }

    // Handle notification routing based on type and entity
    if (notification.type === 'team_invitation') {
      // Navigate to invitations page for team invitations
      navigate('/invitations');
      setIsOpen(false);
      return;
    }

    // Navigate to related entity if available
    if (notification.relatedEntity) {
      const { entityType, entityId } = notification.relatedEntity;
      let path = '';
      
      switch (entityType) {
        case 'project':
          path = `/projects/${entityId}`;
          break;
        case 'team':
          // After project-centric redesign, navigate to dashboard for team-related notifications
          // User can access team page directly if needed via /teams/:teamId
          path = '/dashboard';
          break;
        case 'task':
          // Tasks are viewed within projects, so we'd need the project ID
          // For now, navigate to dashboard
          path = '/dashboard';
          break;
        default:
          path = '/dashboard';
      }
      
      navigate(path);
      setIsOpen(false);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markAsReadMutation.mutate(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteNotificationMutation.mutate(id);
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      'task.created': '📝',
      'task.updated': '✏️',
      'task.completed': '✅',
      'project.created': '📁',
      'project.updated': '📂',
      'team.invitation': '👥',
      'team.joined': '🎉',
    };
    return icons[type] || '🔔';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {recentNotifications.length > 0 ? (
                recentNotifications.map((notification: Notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors ${
                      !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatRelative(notification.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => handleMarkAsRead(e, notification._id)}
                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(e, notification._id)}
                          className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              )}
            </div>

            {notifications.length > 5 && (
              <div className="p-3 text-center border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    navigate('/notifications');
                    setIsOpen(false);
                  }}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  View All Notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

