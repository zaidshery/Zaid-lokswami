import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ArticleFeaturedImageReaderPreview from '@/components/forms/ArticleFeaturedImageReaderPreview';

describe('ArticleFeaturedImageReaderPreview', () => {
  it('uses one focal-aware surface for desktop, mobile, Google News, and social previews', () => {
    render(
      <ArticleFeaturedImageReaderPreview
        image="/uploads/council.webp"
        title="Council approves route"
        summary="The approved summary."
        alt="Councillors voting in the chamber"
        focalPointX={25}
        focalPointY={70}
      />
    );

    const image = screen.getByRole('img', { name: 'Councillors voting in the chamber' });
    expect(image).toHaveStyle({ objectPosition: '25% 70%' });
    expect(screen.getAllByRole('img')).toHaveLength(1);

    for (const mode of ['Desktop', 'Mobile', 'Google News', 'Social']) {
      fireEvent.click(screen.getByRole('tab', { name: mode }));
      expect(screen.getByRole('tab', { name: mode })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: `${mode} preview` })).toBeInTheDocument();
    }
  });
});
