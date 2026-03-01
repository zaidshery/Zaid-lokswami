'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { VisualStory } from '@/lib/content/visualStories';
import { getViewedStoryIds, markStoryAsViewed } from '@/lib/content/storyPersistence';

type StoryItem = VisualStory;

interface StoriesRailProps {
  stories: StoryItem[];
  showHeader?: boolean;
}

export default function StoriesRail({ stories, showHeader = true }: StoriesRailProps) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    setViewedIds(getViewedStoryIds());
  }, []);

  useEffect(() => {
    checkScroll();
    const onResize = () => checkScroll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [checkScroll, stories.length]);

  const visualStories = useMemo(
    () =>
      stories.map((story) => ({
        ...story,
        viewed: Boolean(story.viewed || viewedIds.has(story.id)),
      })),
    [stories, viewedIds]
  );

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 300);
  };

  const buildStoryHref = useCallback(
    (storyId: string) => {
      const safeFrom = pathname?.startsWith('/main') ? pathname : '/main';
      const params = new URLSearchParams({
        story: storyId,
        from: safeFrom,
      });
      return `/main/stories?${params.toString()}`;
    },
    [pathname]
  );

  const handleOpenStory = (index: number) => {
    if (!visualStories[index]) return;

    const viewedSet = markStoryAsViewed(visualStories[index].id);
    setViewedIds(viewedSet);
  };

  const getRingClass = (viewed?: boolean) => (viewed ? 'bg-orange-600/35' : 'bg-orange-600');

  const compactRailSpacing = !showHeader;

  return (
    <div className={`group/rail ${compactRailSpacing ? 'py-1 sm:py-1.5' : 'py-2'}`}>
      {showHeader ? (
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
            <span className="h-6 w-1.5 rounded-full bg-orange-500" />
            Mojo Stories
          </h2>
        </div>
      ) : null}

      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover/rail:opacity-100">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`cnp-motion pointer-events-auto -ml-4 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/80 bg-white/90 backdrop-blur-md hover:scale-[1.03] dark:border-zinc-700 dark:bg-zinc-900/80 ${
              !canScrollLeft ? 'hidden' : 'text-gray-800 dark:text-white'
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="pointer-events-none absolute right-0 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover/rail:opacity-100">
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`cnp-motion pointer-events-auto -mr-4 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/80 bg-white/90 backdrop-blur-md hover:scale-[1.03] dark:border-zinc-700 dark:bg-zinc-900/80 ${
              !canScrollRight ? 'hidden' : 'text-gray-800 dark:text-white'
            }`}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className={`scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto ${
            compactRailSpacing ? 'py-1 sm:py-1.5' : 'py-2'
          } pl-1 pr-5 sm:gap-4 sm:pr-6`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {visualStories.map((story, index) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.22 }}
              className="shrink-0 snap-start"
            >
              <Link
                href={buildStoryHref(story.id)}
                onClick={() => handleOpenStory(index)}
                className="group cnp-motion relative block aspect-[9/16] w-24 overflow-hidden rounded-2xl text-left hover:-translate-y-0.5 md:w-28"
                aria-label={`Open ${story.title}`}
              >
                <div
                  className={`absolute inset-0 rounded-2xl ${getRingClass(story.viewed)} p-[3px] opacity-95 transition-opacity group-hover:opacity-100`}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-[13px] bg-zinc-900">
                    {brokenImages[story.id] ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-center">
                        <span className="px-2 text-xs font-semibold text-zinc-200">
                          {story.title}
                        </span>
                      </div>
                    ) : (
                      <Image
                        src={story.thumbnail}
                        alt={story.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [story.id]: true }))
                        }
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 backdrop-blur-sm">
                        <Play className="ml-0.5 h-5 w-5 text-white" fill="white" />
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-2 right-2">
                      <p className="line-clamp-2 text-left text-xs font-semibold leading-tight text-white">
                        {story.title}
                      </p>
                    </div>

                    {story.viewed ? (
                      <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5">
                        <span className="text-[10px] font-semibold text-white">Viewed</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: visualStories.length * 0.04, duration: 0.22 }}
            className="shrink-0 snap-start"
          >
            <Link
              href={`/main/stories?${new URLSearchParams({
                from: pathname?.startsWith('/main') ? pathname : '/main',
              }).toString()}`}
              className="cnp-motion flex aspect-[9/16] w-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-600 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900/80 md:w-28"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 transition-colors dark:bg-zinc-800">
                <ChevronRight className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">See All</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
