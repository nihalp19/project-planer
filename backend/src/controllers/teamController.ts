import { Response } from 'express';
import { Team, Invitation, User, Project } from '../models';
import { AuthRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateInvitationToken } from '../utils/password';
import { sendTeamInvitationEmail } from '../services/emailService';
import { createNotification } from '../services/notificationService';
import { emitToTeam, emitToUser } from '../socket';

// Create team
export const createTeam = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const team = await Team.create({
    name,
    description,
    owner: userId,
    members: [
      {
        user: userId,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
    projects: [],
  });

  await team.populate('members.user', 'name email avatar');

  res.status(201).json({
    message: 'Team created successfully',
    team,
  });
});

// Get user's teams
export const getTeams = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const includePersonal = req.query.includePersonal === 'true';

  const query: any = { 'members.user': userId };
  if (!includePersonal) {
    query.isPersonal = { $ne: true }; // Exclude personal workspaces
  }

  const teams = await Team.find(query)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar')
    .sort({ createdAt: -1 });

  res.json({ teams });
});

// Get user's personal workspace
export const getPersonalWorkspace = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  const personalWorkspace = await Team.findOne({
    'members.user': userId,
    isPersonal: true,
  });

  if (!personalWorkspace) {
    throw new AppError('Personal workspace not found', 404);
  }

  res.json({ team: personalWorkspace });
});

// Get team by ID
export const getTeamById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const team = await Team.findById(id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar')
    .populate({
      path: 'projects',
      select: 'name description startDate endDate createdAt',
    });

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  // Check if user is a member
  const isMember = team.members.some((m) => m.user._id.toString() === userId);
  if (!isMember) {
    throw new AppError('Access denied', 403);
  }

  res.json({ team });
});

// Update team
export const updateTeam = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const team = await Team.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  if (name) team.name = name;
  if (description !== undefined) team.description = description;

  await team.save();
  await team.populate('members.user', 'name email avatar');

  res.json({
    message: 'Team updated successfully',
    team,
  });
});

// Delete team
export const deleteTeam = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const team = await Team.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  // Only owner can delete
  if (team.owner.toString() !== userId) {
    throw new AppError('Only team owner can delete the team', 403);
  }

  // Delete associated projects and tasks (cascade delete)
  const { Project, Task } = require('../models');
  const projects = await Project.find({ team: id });
  const projectIds = projects.map((p: any) => p._id);

  await Task.deleteMany({ project: { $in: projectIds } });
  await Project.deleteMany({ team: id });
  await Invitation.deleteMany({ team: id });
  await team.deleteOne();

  res.json({ message: 'Team deleted successfully' });
});

// Invite member to team
export const inviteMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;
  const userId = req.user?.userId;

  const team = await Team.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  // Check if invitee is already a member
  const inviteeUser = await User.findOne({ email: email.toLowerCase() });
  if (inviteeUser) {
    const isAlreadyMember = team.members.some(
      (m) => m.user.toString() === inviteeUser._id.toString()
    );
    if (isAlreadyMember) {
      throw new AppError('User is already a team member', 400);
    }
  }

  // Check for existing pending invitation
  const existingInvitation = await Invitation.findOne({
    team: id,
    invitedEmail: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });

  if (existingInvitation) {
    throw new AppError('Invitation already sent to this email', 400);
  }

  // Create invitation
  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await Invitation.create({
    team: id,
    invitedBy: userId,
    invitedEmail: email.toLowerCase(),
    invitedUser: inviteeUser?._id,
    status: 'pending',
    token,
    expiresAt,
  });

  // Get inviter details
  const inviter = await User.findById(userId);

  // Send invitation email
  await sendTeamInvitationEmail(email, team.name, inviter?.name || 'A team member', token);

  // Create notification for invitee if they have an account
  if (inviteeUser) {
    await createNotification({
      userId: inviteeUser._id,
      type: 'team_invitation',
      title: 'Team Invitation',
      message: `${inviter?.name} invited you to join ${team.name}`,
      entityType: 'team',
      entityId: team._id,
    });

    // Also emit invitation:received event for real-time invitation updates
    const { emitToUser } = require('../socket');
    emitToUser(inviteeUser._id.toString(), 'invitation:received', { invitation });
  }

  res.status(201).json({
    message: 'Invitation sent successfully',
    invitation,
  });
});

// Change member role
export const changeMemberRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, userId: targetUserId } = req.params;
  const { role } = req.body;

  const team = await Team.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  // Can't change owner's role
  if (team.owner.toString() === targetUserId) {
    throw new AppError("Cannot change owner's role", 400);
  }

  // Find and update member
  const member = team.members.find((m) => m.user.toString() === targetUserId);
  if (!member) {
    throw new AppError('User is not a team member', 404);
  }

  member.role = role;
  await team.save();
  await team.populate('members.user', 'name email avatar');

  // Emit real-time event to all users in team room
  const { emitToTeam } = require('../socket');
  emitToTeam(id, 'team:member_role_changed', { 
    team, 
    userId: targetUserId, 
    newRole: role 
  });

  res.json({
    message: 'Member role updated successfully',
    team,
  });
});

// Remove member from team
export const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, userId: targetUserId } = req.params;

  const team = await Team.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  // Can't remove owner
  if (team.owner.toString() === targetUserId) {
    throw new AppError('Cannot remove team owner', 400);
  }

  // Remove member
  team.members = team.members.filter((m) => m.user.toString() !== targetUserId);
  await team.save();
  await team.populate('members.user', 'name email avatar');

  // Get all projects in this team that the removed user will lose access to
  const teamProjects = await Project.find({ team: id }).select('_id name');

  // Emit real-time events
  try {
    // Emit to team room that member was removed
    emitToTeam(id, 'team:member_removed', { 
      team, 
      removedUserId: targetUserId 
    });

    // Emit to the removed user's personal room that they left the team
    emitToUser(targetUserId, 'team:left', {
      teamId: id,
      teamName: team.name,
    });

    // Emit project access revoked events for all projects in this team
    teamProjects.forEach((project) => {
      emitToUser(targetUserId, 'project:access_revoked', {
        projectId: project._id.toString(),
        projectName: project.name,
        teamId: id,
        teamName: team.name,
      });
    });

    console.log(`✅ Emitted real-time events for removed member: ${targetUserId} from team: ${team.name}`);
  } catch (socketError) {
    console.error('Socket emit error:', socketError);
    // Don't throw error, just log it - the member was still removed
  }

  res.json({
    message: 'Member removed successfully',
    team,
  });
});

