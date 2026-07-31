import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Article } from '@/lib/mock/data';

vi.mock('@/lib/store/appStore', () => ({
  useAppStore: (selector: (state: { language: 'hi' }) => unknown) =>
    selector({ language: 'hi' }),
}));

vi.mock('@/components/ui/ReaderImage', () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} />
  ),
}));

vi.mock('@/components/ui/ArticleMetaRow', () => ({
  default: () => <div data-testid="article-actions" />,
}));

const article: Article = {
  id: 'hero-article',
  slug: 'hero-article',
  title: 'हिंदी शीर्षक की सभी मात्राएं साफ और पूरी दिखाई दें',
  summary: 'सारांश',
  image: '/hero.jpg',
  category: 'राष्ट्रीय',
  author: {
    id: 'author-1',
    name: 'लोकस्वामी डेस्क',
    avatar: '/avatar.jpg',
  },
  publishedAt: '2026-07-31T06:00:00.000Z',
  views: 10,
};

describe('HeroCard responsive media', () => {
  it('keeps edge-to-edge artwork visible and uses the safe Hindi headline rhythm', async () => {
    const HeroCard = (await import('@/components/ui/HeroCard')).default;

    render(<HeroCard article={article} variant="modern" />);

    const heroImage = screen.getByRole('img', { name: article.title });
    const mediaFrame = heroImage.parentElement?.parentElement;

    expect(heroImage).toHaveClass('object-contain');
    expect(heroImage).not.toHaveClass(
      'sm:object-cover'
    );
    expect(mediaFrame).toHaveClass('aspect-[16/9]', 'flex-none');
    expect(mediaFrame).not.toHaveClass('sm:aspect-auto', 'sm:flex-1');
    expect(screen.getByRole('heading', { name: article.title })).toHaveClass(
      'newsroom-hero-title-match',
      'break-words'
    );
    expect(screen.getByRole('heading', { name: article.title })).not.toHaveClass(
      'leading-[1.2]',
      'line-clamp-2'
    );
  });
});
