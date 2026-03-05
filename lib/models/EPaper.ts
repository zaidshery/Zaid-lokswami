import mongoose from 'mongoose';

export type EPaperStatus = 'draft' | 'published';

export interface IEPaperPage {
  pageNumber: number;
  imagePath?: string;
  width?: number;
  height?: number;
}

export interface IEPaper {
  _id?: string;
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: Date;
  pdfPath: string;
  thumbnailPath: string;
  pageCount: number;
  pages: IEPaperPage[];
  status: EPaperStatus;
  createdAt: Date;
  updatedAt: Date;
}

const EPaperPageSchema = new mongoose.Schema<IEPaperPage>(
  {
    pageNumber: { type: Number, required: true, min: 1 },
    imagePath: { type: String, default: '' },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
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
    thumbnailPath: { type: String, required: true, trim: true, maxlength: 500 },
    pageCount: { type: Number, required: true, min: 1, max: 1000 },
    pages: { type: [EPaperPageSchema], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true }
);

EPaperSchema.index({ citySlug: 1, publishDate: 1 }, { unique: true });
EPaperSchema.index({ status: 1, publishDate: -1 });
// Cursor pagination maps logical editionDate to publishDate in this schema.
EPaperSchema.index({ publishDate: -1, _id: -1 });

const EPaper =
  (mongoose.models.EPaper as mongoose.Model<IEPaper> | undefined) ||
  mongoose.model<IEPaper>('EPaper', EPaperSchema);

export default EPaper;
