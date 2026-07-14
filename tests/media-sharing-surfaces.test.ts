import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('reader media sharing surfaces', () => {
  it('uses the reusable multi-channel share menu across cards, editions, and videos', () => {
    const articleCards = read('components/ui/ArticleMetaRow.tsx');
    const homeEpaper = read('components/ui/DesktopHeroEpaperCard.tsx');
    const videos = read('app/(reader)/main/videos/VideosPageClient.tsx');
    const shorts = read('components/ui/VideoShortsFeed.tsx');

    expect(articleCards).toContain('contentType="article"');
    expect(homeEpaper).toContain('contentType="epaper"');
    expect(videos).toContain('contentType="video"');
    expect(shorts).toContain('placement="video_shorts_actions"');
    expect(videos).not.toContain('shareActiveVideo');
    expect(shorts).not.toContain('handleShare');
    expect(homeEpaper).not.toContain('shareOnWhatsApp');
  });
});
