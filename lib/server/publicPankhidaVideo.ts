import 'server-only';

import { isMongoAvailable } from '@/lib/db/mongoAvailability';
import Video from '@/lib/models/Video';
import { isPubliclyPublishedVideo, type PublicVideoSource } from '@/lib/content/videoPublication';
import { listAllStoredVideos } from '@/lib/storage/videosFile';
import { extractYouTubeVideoId } from '@/lib/utils/youtube';

export type PankhidaVideo = { title: string; youtubeUrl: string; publishedAt: string };

function toPankhidaVideo(source: PublicVideoSource, now: Date): PankhidaVideo | null {
  if (source.destination !== 'pankhida-2026' || !isPubliclyPublishedVideo(source, now)) return null;
  const youtubeUrl = String(source.videoUrl || '').trim();
  if (!extractYouTubeVideoId(youtubeUrl)) return null;
  return { title: String(source.title || 'Pankhida 2026'), youtubeUrl, publishedAt: String(source.publishedAt || '') };
}

export async function getCurrentPankhidaVideo(now = new Date()): Promise<PankhidaVideo | null> {
  if (await isMongoAvailable({ label: 'public Pankhida 2026 video' })) {
    try {
      const candidates = await Video.find({
        destination: 'pankhida-2026',
        isPublished: true,
        $and: [
          { $or: [{ 'workflow.status': 'published' }, { 'workflow.status': { $exists: false } }] },
          { $or: [{ 'workflow.scheduledFor': { $exists: false } }, { 'workflow.scheduledFor': null }, { 'workflow.scheduledFor': { $lte: now } }] },
          { $or: [{ publishedAt: { $exists: false } }, { publishedAt: { $lte: now } }] },
          { $or: [{ processingStatus: 'ready' }, { processingStatus: { $exists: false } }] },
        ],
      })
        .select('title videoUrl destination isPublished workflow publishedAt processingStatus')
        .sort({ publishedAt: -1, _id: -1 })
        .limit(20)
        .lean();
      return candidates.map((item) => toPankhidaVideo(item as PublicVideoSource, now)).find(Boolean) || null;
    } catch (error) {
      console.error('Failed to load Pankhida video from MongoDB; using file store.', error);
    }
  }

  const rows = await listAllStoredVideos();
  return rows
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .map((item) => toPankhidaVideo(item, now))
    .find(Boolean) || null;
}
