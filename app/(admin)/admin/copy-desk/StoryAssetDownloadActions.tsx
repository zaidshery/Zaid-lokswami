'use client';

import { Download } from 'lucide-react';

type StoryAssetDownloadActionsProps = {
  storyId: string;
  hasThumbnail: boolean;
  hasVideo: boolean;
  className: string;
};

function storyDownloadHref(storyId: string, asset: 'thumbnail' | 'media') {
  return `/api/admin/stories/${encodeURIComponent(storyId)}/download?asset=${asset}`;
}

function triggerDownload(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function StoryAssetDownloadActions({
  storyId,
  hasThumbnail,
  hasVideo,
  className,
}: StoryAssetDownloadActionsProps) {
  const downloads = [
    hasThumbnail ? storyDownloadHref(storyId, 'thumbnail') : '',
    hasVideo ? storyDownloadHref(storyId, 'media') : '',
  ].filter(Boolean);

  return (
    <>
      {hasThumbnail ? (
        <a href={storyDownloadHref(storyId, 'thumbnail')} className={className}>
          <Download className="h-3.5 w-3.5" />
          Download Thumbnail
        </a>
      ) : null}
      {hasVideo ? (
        <a href={storyDownloadHref(storyId, 'media')} className={className}>
          <Download className="h-3.5 w-3.5" />
          Download Video
        </a>
      ) : null}
      {downloads.length > 1 ? (
        <button
          type="button"
          onClick={() => {
            downloads.forEach((url, index) => {
              window.setTimeout(() => triggerDownload(url), index * 250);
            });
          }}
          className={className}
        >
          <Download className="h-3.5 w-3.5" />
          Download All
        </button>
      ) : null}
    </>
  );
}
