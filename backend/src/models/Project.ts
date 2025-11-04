import mongoose, { Schema, Model } from 'mongoose';
import { IProject } from '../types';

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    tasks: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
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

// Index for team lookups
projectSchema.index({ team: 1 });

// Index for creator lookups
projectSchema.index({ createdBy: 1 });

const Project: Model<IProject> = mongoose.model<IProject>('Project', projectSchema);

export default Project;

