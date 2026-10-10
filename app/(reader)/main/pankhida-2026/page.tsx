import type { Metadata } from 'next';
import Link from 'next/link';
import { buildYouTubeEmbedUrl, buildYouTubeWatchUrl, extractYouTubeVideoId } from '@/lib/utils/youtube';
import { readPankhidaConfig } from '@/lib/pankhida/storage';
import { getCurrentPankhidaVideo } from '@/lib/server/publicPankhidaVideo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pankhida 2026 Live | Lokswami',
  description: 'Watch Pankhida 2026 live and replay coverage on Lokswami.',
};

export default async function PankhidaPage() {
  const [config, cmsVideo] = await Promise.all([readPankhidaConfig(), getCurrentPankhidaVideo()]);
  const videoId = extractYouTubeVideoId(cmsVideo?.youtubeUrl || config.youtubeUrl);
  const canPlay = Boolean(videoId) && (Boolean(cmsVideo) || config.status !== 'upcoming');
  const isLive = cmsVideo
    ? config.status !== 'ended' || new Date(cmsVideo.publishedAt).getTime() > new Date(config.updatedAt).getTime()
    : config.status === 'live';

  return (
    <article className="mx-auto w-full max-w-6xl px-1 py-5 sm:px-4 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-white">Pankhida 2026</span>
        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{isLive && canPlay ? 'Live now' : canPlay ? 'Watch replay' : 'Coming soon'}</span>
      </div>
      <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl lg:text-5xl">Pankhida 2026</h1>
      {config.description ? <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-700 dark:text-zinc-300">{config.description}</p> : null}

      <div className="mt-6 overflow-hidden rounded-2xl bg-black shadow-xl sm:mt-8">
        {canPlay && videoId ? (
          <div className="aspect-video w-full">
            <iframe
              title="Pankhida 2026 YouTube stream"
              src={buildYouTubeEmbedUrl(videoId, { isLive, autoplay: false, playsinline: true, enablejsapi: false })}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex aspect-video min-h-52 items-center justify-center px-6 text-center text-white">
            <div><p className="text-xl font-black sm:text-2xl">Pankhida 2026 is coming soon</p><p className="mt-2 text-sm text-zinc-300">The live stream will appear here when it begins.</p></div>
          </div>
        )}
      </div>
      {canPlay && videoId ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Having trouble playing? <a href={buildYouTubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer" className="font-bold text-red-600 underline dark:text-red-400">Watch on YouTube</a>.</p>
      ) : null}
      <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800"><Link href="/main" className="text-sm font-bold text-red-600 hover:underline dark:text-red-400">Back to Home</Link></div>
    </article>
  );
}
