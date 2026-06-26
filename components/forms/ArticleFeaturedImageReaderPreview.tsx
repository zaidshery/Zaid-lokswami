'use client';
/* eslint-disable @next/next/no-img-element */

import { Image as ImageIcon } from 'lucide-react';

type ArticleFeaturedImageReaderPreviewProps = {
  image?: string;
  title?: string;
  summary?: string;
  caption?: string;
  credit?: string;
  alt?: string;
  category?: string;
};

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
}: ArticleFeaturedImageReaderPreviewProps) {
  const displayTitle = title.trim() || 'Untitled article';
  const displayCaption = caption.trim() || summary.trim();
  const displayCredit = credit.trim();
  const displayCategory = category.trim() || 'News';
  const imageUrl = image.trim();
  const isHindiPreview = hasDevanagariText(
    `${displayTitle} ${displayCaption} ${displayCredit}`
  );

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
            Reader image preview
          </span>
        </div>
      </div>

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt.trim() || displayTitle}
          className="aspect-[16/9] w-full bg-zinc-950 object-contain"
        />
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-zinc-100 text-zinc-500">
          <div className="text-center">
            <ImageIcon className="mx-auto h-6 w-6" />
            <p className="mt-2 text-xs font-semibold">Image appears here</p>
          </div>
        </div>
      )}

      <div className="space-y-2 px-3 py-3">
        <p className="line-clamp-2 text-sm font-bold leading-5 text-zinc-950">
          {displayTitle}
        </p>
        {displayCaption ? (
          <p className="line-clamp-3 text-xs leading-5 text-zinc-600">
            {displayCaption}
          </p>
        ) : null}
        {displayCredit ? (
          <p className="text-[11px] font-semibold text-zinc-500">{displayCredit}</p>
        ) : null}
      </div>
    </div>
  );
}
