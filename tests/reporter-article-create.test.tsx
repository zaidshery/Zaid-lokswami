import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReporterArticleCreate from '@/app/(admin)/admin/articles/new/ReporterArticleCreate';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

vi.mock('@/lib/auth/clientToken', () => ({ getAuthHeader: () => ({}) }));

describe('ReporterArticleCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads multiple images and submits only the compact reporter handoff fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { url: 'https://cdn.example.com/one.jpg' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { url: 'https://cdn.example.com/two.jpg' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { _id: 'article-1' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<ReporterArticleCreate reporterName="Reporter One" />);
    fireEvent.change(screen.getByPlaceholderText('What happened?'), {
      target: { value: 'Short field report' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write the full report here...'), {
      target: { value: 'First paragraph.\n\nSecond paragraph.' },
    });

    const input = container.querySelector<HTMLInputElement>('#reporter-article-images');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: {
        files: [
          new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
          new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
        ],
      },
    });

    await waitFor(() => expect(screen.getByAltText('one.jpg')).toBeInTheDocument());
    expect(screen.getByAltText('two.jpg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send to Copy Editor' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const request = fetchMock.mock.calls[2];
    expect(request[0]).toBe('/api/admin/articles');
    const payload = JSON.parse(String(request[1]?.body));
    expect(payload).toMatchObject({
      intent: 'submit',
      title: 'Short field report',
      author: 'Reporter One',
      image: 'https://cdn.example.com/one.jpg',
    });
    expect(payload.content).toContain('https://cdn.example.com/one.jpg');
    expect(payload.content).toContain('https://cdn.example.com/two.jpg');
    expect(screen.getByText('Article sent to the copy editor.')).toBeInTheDocument();
  });
});
