'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import StoryViewer from '@/app/components/content/StoryViewer';
import { fetchMergedLiveArticles } from '@/lib/content/liveArticles';
import { fetchLiveStories } from '@/lib/content/liveStories';
import { markStoryAsViewed } from '@/lib/content/storyPersistence';
import {
  buildVisualStoriesFromArticles,
  type VisualStory,
} from '@/lib/content/visualStories';
import { articles as mockArticles, type Article } from '@/lib/mock/data';
import { useAppStore } from '@/lib/store/appStore';

function resolveSafeFrom(value: string | null) {
  const from = (value || '').trim();
  if (!from.startsWith('/main')) return '/main';
  return from;
}

function MojoStoriesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setImmersiveVideoMode = useAppStore((state) => state.setImmersiveVideoMode);

  const [feedArticles, setFeedArticles] = useState<Article[]>(mockArticles);
  const [cmsStories, setCmsStories] = useState<VisualStory[]>([]);

  useEffect(() => {
    setImmersiveVideoMode(true);
    return () => setImmersiveVideoMode(false);
  }, [setImmersiveVideoMode]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const merged = await fetchMergedLiveArticles(120);
      if (active) {
        setFeedArticles(merged);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadStories = async () => {
      const rows = await fetchLiveStories(40);
      if (active) {
        setCmsStories(rows);
      }
    };

    loadStories();
    return () => {
      active = false;
    };
  }, []);

  const stories = useMemo(
    () =>
      cmsStories.length
        ? cmsStories.slice(0, 40)
        : buildVisualStoriesFromArticles(feedArticles, 40),
    [cmsStories, feedArticles]
  );

  const selectedStoryId = (searchParams.get('story') || '').trim();
  const from = resolveSafeFrom(searchParams.get('from'));

  const initialIndex = useMemo(() => {
    if (!stories.length) return 0;
    const foundIndex = stories.findIndex((story) => story.id === selectedStoryId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [selectedStoryId, stories]);

  const onClose = () => {
    router.push(from);
  };

  if (!stories.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <div className="space-y-4">
          <p className="text-lg font-semibold">No mojo stories available right now.</p>
          <Link
            href={from}
            className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StoryViewer
      stories={stories}
      initialIndex={initialIndex}
      isOpen
      onClose={onClose}
      onStoryViewed={(storyId) => {
        markStoryAsViewed(storyId);
      }}
      variant="reel"
    />
  );
}

export default function MojoStoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-sm font-medium text-white/80">
          Loading stories...
        </div>
      }
    >
      <MojoStoriesPageContent />
    </Suspense>
  );
}
