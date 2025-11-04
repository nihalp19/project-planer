// User Types
export type AuthProvider = 'local' | 'google';
export type Theme = 'light' | 'dark';

export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
  authProvider: AuthProvider;
  isEmailVerified: boolean;
  preferences: {
    theme: Theme;
  };
  createdAt: string;
  updatedAt: string;
}

// Team Types
export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface TeamMember {
  user: User;
  role: TeamRole;
  joinedAt: string;
}

export interface Team {
  _id: string;
  name: string;
  description?: string;
  owner: User | string;
  members: TeamMember[];
  projects: string[];
  isPersonal?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Project Types
export interface Project {
  _id: string;
  name: string;
  description?: string;
  team: string | Team;
  tasks: string[];
  startDate: string;
  endDate?: string;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

// Task Types
export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface Task {
  _id: string;
  project: string;
  name: string;
  duration: number;
  dependencies: Task[] | string[];
  earliestStart: number;
  earliestEnd: number;
  actualStart?: string;
  actualEnd?: string;
  status: TaskStatus;
  assignedTo: User[] | string[];
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

// Invitation Types
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface Invitation {
  _id: string;
  team: Team | string;
  invitedBy: User | string;
  invitedEmail: string;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// Notification Types
export type NotificationType = 
  | 'team_invitation' 
  | 'task_assigned' 
  | 'project_update' 
  | 'task_completed';

export interface Notification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntity?: {
    entityType: 'team' | 'project' | 'task';
    entityId: string;
  };
  isRead: boolean;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

