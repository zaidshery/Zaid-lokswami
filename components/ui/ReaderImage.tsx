'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';

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
  const primarySrc = typeof src === 'string' && src.trim() ? src.trim() : fallbackSrc;
  const [resolvedSrc, setResolvedSrc] = useState(primarySrc);

  useEffect(() => {
    setResolvedSrc(primarySrc);
  }, [primarySrc]);

  return (
    <Image
      {...props}
      src={resolvedSrc}
      alt={alt}
      onError={(event) => {
        if (resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
}
