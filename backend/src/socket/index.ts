import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { SocketUser } from '../types';

interface AuthSocket extends Socket {
  user?: SocketUser;
}

let io: Server;

export const initializeSocket = (server: HTTPServer): Server => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.user?.userId;
    console.log(`✅ Socket connected: ${socket.id} (User: ${userId})`);

    if (userId) {
      // Join user's personal room
      socket.join(`user:${userId}`);
    }

    // Join team room
    socket.on('join:team', (teamId: string) => {
      socket.join(`team:${teamId}`);
      console.log(`User ${userId} joined team:${teamId}`);
    });

    // Leave team room
    socket.on('leave:team', (teamId: string) => {
      socket.leave(`team:${teamId}`);
      console.log(`User ${userId} left team:${teamId}`);
    });

    // Join project room
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      console.log(`User ${userId} joined project:${projectId}`);
    });

    // Leave project room
    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`User ${userId} left project:${projectId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  console.log('✅ Socket.io server initialized');
  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Helper functions to emit events
export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

export const emitToTeam = (teamId: string, event: string, data: any) => {
  if (io) {
    io.to(`team:${teamId}`).emit(event, data);
  }
};

export const emitToProject = (projectId: string, event: string, data: any) => {
  if (io) {
    io.to(`project:${projectId}`).emit(event, data);
  }
};

