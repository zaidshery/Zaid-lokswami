import mongoose from 'mongoose';

const MediaSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  uploadedBy: { type: String, default: 'system' },
  createdAt: { type: Date, default: Date.now },
});

MediaSchema.index({ uploadedBy: 1, createdAt: -1 });

const Media = mongoose.models.Media || mongoose.model('Media', MediaSchema);
export default Media;
