import mongoose, { type Model, type Types } from 'mongoose';

export interface IPollVote extends mongoose.Document {
  pollId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  ipAddress: string;
  optionIndex: number;
  voterFingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

const PollVoteSchema = new mongoose.Schema<IPollVote>(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    optionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    voterFingerprint: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
  },
  {
    timestamps: true,
  }
);

PollVoteSchema.index({ pollId: 1, voterFingerprint: 1 }, { unique: true });
PollVoteSchema.index({ pollId: 1, createdAt: -1 });

const existingPollVoteModel = mongoose.models.PollVote as Model<IPollVote> | undefined;

const PollVote: Model<IPollVote> =
  existingPollVoteModel || mongoose.model<IPollVote>('PollVote', PollVoteSchema);

export default PollVote;

