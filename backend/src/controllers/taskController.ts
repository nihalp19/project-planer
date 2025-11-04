import { Response } from 'express';
import { Task, Project, User } from '../models';
import { AuthRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { calculateProjectSchedule, validateDependency } from '../services/scheduleService';
import { createNotification } from '../services/notificationService';
import { sendTaskAssignmentEmail } from '../services/emailService';
import { emitToProject } from '../socket';

// Create task
export const createTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, name, duration, dependencies, assignedTo } = req.body;
  const userId = req.user?.userId;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Validate dependencies exist and belong to same project
  if (dependencies && dependencies.length > 0) {
    const depTasks = await Task.find({
      _id: { $in: dependencies },
      project: projectId,
    });

    if (depTasks.length !== dependencies.length) {
      throw new AppError('Invalid dependencies', 400);
    }
  }

  const task = await Task.create({
    project: projectId,
    name,
    duration,
    dependencies: dependencies || [],
    assignedTo: assignedTo || [],
    createdBy: userId,
    status: 'pending',
  });

  // Add task to project
  project.tasks.push(task._id);
  await project.save();

  // Recalculate schedule
  await calculateProjectSchedule(projectId);

  // Populate task details
  await task.populate('assignedTo dependencies createdBy', 'name email avatar');

  // Send notifications to assigned users
  if (assignedTo && assignedTo.length > 0) {
    const currentUser = await User.findById(userId);
    const projectWithName = await Project.findById(projectId);

    for (const assigneeId of assignedTo) {
      const assignee = await User.findById(assigneeId);
      if (assignee && currentUser && projectWithName) {
        // Create notification
        await createNotification({
          userId: assigneeId,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `${currentUser.name} assigned you to: ${name}`,
          entityType: 'task',
          entityId: task._id,
        });

        // Send email
        sendTaskAssignmentEmail(
          assignee.email,
          name,
          projectWithName.name,
          currentUser.name
        ).catch(console.error);
      }
    }
  }

  // Emit real-time event to all users in project room
  emitToProject(projectId.toString(), 'task:created', { task });

  res.status(201).json({
    message: 'Task created successfully',
    task,
  });
});

// Get tasks by project
export const getTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query;

  if (!projectId) {
    throw new AppError('projectId query parameter is required', 400);
  }

  const tasks = await Task.find({ project: projectId })
    .populate('assignedTo dependencies createdBy', 'name email avatar')
    .sort({ earliestStart: 1 });

  res.json({ tasks });
});

// Get task by ID
export const getTaskById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const task = await Task.findById(id)
    .populate('assignedTo dependencies createdBy', 'name email avatar')
    .populate('project', 'name startDate');

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  res.json({ task });
});

// Update task
export const updateTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, duration, dependencies, assignedTo, status } = req.body;
  const userId = req.user?.userId;

  const task = await Task.findById(id);
  if (!task) {
    throw new AppError('Task not found', 404);
  }

  const oldAssignedTo = task.assignedTo.map((id) => id.toString());
  let scheduleNeedsRecalc = false;

  if (name) task.name = name;
  if (status) task.status = status;

  if (duration && duration !== task.duration) {
    task.duration = duration;
    scheduleNeedsRecalc = true;
  }

  // Update dependencies with validation
  if (dependencies !== undefined) {
    // Validate new dependencies
    if (dependencies.length > 0) {
      const depTasks = await Task.find({
        _id: { $in: dependencies },
        project: task.project,
      });

      if (depTasks.length !== dependencies.length) {
        throw new AppError('Invalid dependencies', 400);
      }

      // Check for circular dependencies
      for (const depId of dependencies) {
        const isValid = await validateDependency(task._id, depId);
        if (!isValid) {
          throw new AppError('Circular dependency detected', 400);
        }
      }
    }

    task.dependencies = dependencies;
    scheduleNeedsRecalc = true;
  }

  if (assignedTo !== undefined) {
    task.assignedTo = assignedTo;

    // Notify newly assigned users
    const newAssignees = assignedTo.filter((id: string) => !oldAssignedTo.includes(id));
    if (newAssignees.length > 0) {
      const currentUser = await User.findById(userId);
      const project = await Project.findById(task.project);

      for (const assigneeId of newAssignees) {
        const assignee = await User.findById(assigneeId);
        if (assignee && currentUser && project) {
          await createNotification({
            userId: assigneeId,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `${currentUser.name} assigned you to: ${task.name}`,
            entityType: 'task',
            entityId: task._id,
          });

          sendTaskAssignmentEmail(
            assignee.email,
            task.name,
            project.name,
            currentUser.name
          ).catch(console.error);
        }
      }
    }
  }

  await task.save();

  // Recalculate schedule if needed
  if (scheduleNeedsRecalc) {
    await calculateProjectSchedule(task.project);
  }

  await task.populate('assignedTo dependencies createdBy', 'name email avatar');

  // Emit real-time event to all users in project room
  emitToProject(task.project.toString(), 'task:updated', { task });

  res.json({
    message: 'Task updated successfully',
    task,
  });
});

// Delete task
export const deleteTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const task = await Task.findById(id);
  if (!task) {
    throw new AppError('Task not found', 404);
  }

  // Check if other tasks depend on this task
  const dependentTasks = await Task.find({
    dependencies: id,
  });

  if (dependentTasks.length > 0) {
    throw new AppError(
      'Cannot delete task: Other tasks depend on it. Please remove dependencies first.',
      400
    );
  }

  const projectId = task.project;

  // Remove task from project
  await Project.findByIdAndUpdate(projectId, {
    $pull: { tasks: id },
  });

  await task.deleteOne();

  // Recalculate schedule
  await calculateProjectSchedule(projectId);

  // Emit real-time event to all users in project room
  emitToProject(projectId.toString(), 'task:deleted', { taskId: id });

  res.json({ message: 'Task deleted successfully' });
});

// Calculate/recalculate project schedule
export const recalculateSchedule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const project = await Project.findById(id);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  await calculateProjectSchedule(id);

  // Fetch updated tasks
  const tasks = await Task.find({ project: id })
    .populate('assignedTo dependencies createdBy', 'name email avatar')
    .sort({ earliestStart: 1 });

  res.json({
    message: 'Schedule recalculated successfully',
    tasks,
  });
});

