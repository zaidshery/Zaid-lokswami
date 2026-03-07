'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FileText, Newspaper, Play, PlayCircle, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AiContentGroups, AiContentItem } from './types';

type AiChatContentCardsProps = {
  content: AiContentGroups;
  isLight: boolean;
};

type ContentSection = {
  key: keyof AiContentGroups;
  label: string;
  items: AiContentItem[];
};

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('hi-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 1) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs
    .toString()
    .padStart(2, '0')}`;
}

function CardShell({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border transition hover:scale-[1.02] ${className}`}
    >
      {children}
    </Link>
  );
}

function ArticleCard({ item, isLight }: { item: AiContentItem; isLight: boolean }) {
  return (
    <CardShell
      href={item.url}
      className={`border-l-2 border-l-red-500 p-3 ${
        isLight ? 'border-zinc-200 bg-white' : 'border-zinc-700/70 bg-zinc-900/80'
      }`}
    >
      <div className="flex gap-3">
        <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-xl">
          <Image
            src={item.thumbnail}
            alt={item.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              {item.category}
            </span>
            {item.date ? (
              <span className="text-[10px] text-zinc-500">{formatDateLabel(item.date)}</span>
            ) : null}
          </div>

          <p
            className={`line-clamp-2 text-sm font-semibold ${
              isLight ? 'text-zinc-900' : 'text-zinc-100'
            }`}
          >
            {item.title}
          </p>
          <p className="mt-2 text-xs font-semibold text-red-400">पूरी खबर पढ़ें →</p>
        </div>
      </div>
    </CardShell>
  );
}

function EPaperCard({ item, isLight }: { item: AiContentItem; isLight: boolean }) {
  return (
    <CardShell
      href={item.url}
      className={`p-3 ${
        isLight ? 'border-amber-300 bg-amber-50' : 'border-amber-500/30 bg-amber-500/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <Newspaper className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            📰 E-Paper
          </span>
          <p
            className={`mt-2 line-clamp-2 text-sm font-semibold ${
              isLight ? 'text-zinc-900' : 'text-zinc-100'
            }`}
          >
            {item.title}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{formatDateLabel(item.date)}</p>
          <p className="mt-2 text-xs font-semibold text-amber-400">E-Paper देखें →</p>
        </div>
      </div>
    </CardShell>
  );
}

function VideoCard({ item, isLight }: { item: AiContentItem; isLight: boolean }) {
  return (
    <CardShell
      href={item.url}
      className={`p-3 ${
        isLight ? 'border-zinc-200 bg-white' : 'border-zinc-700/70 bg-zinc-900/80'
      }`}
    >
      <div className="flex gap-3">
        <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-xl">
          <Image
            src={item.thumbnail}
            alt={item.title}
            fill
            sizes="64px"
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex rounded-full bg-red-500 p-2 text-white shadow-md shadow-red-500/30">
              <PlayCircle className="h-3.5 w-3.5 fill-current" />
            </span>
          </div>
          {item.durationSeconds ? (
            <span className="absolute right-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {formatDuration(item.durationSeconds)}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
            🎬 Video
          </span>
          <p
            className={`mt-2 line-clamp-2 text-sm font-semibold ${
              isLight ? 'text-zinc-900' : 'text-zinc-100'
            }`}
          >
            {item.title}
          </p>
          <p className="mt-2 text-xs font-semibold text-sky-400">वीडियो देखें →</p>
        </div>
      </div>
    </CardShell>
  );
}

function MojoCard({ item, isLight }: { item: AiContentItem; isLight: boolean }) {
  return (
    <Link
      href={item.url}
      className={`w-[132px] flex-shrink-0 rounded-2xl border p-2 transition hover:scale-105 ${
        isLight ? 'border-purple-300 bg-purple-50' : 'border-purple-500/20 bg-purple-500/10'
      }`}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl">
        <Image
          src={item.thumbnail}
          alt={item.title}
          fill
          sizes="132px"
          className="object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex rounded-full bg-red-500 p-2 text-white shadow-md shadow-red-500/30">
            <Play className="h-3.5 w-3.5 fill-current" />
          </span>
        </div>
        {item.durationSeconds ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {formatDuration(item.durationSeconds)}
          </span>
        ) : null}
      </div>

      <div className="mt-2">
        <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
          ⚡ Mojo
        </span>
        <p
          className={`mt-2 line-clamp-2 text-xs font-semibold leading-5 ${
            isLight ? 'text-zinc-900' : 'text-zinc-100'
          }`}
        >
          {item.title}
        </p>
      </div>
    </Link>
  );
}

export default function AiChatContentCards({
  content,
  isLight,
}: AiChatContentCardsProps) {
  const sections: ContentSection[] = [
    { key: 'articles', label: 'लेख', items: content.articles },
    { key: 'epapers', label: 'E-Paper', items: content.epapers },
    { key: 'videos', label: 'वीडियो', items: content.videos },
    { key: 'stories', label: 'Mojo', items: content.stories },
  ];

  const hasAny = sections.some((section) => section.items.length > 0);
  if (!hasAny) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {sections.map((section) => {
        if (!section.items.length) return null;

        return (
          <div key={section.key} className="space-y-2">
            <div className="flex items-center gap-2">
              {section.key === 'articles' ? (
                <FileText className="h-3.5 w-3.5 text-red-400" />
              ) : null}
              {section.key === 'epapers' ? (
                <Newspaper className="h-3.5 w-3.5 text-amber-400" />
              ) : null}
              {section.key === 'videos' ? (
                <PlayCircle className="h-3.5 w-3.5 text-sky-400" />
              ) : null}
              {section.key === 'stories' ? (
                <Zap className="h-3.5 w-3.5 text-purple-400" />
              ) : null}
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {section.label}
              </p>
            </div>

            {section.key === 'stories' ? (
              <div className="scrollbar-hide overflow-x-auto">
                <div className="flex gap-2 pb-1">
                  {section.items.map((item) => (
                    <MojoCard key={`${item.type}-${item.id}`} item={item} isLight={isLight} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {section.items.map((item) => {
                  if (item.type === 'article') {
                    return (
                      <ArticleCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        isLight={isLight}
                      />
                    );
                  }

                  if (item.type === 'epaper') {
                    return (
                      <EPaperCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        isLight={isLight}
                      />
                    );
                  }

                  return (
                    <VideoCard
                      key={`${item.type}-${item.id}`}
                      item={item}
                      isLight={isLight}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
