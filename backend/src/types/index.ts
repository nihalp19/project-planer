import { Request } from 'express';
import { Types } from 'mongoose';

// Extend Express Request via declaration merging
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export type AuthRequest = Request;

// User Types
export type AuthProvider = 'local' | 'google';
export type Theme = 'light' | 'dark';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  authProvider: AuthProvider;
  googleId?: string;
  isEmailVerified: boolean;
  otp?: {
    code: string;
    expiresAt: Date;
  };
  refreshToken?: string;
  preferences: {
    theme: Theme;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Team Types
export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ITeamMember {
  user: Types.ObjectId;
  role: TeamRole;
  joinedAt: Date;
}

export interface ITeam {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  owner: Types.ObjectId;
  members: ITeamMember[];
  projects: Types.ObjectId[];
  isPersonal?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Project Types
export interface IProject {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  team: Types.ObjectId;
  tasks: Types.ObjectId[];
  startDate: Date;
  endDate?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Task Types
export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface ITask {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  name: string;
  duration: number;
  dependencies: Types.ObjectId[];
  earliestStart: number;
  earliestEnd: number;
  actualStart?: Date;
  actualEnd?: Date;
  status: TaskStatus;
  assignedTo: Types.ObjectId[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Invitation Types
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface IInvitation {
  _id: Types.ObjectId;
  team: Types.ObjectId;
  invitedBy: Types.ObjectId;
  invitedEmail: string;
  invitedUser?: Types.ObjectId;
  status: InvitationStatus;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Types
export type NotificationType = 
  | 'team_invitation' 
  | 'task_assigned' 
  | 'project_update' 
  | 'task_completed';

export type EntityType = 'team' | 'project' | 'task';

export interface INotification {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntity?: {
    entityType: EntityType;
    entityId: Types.ObjectId;
  };
  isRead: boolean;
  createdAt: Date;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
}

// Socket Types
export interface SocketUser {
  userId: string;
  email: string;
}

