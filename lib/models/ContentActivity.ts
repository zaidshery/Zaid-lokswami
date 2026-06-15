import mongoose, { type Model } from 'mongoose';
import {
  EPAPER_PRODUCTION_STATUSES,
  WORKFLOW_CONTENT_TYPES,
  WORKFLOW_STATUSES,
  type ContentActivityStatus,
  type WorkflowContentType,
} from '@/lib/workflow/types';

export interface IContentActivity {
  contentType: WorkflowContentType;
  contentId: string;
  parentId?: string;
  action: string;
  fromStatus?: ContentActivityStatus;
  toStatus?: ContentActivityStatus;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ContentActivitySchema = new mongoose.Schema<IContentActivity>(
  {
    contentType: { type: String, enum: WORKFLOW_CONTENT_TYPES, required: true },
    contentId: { type: String, required: true, trim: true, maxlength: 120 },
    parentId: { type: String, trim: true, maxlength: 120, default: '' },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    fromStatus: {
      type: String,
      enum: [...WORKFLOW_STATUSES, ...EPAPER_PRODUCTION_STATUSES],
      default: undefined,
    },
    toStatus: {
      type: String,
      enum: [...WORKFLOW_STATUSES, ...EPAPER_PRODUCTION_STATUSES],
      default: undefined,
    },
    actorId: { type: String, trim: true, maxlength: 120, default: '' },
    actorName: { type: String, trim: true, maxlength: 200, default: '' },
    actorEmail: { type: String, trim: true, lowercase: true, maxlength: 320, default: '' },
    actorRole: { type: String, trim: true, maxlength: 80, default: '' },
    message: { type: String, trim: true, maxlength: 2000, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ContentActivitySchema.index({ contentType: 1, contentId: 1, createdAt: -1 });
ContentActivitySchema.index({ createdAt: -1 });
ContentActivitySchema.index({ contentType: 1, createdAt: -1 });
ContentActivitySchema.index({ actorEmail: 1, createdAt: -1 });

const ContentActivity: Model<IContentActivity> =
  (mongoose.models.ContentActivity as Model<IContentActivity>) ||
  mongoose.model<IContentActivity>('ContentActivity', ContentActivitySchema);

export default ContentActivity;
