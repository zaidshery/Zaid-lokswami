import mongoose from 'mongoose';

const PankhidaStreamSchema = new mongoose.Schema({
  _id: { type: String, default: 'pankhida-2026' },
  status: { type: String, enum: ['upcoming', 'live', 'ended'], required: true },
  youtubeUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  updatedAt: { type: String, default: '' },
}, { versionKey: false });

export default mongoose.models.PankhidaStream || mongoose.model('PankhidaStream', PankhidaStreamSchema);
