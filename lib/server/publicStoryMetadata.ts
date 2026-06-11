import { Types } from 'mongoose';
import { mapLiveStoriesToVisualStories, type VisualStory } from '@/lib/content/visualStories';
import { isMongoAvailable } from '@/lib/db/mongoAvailability';
import Story from '@/lib/models/Story';
import { getStoredStoryById } from '@/lib/storage/storiesFile';

type PublicStorySource = {
  _id?: string;
  id?: string;
  title?: string;
  caption?: string;
  thumbnail?: string;
  mediaType?: 'image' | 'video' | string;
  mediaUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  category?: string;
  author?: string;
  durationSeconds?: number;
  priority?: number;
  views?: number;
  publishedAt?: string | Date;
  isPublished?: boolean;
  mediaAssets?: unknown;
};

type StoryMapperInput = Parameters<typeof mapLiveStoriesToVisualStories>[0][number];

function mapPublicStory(input: PublicStorySource | null | undefined) {
  if (!input) return null;
  const normalizedInput: StoryMapperInput = {
    ...input,
    publishedAt:
      input.publishedAt instanceof Date
        ? input.publishedAt.toISOString()
        : input.publishedAt,
  };
  const mapped = mapLiveStoriesToVisualStories([normalizedInput], 1);
  return mapped[0] || null;
}

async function getMongoStory(id: string) {
  if (!(await isMongoAvailable({ label: 'public story metadata lookup' }))) {
    return null;
  }

  try {
    if (!Types.ObjectId.isValid(id)) return null;

    const record = await Story.findOne({ _id: id, isPublished: true })
      .select(
        '_id title caption thumbnail mediaType mediaUrl linkUrl linkLabel category author durationSeconds priority views publishedAt isPublished mediaAssets'
      )
      .lean<PublicStorySource | null>();

    return mapPublicStory(record);
  } catch (error) {
    console.error('Failed to load public story metadata from MongoDB, falling back.', error);
    return null;
  }
}

async function getStoredStory(id: string) {
  const record = await getStoredStoryById(id);
  return mapPublicStory(record || null);
}

export async function getPublicStoryForMetadata(id: string): Promise<VisualStory | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const mongoRecord = await getMongoStory(normalizedId);
  if (mongoRecord) return mongoRecord;

  return getStoredStory(normalizedId);
}
