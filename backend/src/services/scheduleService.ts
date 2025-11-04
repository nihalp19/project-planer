import { Task, Project } from '../models';
import { ITask } from '../types';
import { Types } from 'mongoose';

interface TaskNode {
  task: ITask;
  visited: boolean;
  inStack: boolean;
}

/**
 * Topological sort using DFS to detect cycles
 * Returns sorted tasks or throws error if cycle detected
 */
const topologicalSort = (tasks: ITask[]): ITask[] => {
  const taskMap = new Map<string, TaskNode>();
  const sorted: ITask[] = [];

  // Initialize task nodes
  tasks.forEach((task) => {
    taskMap.set(task._id.toString(), {
      task,
      visited: false,
      inStack: false,
    });
  });

  const visit = (taskId: string): void => {
    const node = taskMap.get(taskId);
    if (!node) return;

    if (node.inStack) {
      throw new Error('Circular dependency detected in tasks');
    }

    if (node.visited) return;

    node.inStack = true;

    // Visit all dependencies first
    node.task.dependencies.forEach((depId) => {
      visit(depId.toString());
    });

    node.inStack = false;
    node.visited = true;
    sorted.push(node.task);
  };

  // Visit all tasks
  tasks.forEach((task) => {
    const node = taskMap.get(task._id.toString());
    if (node && !node.visited) {
      visit(task._id.toString());
    }
  });

  return sorted;
};

/**
 * Calculate schedule using Critical Path Method (CPM)
 * Updates earliestStart, earliestEnd, actualStart, and actualEnd for all tasks
 */
export const calculateProjectSchedule = async (projectId: string | Types.ObjectId): Promise<void> => {
  try {
    // Fetch project with start date
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Fetch all tasks for the project
    const tasks = await Task.find({ project: projectId });

    if (tasks.length === 0) {
      // No tasks, set project end date to start date
      project.endDate = project.startDate;
      await project.save();
      return;
    }

    // Sort tasks topologically
    const sortedTasks = topologicalSort(tasks);

    // Create a map for quick task lookup
    const taskMap = new Map<string, ITask>();
    sortedTasks.forEach((task) => {
      taskMap.set(task._id.toString(), task);
    });

    // Calculate earliest start and end for each task
    for (const task of sortedTasks) {
      if (task.dependencies.length === 0) {
        // No dependencies, starts at day 0
        task.earliestStart = 0;
      } else {
        // Find the maximum earliestEnd of all dependencies
        let maxEnd = 0;
        for (const depId of task.dependencies) {
          const depTask = taskMap.get(depId.toString());
          if (depTask) {
            maxEnd = Math.max(maxEnd, depTask.earliestEnd);
          }
        }
        task.earliestStart = maxEnd;
      }

      task.earliestEnd = task.earliestStart + task.duration;

      // Calculate actual dates
      const startDate = new Date(project.startDate);
      startDate.setDate(startDate.getDate() + task.earliestStart);
      task.actualStart = startDate;

      const endDate = new Date(project.startDate);
      endDate.setDate(endDate.getDate() + task.earliestEnd);
      task.actualEnd = endDate;

      // Save updated task
      await Task.findByIdAndUpdate(task._id, {
        earliestStart: task.earliestStart,
        earliestEnd: task.earliestEnd,
        actualStart: task.actualStart,
        actualEnd: task.actualEnd,
      });
    }

    // Update project end date (maximum task end date)
    const maxTaskEnd = Math.max(...sortedTasks.map((t) => t.earliestEnd));
    const projectEndDate = new Date(project.startDate);
    projectEndDate.setDate(projectEndDate.getDate() + maxTaskEnd);
    project.endDate = projectEndDate;

    await project.save();

    console.log(`✅ Schedule calculated for project ${projectId}`);
  } catch (error) {
    console.error('❌ Schedule calculation error:', error);
    throw error;
  }
};

/**
 * Validate that adding a dependency won't create a cycle
 */
export const validateDependency = async (
  taskId: string | Types.ObjectId,
  dependencyId: string | Types.ObjectId
): Promise<boolean> => {
  try {
    const task = await Task.findById(taskId);
    if (!task) return false;

    // Create temporary task with new dependency
    const tempTask = { ...task.toObject(), dependencies: [...task.dependencies, new Types.ObjectId(dependencyId.toString())] };

    // Fetch all tasks
    const allTasks = await Task.find({ project: task.project });

    // Replace the task with temp version
    const tasksToCheck = allTasks.map((t) =>
      t._id.toString() === taskId.toString() ? (tempTask as ITask) : t
    );

    // Try topological sort - will throw if cycle detected
    topologicalSort(tasksToCheck);

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get critical path (longest path through the project)
 */
export const getCriticalPath = async (projectId: string | Types.ObjectId): Promise<ITask[]> => {
  const tasks = await Task.find({ project: projectId }).sort({ earliestEnd: -1 });

  if (tasks.length === 0) return [];

  const criticalTasks: ITask[] = [];
  const maxEnd = tasks[0].earliestEnd;

  // Find tasks on the critical path (no slack time)
  for (const task of tasks) {
    const slack = maxEnd - task.earliestEnd;
    if (slack === 0) {
      criticalTasks.push(task);
    }
  }

  return criticalTasks;
};

