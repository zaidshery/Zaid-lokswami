import 'server-only';

import type { AdminSessionIdentity } from '@/lib/auth/admin';
import {
  buildEpaperStoryTtsText,
  ensureTtsAsset,
} from '@/lib/server/ttsAssets';

type Actor = Pick<AdminSessionIdentity, 'id' | 'email' | 'role'>;

type StorySource = {
  _id: unknown;
  epaperId: unknown;
  pageNumber?: unknown;
  title?: unknown;
  excerpt?: unknown;
  contentHtml?: unknown;
};

type PaperSource = {
  title?: unknown;
  cityName?: unknown;
  publishDate?: unknown;
};

function toPublishDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value || '');
}

export async function ensureEpaperStoryAudio(input: {
  paper: PaperSource;
  story: StorySource;
  actor: Actor;
  source: string;
}) {
  const text = buildEpaperStoryTtsText({
    title: String(input.story.title || ''),
    excerpt: String(input.story.excerpt || ''),
    contentHtml: String(input.story.contentHtml || ''),
  });

  if (!text) {
    return { attempted: false, ready: false, error: 'Story has no readable text.' };
  }

  const result = await ensureTtsAsset({
    sourceType: 'epaperArticle',
    sourceId: String(input.story._id || ''),
    sourceParentId: String(input.story.epaperId || ''),
    variant: 'epaper_story',
    title: String(input.story.title || input.paper.title || ''),
    text,
    forceRegenerate: false,
    actor: input.actor,
    metadata: {
      source: input.source,
      pageNumber: Number(input.story.pageNumber || 1),
      paperTitle: String(input.paper.title || ''),
      cityName: String(input.paper.cityName || ''),
      publishDate: toPublishDate(input.paper.publishDate),
    },
  });

  return {
    attempted: true,
    ready: Boolean(result.asset?.status === 'ready' && result.asset.audioUrl),
    reused: result.reused,
    error: result.error || '',
  };
}
