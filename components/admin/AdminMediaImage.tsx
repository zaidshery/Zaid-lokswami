import type { ImgHTMLAttributes } from 'react';

type AdminMediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt'> & {
  alt: string;
};

export function AdminMediaImage({ alt, ...props }: AdminMediaImageProps) {
  // CMS media can come from data/blob previews, local storage, or external upload URLs.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} {...props} />;
}
