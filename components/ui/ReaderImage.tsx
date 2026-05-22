'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';
import {
  isLegacyCloudinaryImageUrl,
  resolveArticleImageSrc,
} from '@/lib/utils/articleMedia';

type ReaderImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
};

const DEFAULT_FALLBACK_SRC = '/placeholders/news-16x9.svg';

export default function ReaderImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  onError,
  ...props
}: ReaderImageProps) {
  const primarySrc = resolveArticleImageSrc(src, fallbackSrc);
  const [resolvedSrc, setResolvedSrc] = useState(primarySrc);
  const shouldBypassNextOptimizer = isLegacyCloudinaryImageUrl(resolvedSrc);

  useEffect(() => {
    setResolvedSrc(primarySrc);
  }, [primarySrc]);

  return (
    <Image
      {...props}
      src={resolvedSrc}
      alt={alt}
      unoptimized={props.unoptimized || shouldBypassNextOptimizer}
      onError={(event) => {
        if (resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
}
