import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import teamRoutes from './teams';
import invitationRoutes from './invitations';
import projectRoutes from './projects';
import taskRoutes from './tasks';
import notificationRoutes from './notifications';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teams', teamRoutes);
router.use('/invitations', invitationRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/notifications', notificationRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;

