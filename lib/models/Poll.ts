import mongoose, { type Model, type Types } from 'mongoose';
import {
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_QUESTION_LENGTH,
} from '@/lib/server/poll';

export interface IPollOption {
  text: string;
  votes: number;
}

export interface IPoll extends mongoose.Document {
  question: string;
  options: IPollOption[];
  totalVotes: number;
  status: 'active' | 'inactive';
  expiresAt?: Date | null;
  linkedArticleId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PollOptionSchema = new mongoose.Schema<IPollOption>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_POLL_OPTION_LENGTH,
    },
    votes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const PollSchema = new mongoose.Schema<IPoll>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_POLL_QUESTION_LENGTH,
    },
    options: {
      type: [PollOptionSchema],
      default: [],
    },
    totalVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    linkedArticleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PollSchema.index({ status: 1, createdAt: -1 });
PollSchema.index({ status: 1, expiresAt: 1, createdAt: -1 });

const existingPollModel = mongoose.models.Poll as Model<IPoll> | undefined;

const Poll: Model<IPoll> = existingPollModel || mongoose.model<IPoll>('Poll', PollSchema);

export default Poll;

