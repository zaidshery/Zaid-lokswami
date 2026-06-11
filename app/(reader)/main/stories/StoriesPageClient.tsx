'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import StoryViewer from '@/components/ui/StoryViewer';
import { fetchMergedLiveArticles } from '@/lib/content/liveArticles';
import { fetchLiveStories } from '@/lib/content/liveStories';
import { markStoryAsViewed } from '@/lib/content/storyPersistence';
import {
  buildVisualStoriesFromArticles,
  type VisualStory,
} from '@/lib/content/visualStories';
import { articles as mockArticles, type Article } from '@/lib/mock/data';
import { useAppStore } from '@/lib/store/appStore';

interface StoriesPageClientProps {
  initialFrom: string;
  initialSelectedStoryId: string;
  initialSelectedStory: VisualStory | null;
}

function mergeSelectedStory(stories: VisualStory[], selectedStory: VisualStory | null, limit: number) {
  if (!selectedStory) return stories.slice(0, limit);

  const withoutSelected = stories.filter((story) => story.id !== selectedStory.id);
  return [selectedStory, ...withoutSelected].slice(0, limit);
}

export default function StoriesPageClient({
  initialFrom,
  initialSelectedStoryId,
  initialSelectedStory,
}: StoriesPageClientProps) {
  const router = useRouter();
  const setImmersiveVideoMode = useAppStore((state) => state.setImmersiveVideoMode);

  const [feedArticles, setFeedArticles] = useState<Article[]>(mockArticles);
  const [cmsStories, setCmsStories] = useState<VisualStory[]>(
    initialSelectedStory ? [initialSelectedStory] : []
  );

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

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadStories = async () => {
      const rows = await fetchLiveStories(40);
      if (active) {
        setCmsStories(mergeSelectedStory(rows, initialSelectedStory, 40));
      }
    };

    void loadStories();
    return () => {
      active = false;
    };
  }, [initialSelectedStory]);

  const stories = useMemo(() => {
    const fallbackStories = buildVisualStoriesFromArticles(feedArticles, 40);
    const preferredStories = cmsStories.length ? cmsStories : fallbackStories;
    return mergeSelectedStory(preferredStories, initialSelectedStory, 40);
  }, [cmsStories, feedArticles, initialSelectedStory]);

  const initialIndex = useMemo(() => {
    if (!stories.length) return 0;
    const foundIndex = stories.findIndex((story) => story.id === initialSelectedStoryId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [initialSelectedStoryId, stories]);

  const onClose = () => {
    router.push(initialFrom);
  };

  if (!stories.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <div className="space-y-4">
          <p className="text-lg font-semibold">No mojo stories available right now.</p>
          <Link
            href={initialFrom}
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
