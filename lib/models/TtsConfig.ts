import mongoose, { type Model } from 'mongoose';
import {
  TTS_DEFAULT_VOICE,
  TTS_PROVIDER,
} from '@/lib/constants/tts';
import {
  type TtsConfigShape,
  type TtsSurfaceConfig,
} from '@/lib/types/tts';

export interface ITtsConfig extends TtsConfigShape {
  createdAt: Date;
  updatedAt: Date;
}

const TtsSurfaceConfigSchema = new mongoose.Schema<TtsSurfaceConfig>(
  {
    enabled: { type: Boolean, default: true },
    autoGenerate: { type: Boolean, default: false },
    defaultLanguageCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
      default: 'hi-IN',
    },
    defaultVoice: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default: TTS_DEFAULT_VOICE,
    },
  },
  { _id: false }
);

const TtsConfigSchema = new mongoose.Schema<ITtsConfig>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: 'default',
    },
    provider: {
      type: String,
      enum: [TTS_PROVIDER],
      required: true,
      default: TTS_PROVIDER,
    },
    regenerateMissingFiles: { type: Boolean, default: false },
    retentionDays: { type: Number, min: 1, max: 3650, default: 90 },
    forceStorage: { type: Boolean, default: () => process.env.EPAPER_FORCE_STORAGE === '1' },
    surfaces: {
      breaking: {
        type: TtsSurfaceConfigSchema,
        default: () => ({
          enabled: true,
          autoGenerate: false,
          defaultLanguageCode: 'hi-IN',
          defaultVoice: TTS_DEFAULT_VOICE,
        }),
      },
      article: {
        type: TtsSurfaceConfigSchema,
        default: () => ({
          enabled: true,
          autoGenerate: false,
          defaultLanguageCode: 'hi-IN',
          defaultVoice: TTS_DEFAULT_VOICE,
        }),
      },
      epaper: {
        type: TtsSurfaceConfigSchema,
        default: () => ({
          enabled: true,
          autoGenerate: false,
          defaultLanguageCode: 'hi-IN',
          defaultVoice: TTS_DEFAULT_VOICE,
        }),
      },
    },
    prewarm: {
      latestBreakingLimit: { type: Number, min: 0, max: 1000, default: 10 },
      latestArticleLimit: { type: Number, min: 0, max: 1000, default: 0 },
      latestEpaperStoryLimit: { type: Number, min: 0, max: 5000, default: 50 },
    },
  },
  { timestamps: true }
);

const TtsConfig: Model<ITtsConfig> =
  (mongoose.models.TtsConfig as Model<ITtsConfig>) ||
  mongoose.model<ITtsConfig>('TtsConfig', TtsConfigSchema);

export default TtsConfig;
