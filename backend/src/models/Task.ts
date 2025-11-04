import mongoose, { Schema, Model } from 'mongoose';
import { ITask } from '../types';

const taskSchema = new Schema<ITask>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    dependencies: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    earliestStart: {
      type: Number,
      default: 0,
    },
    earliestEnd: {
      type: Number,
      default: 0,
    },
    actualStart: {
      type: Date,
    },
    actualEnd: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
    },
    assignedTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for project lookups
taskSchema.index({ project: 1 });

// Index for status filtering
taskSchema.index({ status: 1 });

// Index for dependency lookups
taskSchema.index({ dependencies: 1 });

const Task: Model<ITask> = mongoose.model<ITask>('Task', taskSchema);

export default Task;

