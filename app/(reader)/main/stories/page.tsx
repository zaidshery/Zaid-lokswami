import type { Metadata } from 'next';
import {
  appendSocialOgImageVersion,
  buildStoriesPageMetadata,
  buildStoryPageMetadata,
} from '@/lib/seo/readerPageMetadata';
import { getPublicStoryForMetadata } from '@/lib/server/publicStoryMetadata';
import StoriesPageClient from './StoriesPageClient';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toSingleString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function resolveSafeFrom(value: string | string[] | undefined) {
  const from = toSingleString(value).trim();
  if (!from.startsWith('/main')) return '/main';
  return from;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : {};
  const storyId = toSingleString(resolvedParams.story).trim();
  if (!storyId) {
    return buildStoriesPageMetadata();
  }

  const story = await getPublicStoryForMetadata(storyId);
  if (!story) {
    return buildStoriesPageMetadata();
  }

  return buildStoryPageMetadata({
    storyId: story.id,
    title: story.title,
    description: story.caption,
    category: story.category,
    image: appendSocialOgImageVersion(`/api/og/story?id=${encodeURIComponent(story.id)}`),
  });
}

export default async function MojoStoriesPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedStoryId = toSingleString(resolvedParams.story).trim();
  const initialSelectedStory = selectedStoryId
    ? await getPublicStoryForMetadata(selectedStoryId)
    : null;

  return (
    <StoriesPageClient
      initialFrom={resolveSafeFrom(resolvedParams.from)}
      initialSelectedStoryId={selectedStoryId}
      initialSelectedStory={initialSelectedStory}
    />
  );
}
