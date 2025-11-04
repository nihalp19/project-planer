import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { useToastStore } from './stores/toastStore';
import { useSocketStore } from './stores/socketStore';
import { PrivateRoute } from './components/layout/PrivateRoute';
import { Navbar } from './components/layout/Navbar';
import { Loading } from './components/common';
import { ToastContainer } from './components/notifications/Toast';
import { useSocket } from './hooks/useSocket';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OAuthCallbackPage from './pages/auth/OAuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import TeamPage from './pages/TeamPage';
import ProjectPage from './pages/ProjectPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import InvitationsPage from './pages/InvitationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppContent() {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { toasts, removeToast, addToast } = useToastStore();
  const { on, off } = useSocketStore();
  
  // Initialize Socket.io connection
  useSocket();

  useEffect(() => {
    checkAuth();
    setTheme(theme);
  }, [checkAuth, theme, setTheme]);

  // Listen for real-time notifications and show toasts
  useEffect(() => {
    const handleNewNotification = (data: any) => {
      addToast({
        message: data.message || 'New notification',
        type: 'info',
        onClick: () => {
          if (data.link) {
            window.location.href = data.link;
          }
        },
      });
    };

    const handleTaskCreated = (data: any) => {
      addToast({
        message: `New task created: ${data.task?.name || 'Unknown'}`,
        type: 'success',
      });
    };

    const handleTaskUpdated = (data: any) => {
      addToast({
        message: `Task updated: ${data.task?.name || 'Unknown'}`,
        type: 'info',
      });
    };

    const handleProjectUpdated = (data: any) => {
      addToast({
        message: `Project updated: ${data.project?.name || 'Unknown'}`,
        type: 'info',
      });
    };

    const handleInvitationReceived = (data: any) => {
      addToast({
        message: `New team invitation from ${data.team?.name || 'a team'}`,
        type: 'info',
        onClick: () => {
          window.location.href = '/invitations';
        },
      });
    };

    if (isAuthenticated) {
      on('notification:new', handleNewNotification);
      on('task:created', handleTaskCreated);
      on('task:updated', handleTaskUpdated);
      on('project:updated', handleProjectUpdated);
      on('invitation:received', handleInvitationReceived);
    }

    return () => {
      off('notification:new', handleNewNotification);
      off('task:created', handleTaskCreated);
      off('task:updated', handleTaskUpdated);
      off('project:updated', handleProjectUpdated);
      off('invitation:received', handleInvitationReceived);
    };
  }, [isAuthenticated, on, off, addToast]);

  if (isLoading) {
    return <Loading fullScreen />;
  }

  return (
    <>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {isAuthenticated && <Navbar />}
          
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/callback" element={<OAuthCallbackPage />} />

            {/* Private routes */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/teams/:teamId"
              element={
                <PrivateRoute>
                  <TeamPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <PrivateRoute>
                  <ProjectPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <PrivateRoute>
                  <NotificationsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/invitations"
              element={
                <PrivateRoute>
                  <InvitationsPage />
                </PrivateRoute>
              }
            />

            {/* Redirect root to dashboard or login */}
            <Route
              path="/"
              element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
              }
            />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))} />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;

