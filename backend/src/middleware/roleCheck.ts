import { Response, NextFunction } from 'express';
import { AuthRequest, TeamRole } from '../types';
import { Team } from '../models';
import { AppError } from './errorHandler';

export const checkTeamRole = (allowedRoles: TeamRole[]) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id || req.params.teamId || req.body.teamId;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const team = await Team.findById(teamId);

      if (!team) {
        throw new AppError('Team not found', 404);
      }

      // Check if user is team member
      const member = team.members.find((m) => m.user.toString() === userId);

      if (!member) {
        throw new AppError('Access denied: Not a team member', 403);
      }

      // Check if user has required role
      if (!allowedRoles.includes(member.role)) {
        throw new AppError('Access denied: Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const checkProjectAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { Project } = require('../models');
    const projectId = req.params.id || req.params.projectId || req.body.projectId;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const project = await Project.findById(projectId).populate('team');

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Check if user is team member
    const team = await Team.findById(project.team);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const member = team.members.find((m) => m.user.toString() === userId);

    if (!member) {
      throw new AppError('Access denied: Not a team member', 403);
    }

    // Viewers can only read
    if (member.role === 'viewer' && req.method !== 'GET') {
      throw new AppError('Access denied: Viewers can only read', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

