import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ArticleTranslationReview from '@/components/forms/ArticleTranslationReview';

describe('ArticleTranslationReview', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a before/after draft and applies only after explicit approval', async () => {
    const onApply = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        sourceText: 'Original summary',
        translation: 'अनुवादित सारांश',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ArticleTranslationReview
        title="Original headline"
        summary="Original summary"
        content="<p>Approved body.</p>"
        reporterNotes="Approved note."
        sourcePackage="Approved source."
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate review draft' }));
    const draft = await screen.findByRole('textbox', { name: 'Translation review draft' });
    expect(draft).toHaveValue('अनुवादित सारांश');
    expect(screen.getByText('Original summary')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.change(draft, { target: { value: 'संपादक द्वारा स्वीकृत सारांश' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply translation' }));
    expect(onApply).toHaveBeenCalledWith('summary', 'संपादक द्वारा स्वीकृत सारांश');

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toEqual(expect.objectContaining({
      sourceText: 'Original summary',
      articleBody: '<p>Approved body.</p>',
      reporterNotes: 'Approved note.',
      sourcePackage: 'Approved source.',
    }));
  });

  it('does not offer generation for an empty selected field', () => {
    render(
      <ArticleTranslationReview
        title=""
        summary=""
        content=""
        reporterNotes=""
        sourcePackage=""
        onApply={vi.fn()}
      />
    );
    const section = screen.getByRole('heading', { name: 'Hindi / English translation' }).closest('section');
    expect(within(section as HTMLElement).getByRole('button', { name: 'Generate review draft' })).toBeDisabled();
  });
});
