import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';

export const useSocket = () => {
  const { isAuthenticated, token } = useAuthStore();
  const { socket, connect, disconnect, isConnected } = useSocketStore();

  useEffect(() => {
    if (isAuthenticated && token && !isConnected) {
      connect(token);
    }

    if (!isAuthenticated && isConnected) {
      disconnect();
    }

    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isAuthenticated, token, isConnected, connect, disconnect]);

  return { socket, isConnected };
};

