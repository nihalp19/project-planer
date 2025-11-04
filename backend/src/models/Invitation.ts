import mongoose, { Schema, Model } from 'mongoose';
import { IInvitation } from '../types';

const invitationSchema = new Schema<IInvitation>(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invitedEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    invitedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending',
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding user's invitations
invitationSchema.index({ invitedEmail: 1, status: 1 });

// Index for token lookups
invitationSchema.index({ token: 1 });

// TTL index to auto-delete expired invitations after 7 days
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 });

const Invitation: Model<IInvitation> = mongoose.model<IInvitation>(
  'Invitation',
  invitationSchema
);

export default Invitation;

