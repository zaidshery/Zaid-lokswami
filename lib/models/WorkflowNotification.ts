import mongoose, { type Model } from 'mongoose';
import { WORKFLOW_CONTENT_TYPES } from '@/lib/workflow/types';

export interface IWorkflowNotification {
  recipientId: string;
  recipientEmail: string;
  eventType: string;
  contentType: string;
  contentId: string;
  publicationType: string;
  title: string;
  message: string;
  messageHi: string;
  href: string;
  dedupeKey: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowNotificationSchema = new mongoose.Schema<IWorkflowNotification>(
  {
    recipientId: { type: String, trim: true, maxlength: 160, default: '' },
    recipientEmail: { type: String, trim: true, lowercase: true, maxlength: 320, required: true },
    eventType: { type: String, trim: true, maxlength: 80, required: true },
    contentType: { type: String, enum: WORKFLOW_CONTENT_TYPES, required: true },
    contentId: { type: String, trim: true, maxlength: 160, required: true },
    publicationType: { type: String, enum: ['', 'epaper', 'emagazine'], default: '' },
    title: { type: String, trim: true, maxlength: 240, required: true },
    message: { type: String, trim: true, maxlength: 1000, required: true },
    messageHi: { type: String, trim: true, maxlength: 1000, default: '' },
    href: { type: String, trim: true, maxlength: 500, required: true },
    dedupeKey: { type: String, trim: true, maxlength: 500, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

WorkflowNotificationSchema.index({ recipientEmail: 1, readAt: 1, createdAt: -1 });
WorkflowNotificationSchema.index({ dedupeKey: 1 }, { unique: true });
WorkflowNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

const WorkflowNotification: Model<IWorkflowNotification> =
  (mongoose.models.WorkflowNotification as Model<IWorkflowNotification>) ||
  mongoose.model<IWorkflowNotification>('WorkflowNotification', WorkflowNotificationSchema);

export default WorkflowNotification;
