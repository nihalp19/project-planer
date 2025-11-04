import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Calendar, Shield, Save, X, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { userService } from '@/services/userService';
import { Button, Input, Card } from '@/components/common';
import { formatDate } from '@/utils/dateUtils';

const ProfilePage = () => {
  const { user, setUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatar(user.avatar || '');
    }
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const updatedUser = await userService.updateProfile({ name, avatar: avatar || undefined });
      setUser(updatedUser); // Update user data in store
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to update profile' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setAvatar(user?.avatar || '');
    setIsEditing(false);
    setMessage(null);
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    try {
      await userService.updatePreferences({ theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Success/Error Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Single Unified Card */}
        <Card>
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Profile Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your account information and preferences
              </p>
            </div>

            {/* Avatar Section - Centered */}
            <div className="flex flex-col items-center mb-8">
              {avatar || user.avatar ? (
                <img
                  src={avatar || user.avatar}
                  alt={user.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary-100 dark:border-primary-900 mb-4"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-primary-600 to-primary-700 rounded-full flex items-center justify-center text-white text-4xl font-bold mb-4">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              {!isEditing && (
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                  size="sm"
                >
                  Edit Profile
                </Button>
              )}
            </div>

            {/* Profile Information */}
            <div className="space-y-6 max-w-md mx-auto">
              {isEditing ? (
                <>
                  <Input
                    label="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                  />
                  <Input
                    label="Avatar URL (Optional)"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleSave} loading={loading}>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </Button>
                    <Button variant="ghost" onClick={handleCancel}>
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
                      Full Name
                    </label>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {user.name}
                    </p>
                  </div>
                  <div className="text-center">
                    <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
                      Email Address
                    </label>
                    <p className="text-lg font-medium text-gray-900 dark:text-white flex items-center justify-center gap-2">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="my-8 border-t border-gray-200 dark:border-gray-700"></div>

            {/* Theme Preference */}
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-4">
                Theme Preference
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    theme === 'light'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Sun className={`w-8 h-8 mx-auto mb-2 ${
                    theme === 'light' ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <p className={`font-medium text-center ${
                    theme === 'light' 
                      ? 'text-primary-600 dark:text-primary-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    Light
                  </p>
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Moon className={`w-8 h-8 mx-auto mb-2 ${
                    theme === 'dark' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
                  }`} />
                  <p className={`font-medium text-center ${
                    theme === 'dark' 
                      ? 'text-primary-600 dark:text-primary-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    Dark
                  </p>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="my-8 border-t border-gray-200 dark:border-gray-700"></div>

            {/* Account Details */}
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-6">
                Account Details
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Member Since</span>
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {formatDate(user.createdAt)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">Authentication</span>
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium capitalize">
                    {user.authProvider}
                    {user.authProvider === 'google' && ' OAuth'}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Email Status</span>
                  </div>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    user.isEmailVerified
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {user.isEmailVerified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ProfilePage;

