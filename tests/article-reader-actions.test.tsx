import { act, createElement, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchPublicArticleDetail: vi.fn(),
  mapPublicArticleToUiArticle: vi.fn(),
  fetchMergedLiveArticles: vi.fn(),
  requestArticleTtsAudio: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'reader-story' }),
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) =>
    createElement('img', { alt, src }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement('a', { href, ...props }, children),
}));

vi.mock('@/lib/store/appStore', () => ({
  useAppStore: (
    selector: (state: { language: 'en'; currentUser: null }) => unknown
  ) => selector({ language: 'en', currentUser: null }),
}));

vi.mock('@/lib/content/publicArticles', () => ({
  fetchPublicArticleDetail: mocks.fetchPublicArticleDetail,
  mapPublicArticleToUiArticle: mocks.mapPublicArticleToUiArticle,
}));

vi.mock('@/lib/content/liveArticles', () => ({
  fetchMergedLiveArticles: mocks.fetchMergedLiveArticles,
}));

vi.mock('@/lib/ai/ttsClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/ttsClient')>(
    '@/lib/ai/ttsClient'
  );
  return {
    ...actual,
    requestArticleTtsAudio: mocks.requestArticleTtsAudio,
  };
});

vi.mock('@/components/ui/NewsCard', () => ({
  default: () => createElement('article', null, 'Related story'),
}));

vi.mock('@/components/ui/ShareMenu', () => ({
  default: ({ ariaLabel }: { ariaLabel: string }) =>
    createElement('button', { type: 'button', 'aria-label': ariaLabel }, 'Share'),
}));

describe('article reader actions', () => {
  const article = {
    id: 'reader-story',
    slug: 'reader-story',
    title: 'Reader story headline',
    summary: 'A concise reader story summary.',
    content: '<p>Complete article content.</p>',
    image: '/story.jpg',
    category: 'Regional',
    author: { id: 'desk', name: 'News Desk', avatar: '/avatar.jpg' },
    publishedAt: '2026-07-13T08:00:00.000Z',
    views: 12,
  };

  class MockAudio {
    src: string;
    preload = '';
    currentTime = 0;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    load = vi.fn();
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();

    constructor(src: string) {
      this.src = new URL(src, window.location.href).href;
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPublicArticleDetail.mockResolvedValue({ id: article.id });
    mocks.mapPublicArticleToUiArticle.mockReturnValue(article);
    mocks.fetchMergedLiveArticles.mockResolvedValue([]);
    mocks.requestArticleTtsAudio.mockResolvedValue({
      provider: 'manual',
      model: 'manual-upload',
      voice: '',
      mimeType: 'audio/mpeg',
      audioUrl: '/reader-story.mp3',
      chunkCount: 1,
    });
    vi.stubGlobal('Audio', MockAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not request article audio until the reader chooses Listen', async () => {
    const ArticleDetailPage = (
      await import('@/app/(reader)/main/article/[id]/page')
    ).default;
    const user = userEvent.setup();

    render(createElement(ArticleDetailPage));

    expect(
      await screen.findByRole('heading', { name: 'Reader story headline' })
    ).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.requestArticleTtsAudio).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Listen' }));

    await waitFor(() => {
      expect(mocks.requestArticleTtsAudio).toHaveBeenCalledTimes(1);
      expect(mocks.requestArticleTtsAudio).toHaveBeenCalledWith('reader-story');
    });
  });
});
