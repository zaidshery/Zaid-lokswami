import connectDB from '@/lib/db/mongoose';
import { normalizeStoryMediaAssets } from '@/lib/content/storyMedia';
import Story from '@/lib/models/Story';
import { listAllStoredStories } from '@/lib/storage/storiesFile';
import {
  STORY_VIDEO_STORAGE_PROVIDER,
} from '@/lib/storage/storyVideoUpload';

type StoryUsageRecord = {
  mediaType?: string;
  mediaSizeBytes?: number;
  storageProvider?: string;
  mediaAssets?: unknown;
  updatedAt?: string | Date;
};

const DEFAULT_MONTHLY_BUDGET_GB = 52;
const DEFAULT_ALERT_THRESHOLD_PERCENT = 85;

function getMonthlyBudgetBytes() {
  const configuredGb = Number.parseFloat(String(process.env.STORY_VIDEO_MONTHLY_BUDGET_GB || ''));
  const budgetGb = Number.isFinite(configuredGb) && configuredGb > 0
    ? configuredGb
    : DEFAULT_MONTHLY_BUDGET_GB;

  return Math.round(budgetGb * 1024 * 1024 * 1024);
}

function getAlertThresholdPercent() {
  const configuredThreshold = Number.parseFloat(
    String(process.env.STORY_VIDEO_USAGE_ALERT_THRESHOLD_PERCENT || '')
  );

  if (!Number.isFinite(configuredThreshold) || configuredThreshold <= 0 || configuredThreshold > 100) {
    return DEFAULT_ALERT_THRESHOLD_PERCENT;
  }

  return configuredThreshold;
}

function isCurrentMonth(value: string | Date | undefined) {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  const now = new Date();
  return (
    parsed.getUTCFullYear() === now.getUTCFullYear() &&
    parsed.getUTCMonth() === now.getUTCMonth()
  );
}

function sumCurrentMonthUsage(stories: StoryUsageRecord[]) {
  return stories.reduce((total, story) => {
    const mediaAssets = normalizeStoryMediaAssets(story.mediaAssets);
    if (mediaAssets.length > 0) {
      return (
        total +
        mediaAssets.reduce((assetTotal, asset) => {
          if (
            asset.kind !== 'video' ||
            asset.storageProvider !== STORY_VIDEO_STORAGE_PROVIDER ||
            !isCurrentMonth(asset.createdAt || story.updatedAt)
          ) {
            return assetTotal;
          }

          const sizeBytes = Number(asset.sizeBytes || 0);
          if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
            return assetTotal;
          }

          return assetTotal + sizeBytes;
        }, 0)
      );
    }

    if (
      story.mediaType !== 'video' ||
      story.storageProvider !== STORY_VIDEO_STORAGE_PROVIDER ||
      !isCurrentMonth(story.updatedAt)
    ) {
      return total;
    }

    const mediaSizeBytes = Number(story.mediaSizeBytes || 0);
    if (!Number.isFinite(mediaSizeBytes) || mediaSizeBytes <= 0) {
      return total;
    }

    return total + mediaSizeBytes;
  }, 0);
}

async function listUsageStories(): Promise<StoryUsageRecord[]> {
  if (!process.env.MONGODB_URI?.trim()) {
    return listAllStoredStories();
  }

  try {
    await connectDB();
    return (await Story.find(
      { mediaType: 'video', storageProvider: STORY_VIDEO_STORAGE_PROVIDER },
      'mediaType mediaSizeBytes storageProvider mediaAssets updatedAt'
    ).lean()) as StoryUsageRecord[];
  } catch (error) {
    console.error('Falling back to file-store story usage summary.', error);
    return listAllStoredStories();
  }
}

export async function getStoryVideoMonthlyUsageSummary() {
  const stories = await listUsageStories();
  const currentMonthBytes = sumCurrentMonthUsage(stories);
  const monthlyBudgetBytes = getMonthlyBudgetBytes();
  const alertThresholdPercent = getAlertThresholdPercent();
  const usagePercent = monthlyBudgetBytes > 0 ? (currentMonthBytes / monthlyBudgetBytes) * 100 : 0;
  const alertTriggered = usagePercent >= alertThresholdPercent;

  return {
    currentMonthBytes,
    monthlyBudgetBytes,
    alertThresholdPercent,
    usagePercent: Number(usagePercent.toFixed(2)),
    alertTriggered,
    message: alertTriggered
      ? `Story video uploads have reached ${usagePercent.toFixed(1)}% of the monthly storage budget target.`
      : '',
  };
}
