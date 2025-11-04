import { Router } from 'express';
import { body } from 'express-validator';
import passport from '../config/passport';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  verifyOTPAndResetPassword,
  getCurrentUser,
  googleCallback,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests, please try again later',
});

// Register
router.post(
  '/register',
  authLimiter,
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ]),
  register
);

// Login
router.post(
  '/login',
  authLimiter,
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  login
);

// Logout
router.post('/logout', authenticate, logout);

// Refresh token
router.post('/refresh', refreshToken);

// Forgot password
router.post(
  '/forgot-password',
  authLimiter,
  validate([body('email').isEmail().normalizeEmail().withMessage('Valid email is required')]),
  forgotPassword
);

// Verify OTP and reset password
router.post(
  '/verify-otp',
  authLimiter,
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ]),
  verifyOTPAndResetPassword
);

// Get current user
router.get('/me', authenticate, getCurrentUser);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
  }),
  googleCallback
);

export default router;

