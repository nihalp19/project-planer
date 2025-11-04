import { Response } from 'express';
import { Project, Team } from '../models';
import { AuthRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { emitToProject, emitToTeam } from '../socket';

// Create project
export const createProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, teamId, startDate } = req.body;
  const userId = req.user?.userId;

  console.log('[Create Project] Request received:', { name, description, teamId, userId });

  let finalTeamId = teamId;

  // If no teamId provided, use user's personal workspace
  if (!finalTeamId) {
    let personalWorkspace = await Team.findOne({
      owner: userId,
      isPersonal: true,
    });

    console.log('[Create Project] Personal workspace found:', personalWorkspace?._id);

    // If personal workspace doesn't exist, create it
    if (!personalWorkspace) {
      console.log('[Create Project] Creating personal workspace for user:', userId);
      personalWorkspace = await Team.create({
        name: 'Personal Workspace',
        owner: userId,
        isPersonal: true,
        members: [
          {
            user: userId,
            role: 'owner',
            joinedAt: new Date(),
          },
        ],
        projects: [],
      });
      console.log('[Create Project] Personal workspace created:', personalWorkspace._id);
    }

    finalTeamId = personalWorkspace._id;
  }

  // Verify team exists and user is a member
  const team = await Team.findById(finalTeamId);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) {
    throw new AppError('You must be a team member to create projects', 403);
  }

  // Viewers can't create projects
  if (member.role === 'viewer') {
    throw new AppError('Viewers cannot create projects', 403);
  }

  const project = await Project.create({
    name,
    description,
    team: finalTeamId,
    startDate: startDate || new Date(),
    createdBy: userId,
    tasks: [],
  });

  console.log('[Create Project] Project created:', project._id);

  // Add project to team
  team.projects.push(project._id);
  await team.save();

  await project.populate('createdBy', 'name email avatar');

  // Emit real-time event to all team members
  emitToTeam(finalTeamId.toString(), 'project:created', { project });

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

  // Remove project from team
  await Team.findByIdAndUpdate(project.team, {
    $pull: { projects: id },
  });

  await project.deleteOne();

  // Check if team has no more projects and auto-delete if not personal
  const updatedTeam = await Team.findById(project.team);
  if (updatedTeam && 
      !updatedTeam.isPersonal && 
      updatedTeam.projects.length === 0) {
    console.log(`[Auto-delete] Team ${updatedTeam._id} is empty and not personal, deleting...`);
    await updatedTeam.deleteOne();
  }

  res.json({ message: 'Project deleted successfully' });
});

