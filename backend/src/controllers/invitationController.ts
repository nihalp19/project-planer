// controllers/invitationController.js
import { Response } from 'express';
import { Invitation, Team, User } from '../models';
import { AuthRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { createNotification } from '../services/notificationService';
import { emitToTeam, emitToUser } from '../socket';

// Get user's invitations
export const getInvitations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const invitations = await Invitation.find({
    invitedEmail: user.email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('team', 'name description')
    .populate('invitedBy', 'name email avatar')
    .sort({ createdAt: -1 });

  res.json({ invitations });
});

// Accept invitation
export const acceptInvitation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const invitation = await Invitation.findById(id).populate('team');

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  // Verify invitation belongs to user
  if (invitation.invitedEmail !== user.email.toLowerCase()) {
    throw new AppError('This invitation is not for you', 403);
  }

  // Check if invitation is still valid
  if (invitation.status !== 'pending') {
    throw new AppError('Invitation has already been processed', 400);
  }

  if (invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    await invitation.save();
    throw new AppError('Invitation has expired', 400);
  }

  // Add user to team
  const team = await Team.findById(invitation.team);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  // Check if already a member
  const isAlreadyMember = team.members.some((m) => m.user.toString() === userId);
  if (isAlreadyMember) {
    throw new AppError('You are already a team member', 400);
  }

  // Add member with editor role
  team.members.push({
    user: user._id,
    role: 'editor',
    joinedAt: new Date(),
  });

  await team.save();

  // Update invitation status
  invitation.status = 'accepted';
  invitation.invitedUser = user._id;
  await invitation.save();

  // Populate team with member details for real-time update
  await team.populate('members.user', 'name email avatar');
  await team.populate('owner', 'name email avatar');

  // 🔥 REAL-TIME SOCKET EMITS 🔥
  try {
    if (!userId) {
      throw new Error('User ID is required for socket emissions');
    }

    // Get the new member details
    const newMember = team.members.find(m => m.user._id.toString() === userId);

    // Emit to the accepting user's personal room that they joined a team
    // This allows them to see projects immediately without refresh
    emitToUser(userId, 'team:joined', {
      teamId: team._id.toString(),
      team: {
        _id: team._id,
        name: team.name,
        description: team.description,
        isPersonal: team.isPersonal,
      },
    });

    // Emit to the team room that a new member joined
    emitToTeam(team._id.toString(), 'team:member_joined', {
      teamId: team._id.toString(),
      member: newMember,
      team: team
    });

    // Emit team updated event
    emitToTeam(team._id.toString(), 'team:updated', team);

    // Notify team owner/admins about new member
    team.members.forEach(member => {
      if (member.role === 'owner' || member.role === 'admin') {
        emitToUser(member.user._id.toString(), 'team:new_member', {
          teamId: team._id.toString(),
          teamName: team.name,
          newMemberName: user.name,
          newMemberEmail: user.email
        });
      }
    });

    console.log(`✅ Emitted real-time events for new team member: ${user.name} in team: ${team.name}`);
  } catch (socketError) {
    console.error('Socket emit error:', socketError);
    // Don't throw error, just log it - the invitation was still accepted
  }

  // Notify team owner
  await createNotification({
    userId: team.owner,
    type: 'team_invitation',
    title: 'Member Joined',
    message: `${user.name} has joined ${team.name}`,
    entityType: 'team',
    entityId: team._id,
  });

  res.json({
    message: 'Invitation accepted successfully',
    team,
  });
});

// Reject invitation
export const rejectInvitation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const invitation = await Invitation.findById(id);

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  // Verify invitation belongs to user
  if (invitation.invitedEmail !== user.email.toLowerCase()) {
    throw new AppError('This invitation is not for you', 403);
  }

  // Update invitation status
  invitation.status = 'rejected';
  await invitation.save();

  res.json({ message: 'Invitation rejected' });
});