import mongoose from 'mongoose';

export interface IStory {
  _id?: string;
  title: string;
  caption: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  category: string;
  author: string;
  durationSeconds: number;
  priority: number;
  views: number;
  isPublished: boolean;
  publishedAt: Date;
  updatedAt: Date;
  embedding: number[];
  embeddingGeneratedAt: Date | null;
  aiSummary: string;
}

const StorySchema = new mongoose.Schema<IStory>({
  title: { type: String, required: true, maxlength: 140 },
  caption: { type: String, default: '', maxlength: 300 },
  thumbnail: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  mediaUrl: { type: String, default: '' },
  linkUrl: { type: String, default: '' },
  linkLabel: { type: String, default: '' },
  category: { type: String, default: 'General' },
  author: { type: String, default: 'Desk' },
  durationSeconds: { type: Number, default: 6, min: 2, max: 180 },
  priority: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  publishedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  embedding: { type: [Number], default: [], select: false },
  embeddingGeneratedAt: { type: Date, default: null },
  aiSummary: { type: String, default: '' },
});

export default mongoose.models.Story || mongoose.model('Story', StorySchema);
