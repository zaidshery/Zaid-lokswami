import mongoose from 'mongoose';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';

const VIDEO_CATEGORY_ENUM = NEWS_CATEGORIES.map((category) => category.nameEn);

export interface IVideo {
  _id?: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  isShort: boolean;
  isPublished: boolean;
  shortsRank: number;
  views: number;
  publishedAt: Date;
  updatedAt: Date;
}

const VideoSchema = new mongoose.Schema<IVideo>({
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 1000 },
  thumbnail: { type: String, required: true },
  videoUrl: { type: String, required: true },
  duration: { type: Number, required: true },
  category: { type: String, required: true, enum: VIDEO_CATEGORY_ENUM },
  isShort: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  shortsRank: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  publishedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Video || mongoose.model('Video', VideoSchema);
