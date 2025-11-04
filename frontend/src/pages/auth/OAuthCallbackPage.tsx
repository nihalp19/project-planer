import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Loading } from '@/components/common';
import { authService } from '@/services/authService'; // Import authService



const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error from backend
      const errorParam = searchParams.get('error');
      if (errorParam) {
        setError('Authentication failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // Get token from query params
      const token = searchParams.get('token');
      
      if (!token) {
        setError('No authentication token received.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        // Store token in localStorage
        localStorage.setItem('accessToken', token);

        // Fetch user data and update auth store
        // ✅ FIX: Fetch user data from API, not from store
        const user = await authService.getCurrentUser();
        setUser(user);

        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('Failed to complete authentication. Please try again.');
        localStorage.removeItem('accessToken');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl mb-6 shadow-lg">
          <LayoutDashboard className="w-10 h-10 text-white" />
        </div>

        {error ? (
          <div>
            <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-xl font-semibold">Authentication Failed</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Redirecting to login page...
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Completing Sign In...
            </h2>
            <Loading />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Please wait while we set up your account
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OAuthCallbackPage;

