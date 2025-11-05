import { Response } from 'express';
import { Project, Team } from '../models';
import { AuthRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { emitToProject, emitToTeam } from '../socket';

// Create project
export const createProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, startDate } = req.body;
  const userId = req.user?.userId;

  console.log('[Create Project] Request received:', { name, description, userId });

  // Always create a dedicated team for this project
  const projectTeam = await Team.create({
    name: `${name} Team`,
    owner: userId!,
    isPersonal: false,
    members: [
      {
        user: userId!,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
    projects: [],
  });

  const project = await Project.create({
    name,
    description,
    team: projectTeam._id,
    startDate: startDate || new Date(),
    createdBy: userId,
    tasks: [],
  });

  console.log('[Create Project] Project created:', project._id);

  // Add project to team
  projectTeam.projects.push(project._id);
  await projectTeam.save();

  await project.populate('createdBy', 'name email avatar');

  // Emit real-time event to all team members
  emitToTeam(projectTeam._id.toString(), 'project:created', { project });

  console.log('[Create Project] Success - returning project');

  res.status(201).json({
    message: 'Project created successfully',
    project,
  });
});

// Get all user's projects (across all teams)
export const getMyProjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  // Get all teams user is a member of
  const teams = await Team.find({
    'members.user': userId,
  }).select('_id');

  const teamIds = teams.map((t) => t._id);

  // Get all projects from those teams
  const projects = await Project.find({ team: { $in: teamIds } })
    .populate('createdBy', 'name email avatar')
    .populate('team', 'name isPersonal')
    .sort({ createdAt: -1 });

  res.json({ projects });
});

// Get projects by team
export const getProjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { teamId } = req.query;
  const userId = req.user?.userId;

  if (!teamId) {
    throw new AppError('teamId query parameter is required', 400);
  }

  // Verify user is team member
  const team = await Team.findById(teamId);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const isMember = team.members.some((m) => m.user.toString() === userId);
  if (!isMember) {
    throw new AppError('Access denied', 403);
  }

  const projects = await Project.find({ team: teamId })
    .populate('createdBy', 'name email avatar')
    .sort({ createdAt: -1 });

  res.json({ projects });
});

// Get project by ID
export const getProjectById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const project = await Project.findById(id)
    .populate('createdBy', 'name email avatar')
    .populate({
      path: 'tasks',
      populate: {
        path: 'assignedTo dependencies',
        select: 'name email avatar',
      },
    });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  res.json({ project });
});

// Update project
export const updateProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, startDate } = req.body;

  const project = await Project.findById(id);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (startDate) {
    project.startDate = new Date(startDate);

    // Recalculate schedule if start date changes
    const { calculateProjectSchedule } = require('../services/scheduleService');
    await calculateProjectSchedule(project._id);
  }

  await project.save();
  await project.populate('createdBy', 'name email avatar');

  // Emit real-time event to all users in project room
  emitToProject(id, 'project:updated', { project });

  // Also emit to team room so dashboard updates
  const teamId = project.team.toString();
  emitToTeam(teamId, 'project:updated', { project });

  res.json({
    message: 'Project updated successfully',
    project,
  });
});

// Delete project
export const deleteProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const project = await Project.findById(id);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Delete all tasks in project
  const { Task } = require('../models');
  await Task.deleteMany({ project: id });

  // Emit real-time event to all users in project room before deletion
  emitToProject(id, 'project:deleted', { projectId: id });

  // Also emit to team room so dashboard updates
  const teamId = project.team.toString();
  emitToTeam(teamId, 'project:deleted', { projectId: id });

  // Emit access revoked to all team members' personal rooms
  const team = await Team.findById(teamId);
  if (team) {
    try {
      const { emitToUser } = require('../socket');
      for (const member of team.members) {
        emitToUser(member.user.toString(), 'project:access_revoked', {
          projectId: id,
          projectName: project.name,
          teamId: teamId,
          teamName: team.name,
        });
      }
    } catch (e) {
      console.error('[Delete Project] Failed to emit access_revoked to members', e);
    }
  }

  // Remove project from team
  await Team.findByIdAndUpdate(project.team, {
    $pull: { projects: id },
  });

  await project.deleteOne();

  // Always delete the associated team
  try {
    await Team.findByIdAndDelete(teamId);
  } catch (e) {
    console.error('[Delete Project] Failed to delete team', e);
  }

  res.json({ message: 'Project deleted successfully' });
});

