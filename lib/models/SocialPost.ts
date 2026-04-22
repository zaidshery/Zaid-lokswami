import mongoose from 'mongoose';
import { WorkflowActorRefSchema } from '@/lib/models/schemas/workflow';

const SocialPostSchema = new mongoose.Schema({
  sourceStoryId: { type: String, required: true, trim: true },
  sourceArticleId: { type: String, default: '', trim: true },
  platform: {
    type: String,
    enum: ['youtube', 'facebook', 'instagram'],
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'approved', 'scheduled', 'publishing', 'published', 'failed'],
    default: 'draft',
  },
  caption: { type: String, default: '' },
  hashtags: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  scheduledAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
  externalPostId: { type: String, default: '', trim: true },
  externalUrl: { type: String, default: '', trim: true },
  lastError: { type: String, default: '' },
  automationProvider: {
    type: String,
    enum: ['manual', 'n8n', 'generic_webhook'],
    default: 'manual',
  },
  automationDispatchedAt: { type: Date, default: null },
  automationExecutionId: { type: String, default: '', trim: true },
  automationExecutionUrl: { type: String, default: '', trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: WorkflowActorRefSchema, default: null },
});

SocialPostSchema.index({ sourceStoryId: 1, platform: 1 }, { unique: true });
SocialPostSchema.index({ status: 1, updatedAt: -1 });
SocialPostSchema.index({ sourceArticleId: 1, updatedAt: -1 });

export default mongoose.models.SocialPost ||
  mongoose.model('SocialPost', SocialPostSchema);
