'use client';
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

type ArticleFeaturedImageReaderPreviewProps = {
  image?: string;
  title?: string;
  summary?: string;
  caption?: string;
  credit?: string;
  alt?: string;
  category?: string;
  focalPointX?: number;
  focalPointY?: number;
};

type PreviewMode = 'desktop' | 'mobile' | 'google' | 'social';

const PREVIEW_MODES: Array<{ id: PreviewMode; label: string }> = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'google', label: 'Google News' },
  { id: 'social', label: 'Social' },
];

const HINDI_IMAGE_PREVIEW_FONT_STYLE = {
  fontFamily:
    '"Noto Sans Devanagari", "Noto Sans", Mangal, "Kohinoor Devanagari", system-ui, sans-serif',
};

function hasDevanagariText(value: string) {
  return /[\u0900-\u097F]/u.test(value);
}

export default function ArticleFeaturedImageReaderPreview({
  image = '',
  title = '',
  summary = '',
  caption = '',
  credit = '',
  alt = '',
  category = '',
  focalPointX = 50,
  focalPointY = 50,
}: ArticleFeaturedImageReaderPreviewProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const displayTitle = title.trim() || 'Untitled article';
  const displayCaption = caption.trim() || summary.trim();
  const displayCredit = credit.trim();
  const displayCategory = category.trim() || 'News';
  const imageUrl = image.trim();
  const isHindiPreview = hasDevanagariText(
    `${displayTitle} ${displayCaption} ${displayCredit}`
  );
  const imageRatioClass =
    previewMode === 'desktop'
      ? 'aspect-video'
      : previewMode === 'social'
        ? 'aspect-square'
        : 'aspect-[4/3]';
  const previewWidthClass = previewMode === 'mobile' ? 'mx-auto max-w-[260px]' : 'w-full';

  return (
    <div
      lang={isHindiPreview ? 'hi' : 'en'}
      style={{
        ...(isHindiPreview ? HINDI_IMAGE_PREVIEW_FONT_STYLE : {}),
        backgroundColor: '#fbfaf8',
        color: '#18181b',
        colorScheme: 'light',
      }}
      className="mt-4 overflow-hidden rounded-lg border border-zinc-200 shadow-sm"
    >
      <div className="border-b border-zinc-200 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-spanish-red px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {displayCategory}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Packaging preview
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4" role="tablist" aria-label="Article image packaging previews">
          {PREVIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={previewMode === mode.id}
              onClick={() => setPreviewMode(mode.id)}
              className={`min-h-9 rounded-md border px-2 py-1.5 text-[11px] font-semibold ${
                previewMode === mode.id
                  ? 'border-spanish-red bg-red-50 text-spanish-red'
                  : 'border-zinc-200 bg-white text-zinc-600'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-100 p-3" role="tabpanel" aria-label={`${PREVIEW_MODES.find((mode) => mode.id === previewMode)?.label} preview`}>
        <div className={`overflow-hidden rounded-md bg-white ${previewWidthClass}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={alt.trim() || displayTitle}
              className={`${imageRatioClass} w-full bg-zinc-950 object-cover`}
              style={{ objectPosition: `${focalPointX}% ${focalPointY}%` }}
            />
          ) : (
            <div className={`flex ${imageRatioClass} items-center justify-center bg-zinc-100 text-zinc-500`}>
              <div className="text-center">
                <ImageIcon className="mx-auto h-6 w-6" />
                <p className="mt-2 text-xs font-semibold">Image appears here</p>
              </div>
            </div>
          )}

          <div className="space-y-2 px-3 py-3">
            <p className="line-clamp-2 text-sm font-bold leading-5 text-zinc-950">{displayTitle}</p>
            {displayCaption ? <p className="line-clamp-3 text-xs leading-5 text-zinc-600">{displayCaption}</p> : null}
            {displayCredit ? <p className="text-[11px] font-semibold text-zinc-500">{displayCredit}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
