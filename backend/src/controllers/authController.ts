import { Request, Response } from 'express';
import { User, Team } from '../models';
import { hashPassword, comparePassword, generateOTP } from '../utils/password';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { sendWelcomeEmail, sendOTPEmail } from '../services/emailService';
import { AuthRequest } from '../types';

// Register with email and password
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await User.create({
    email,
    password: hashedPassword,
    name,
    authProvider: 'local',
    isEmailVerified: false,
    preferences: {
      theme: 'light',
    },
  });

  // Auto-create personal workspace
  await Team.create({
    name: `${user.name}'s Workspace`,
    description: 'Your personal workspace',
    owner: user._id,
    members: [
      {
        user: user._id,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
    projects: [],
    isPersonal: true,
  });

  // Generate tokens
  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
  });

  // Save refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  // Send welcome email (async, don't wait)
  sendWelcomeEmail(user.email, user.name).catch(console.error);

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    message: 'User registered successfully',
    user: user.toJSON(),
    accessToken: tokens.accessToken,
  });
});

// Login with email and password
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Find user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if user registered with OAuth
  if (user.authProvider !== 'local' || !user.password) {
    throw new AppError(`Please login with ${user.authProvider}`, 400);
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate tokens
  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
  });

  // Save refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    message: 'Login successful',
    user: user.toJSON(),
    accessToken: tokens.accessToken,
  });
});

// Logout
export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  if (userId) {
    // Clear refresh token from database
    await User.findByIdAndUpdate(userId, { refreshToken: null });
  }

  // Clear cookie
  res.clearCookie('refreshToken');

  res.json({ message: 'Logout successful' });
});

// Refresh access token
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new AppError('Refresh token not provided', 401);
  }

  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken);

  // Find user and verify refresh token matches
  const user = await User.findById(payload.userId);
  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  // Generate new tokens
  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
  });

  // Update refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  // Set new refresh token in cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken: tokens.accessToken,
  });
});

// Forgot password - send OTP
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if user exists
    res.json({ message: 'If the email exists, an OTP has been sent' });
    return;
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save OTP
  user.otp = { code: otp, expiresAt };
  await user.save();

  // Send OTP email
  await sendOTPEmail(user.email, otp);

  res.json({ message: 'If the email exists, an OTP has been sent' });
});

// Verify OTP and reset password
export const verifyOTPAndResetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user || !user.otp) {
    throw new AppError('Invalid OTP', 400);
  }

  // Check if OTP expired
  if (user.otp.expiresAt < new Date()) {
    throw new AppError('OTP expired', 400);
  }

  // Verify OTP
  if (user.otp.code !== otp) {
    throw new AppError('Invalid OTP', 400);
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password and clear OTP
  user.password = hashedPassword;
  user.otp = undefined;
  await user.save();

  res.json({ message: 'Password reset successful' });
});

// Get current user
export const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ user: user.toJSON() });
});

// Google OAuth callback handler
export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (!user) {
    throw new AppError('Authentication failed', 401);
  }

  // Generate tokens
  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
  });

  // Save refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Redirect to frontend with access token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}`);
});

