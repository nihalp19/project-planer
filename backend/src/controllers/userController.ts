import { Response } from 'express';
import { User } from '../models';
import { AuthRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/errorHandler';

// Search users by email or name
export const searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  const userId = req.user?.userId;
  
  if (!q || typeof q !== 'string') {
    throw new AppError('Search query parameter "q" is required', 400);
  }

  // Search for users with matching email or name, excluding current user
  const users = await User.find({
    _id: { $ne: userId }, // Exclude current user from results
    $or: [
      { email: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } }
    ]
  })
    .select('email name avatar')
    .limit(10);

  res.json({ users });
});

// Get user profile
export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ user: user.toJSON() });
});

// Update user profile
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { name, avatar } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();

  res.json({
    message: 'Profile updated successfully',
    user: user.toJSON(),
  });
});

// Update user preferences
export const updatePreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { theme } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (theme && ['light', 'dark'].includes(theme)) {
    user.preferences.theme = theme;
  }

  await user.save();

  res.json({
    message: 'Preferences updated successfully',
    preferences: user.preferences,
  });
});

