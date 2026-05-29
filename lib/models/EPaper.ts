import mongoose from 'mongoose';
import {
  EPaperProductionStatusSchema,
  WorkflowActorRefSchema,
  WorkflowCommentSchema,
} from '@/lib/models/schemas/workflow';
import { EPAPER_PAGE_REVIEW_STATUSES, type EPaperPageReviewStatus } from '@/lib/types/epaper';
import type { EPaperProductionStatus, WorkflowActorRef, WorkflowComment } from '@/lib/workflow/types';

export type EPaperStatus = 'draft' | 'published';

export interface IEPaperPage {
  pageNumber: number;
  imagePath?: string;
  width?: number;
  height?: number;
  reviewStatus?: EPaperPageReviewStatus;
  reviewNote?: string;
  reviewedAt?: Date | null;
  reviewedBy?: WorkflowActorRef | null;
}

export interface IEPaper {
  _id?: string;
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: Date;
  pdfPath: string;
  pdfPublicId?: string;
  pdfFormat?: string;
  thumbnailPath: string;
  // Legacy compatibility fields from older schema revisions.
  pdfUrl?: string;
  thumbnail?: string;
  pageCount: number;
  pages: IEPaperPage[];
  status: EPaperStatus;
  productionStatus: EPaperProductionStatus;
  productionAssignee: WorkflowActorRef | null;
  productionNotes: WorkflowComment[];
  qaCompletedAt: Date | null;
  sourceType?: 'manual-upload' | 'drive-import' | 'remote-import' | 'legacy' | 'unknown';
  sourceLabel?: string;
  sourceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  embedding: number[];
  embeddingGeneratedAt: Date | null;
  aiSummary: string;
}

const EPaperPageSchema = new mongoose.Schema<IEPaperPage>(
  {
    pageNumber: { type: Number, required: true, min: 1 },
    imagePath: { type: String, default: '' },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    reviewStatus: {
      type: String,
      enum: EPAPER_PAGE_REVIEW_STATUSES,
      default: 'pending',
    },
    reviewNote: { type: String, trim: true, maxlength: 2000, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: WorkflowActorRefSchema, default: null },
  },
  { _id: false }
);

const EPaperSchema = new mongoose.Schema<IEPaper>(
  {
    citySlug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    cityName: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    publishDate: { type: Date, required: true },
    pdfPath: { type: String, required: true, trim: true, maxlength: 500 },
    pdfPublicId: { type: String, trim: true, maxlength: 500, default: '' },
    pdfFormat: { type: String, trim: true, maxlength: 30, default: 'pdf' },
    thumbnailPath: { type: String, required: true, trim: true, maxlength: 500 },
    pdfUrl: { type: String, trim: true, maxlength: 500, default: '' },
    thumbnail: { type: String, trim: true, maxlength: 500, default: '' },
    pageCount: { type: Number, required: true, min: 1, max: 1000 },
    pages: { type: [EPaperPageSchema], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    productionStatus: EPaperProductionStatusSchema,
    productionAssignee: { type: WorkflowActorRefSchema, default: null },
    productionNotes: { type: [WorkflowCommentSchema], default: [] },
    qaCompletedAt: { type: Date, default: null },
    sourceType: {
      type: String,
      enum: ['manual-upload', 'drive-import', 'remote-import', 'legacy', 'unknown'],
      default: 'manual-upload',
    },
    sourceLabel: { type: String, trim: true, maxlength: 180, default: '' },
    sourceUrl: { type: String, trim: true, maxlength: 800, default: '' },
    embedding: { type: [Number], default: [], select: false },
    embeddingGeneratedAt: { type: Date, default: null },
    aiSummary: { type: String, default: '' },
  },
  { timestamps: true }
);

EPaperSchema.index({ citySlug: 1, publishDate: 1 }, { unique: true });
EPaperSchema.index({ status: 1, publishDate: -1 });
EPaperSchema.index({ productionStatus: 1, publishDate: -1 });
EPaperSchema.index({ 'productionAssignee.id': 1, productionStatus: 1, updatedAt: -1 });
// Cursor pagination maps logical editionDate to publishDate in this schema.
EPaperSchema.index({ publishDate: -1, _id: -1 });
EPaperSchema.index({ status: 1, citySlug: 1, publishDate: -1, _id: -1 });
EPaperSchema.index({ status: 1, publishDate: -1, createdAt: -1 });
EPaperSchema.index({ updatedAt: -1, _id: -1 });

const EPaper =
  (mongoose.models.EPaper as mongoose.Model<IEPaper> | undefined) ||
  mongoose.model<IEPaper>('EPaper', EPaperSchema);

export default EPaper;
