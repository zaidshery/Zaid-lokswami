import { createElement, type ChangeEvent, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  uploadArticleTtsAudioDirect: vi.fn(),
  uploadBreakingTtsAudioDirect: vi.fn(),
  prepareArticleImageFile: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => createElement('a', { href, ...props }, children),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        name: 'Parvez Khan',
        email: 'parvez@example.com',
        role: 'admin',
      },
    },
  }),
}));

vi.mock('framer-motion', () => {
  const MotionDiv = ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => {
    const forwardedProps = { ...props };
    delete forwardedProps.initial;
    delete forwardedProps.animate;
    delete forwardedProps.transition;
    return createElement('div', forwardedProps, children);
  };

  return {
    motion: {
      div: MotionDiv,
    },
  };
});

vi.mock('@/components/admin/CmsEditorLayout', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => createElement('div', null, children);
  return {
    CmsEditorCanvas: Wrapper,
    CmsEditorColumns: Wrapper,
    CmsEditorMain: Wrapper,
    CmsEditorSidebar: Wrapper,
  };
});

vi.mock('@/components/forms/ArticleEditorStudio', () => ({
  default: ({
    content,
    onContentChange,
  }: {
    content: string;
    onContentChange: (value: string) => void;
  }) =>
    createElement('textarea', {
      'aria-label': 'Article editor content',
      value: content,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
        onContentChange(event.currentTarget.value),
    }),
  ArticleEditorSidebar: () => createElement('div', { 'data-testid': 'article-editor-sidebar' }),
}));

vi.mock('@/lib/auth/clientToken', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer test-token' }),
}));

vi.mock('@/lib/utils/articleImageUpload', () => ({
  ARTICLE_IMAGE_UPLOAD_GUIDE: 'Upload a clear image.',
  getArticleImageHints: () => [],
  prepareArticleImageFile: mocks.prepareArticleImageFile,
}));

vi.mock('@/lib/utils/articleMedia', () => ({
  resolveArticleOgImageUrl: ({ image }: { image: string }) => image,
}));

vi.mock('@/lib/utils/articleTtsUploadClient', () => ({
  uploadArticleTtsAudioDirect: mocks.uploadArticleTtsAudioDirect,
}));

vi.mock('@/lib/utils/breakingTtsUploadClient', () => ({
  uploadBreakingTtsAudioDirect: mocks.uploadBreakingTtsAudioDirect,
}));

function jsonResponse(payload: unknown, ok = true, status = ok ? 200 : 500) {
  return Promise.resolve({
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response);
}

function createFetchMock() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    void init;

    if (url === '/api/admin/categories') {
      return jsonResponse({
        success: true,
        data: [{ name: 'National' }, { name: 'City' }],
      });
    }

    if (url === '/api/articles/latest?limit=50') {
      return jsonResponse({ items: [] });
    }

    if (url === '/api/admin/upload') {
      return jsonResponse({
        success: true,
        data: { url: '/uploads/article-featured.jpg' },
      });
    }

    if (url === '/api/admin/articles') {
      return jsonResponse({
        success: true,
        data: { _id: '665000000000000000000001' },
      }, true, 201);
    }

    if (url === '/api/admin/articles/665000000000000000000001') {
      return jsonResponse({
        success: true,
        message: 'Article moved to published.',
      });
    }

    return jsonResponse({ success: false, error: 'Unexpected request' }, false, 404);
  });
}

async function renderCreatePage() {
  const ArticleCreatePageClient = (
    await import('@/app/(admin)/admin/articles/new/ArticleCreatePageClient')
  ).default;

  return render(createElement(ArticleCreatePageClient));
}

function getAudioInput(container: HTMLElement) {
  const input = container.querySelector(
    'input[accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"]'
  );
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Audio input not found');
  }
  return input;
}

function getAudioInputs(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll(
      'input[accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"]'
    )
  ).filter((input): input is HTMLInputElement => input instanceof HTMLInputElement);
}

function getBreakingAudioInput(container: HTMLElement) {
  const input = getAudioInputs(container)[1];
  if (!input) {
    throw new Error('Breaking audio input not found');
  }
  return input;
}

function getImageInput(container: HTMLElement) {
  const input = container.querySelector('input[accept="image/*"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Image input not found');
  }
  return input;
}

async function fillRequiredArticleFields(container: HTMLElement) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Enter an engaging title'), 'Manual Audio Story');
  await user.type(
    screen.getByPlaceholderText(/brief summary of the article/i),
    'Short article summary'
  );
  await user.type(screen.getByLabelText('Article editor content'), 'Full article body text.');

  const image = new File(['image-bytes'], 'featured.jpg', { type: 'image/jpeg' });
  fireEvent.change(getImageInput(container), { target: { files: [image] } });

  await waitFor(() => {
    expect(screen.getByAltText('Preview')).toBeInTheDocument();
  });
}

function uploadAudio(container: HTMLElement, file: File) {
  fireEvent.change(getAudioInput(container), { target: { files: [file] } });
}

function uploadBreakingAudio(container: HTMLElement, file: File) {
  fireEvent.change(getBreakingAudioInput(container), { target: { files: [file] } });
}

function hasArticleCreateFetchCall(fetchMock: ReturnType<typeof createFetchMock>) {
  return fetchMock.mock.calls.some(([input]) => String(input) === '/api/admin/articles');
}

describe('Article create manual listen audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.prepareArticleImageFile.mockImplementation(async (file: File) => ({
      file,
      previewDataUrl: 'data:image/jpeg;base64,preview',
      wasResized: false,
      width: 1200,
      height: 675,
    }));
    mocks.uploadArticleTtsAudioDirect.mockResolvedValue({
      asset: {
        mediaUrl: 'https://cdn.example.com/lokswami/tts/article/665/manual/listen.mp3',
        mediaKey: 'lokswami/tts/article/665/manual/listen.mp3',
        mediaSizeBytes: 1024,
        mediaMimeType: 'audio/mpeg',
        storageProvider: 'do-spaces',
      },
    });
    mocks.uploadBreakingTtsAudioDirect.mockResolvedValue({
      asset: {
        mediaUrl: 'https://cdn.example.com/lokswami/tts/article/665/breaking/headline.mp3',
        mediaKey: 'lokswami/tts/article/665/breaking/headline.mp3',
        mediaSizeBytes: 1024,
        mediaMimeType: 'audio/mpeg',
        storageProvider: 'do-spaces',
      },
      breakingTts: {
        audioUrl: 'https://cdn.example.com/lokswami/tts/article/665/breaking/headline.mp3',
        textHash: 'hash',
        languageCode: 'hi-IN',
        voice: 'manual',
        model: 'manual',
        mimeType: 'audio/mpeg',
        generatedAt: '2026-05-23T08:00:00.000Z',
      },
      script: 'Manual Audio Story',
    });
    vi.stubGlobal('fetch', createFetchMock());
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:article-listen-audio'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('shows staged status for a valid article listen audio file', async () => {
    const { container } = await renderCreatePage();

    uploadAudio(
      container,
      new File(['audio-bytes'], 'listen.mp3', { type: 'audio/mpeg' })
    );

    expect(screen.getByText('listen.mp3')).toBeInTheDocument();
    expect(screen.getByText(/ready to attach after article creation/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Remove article listen audio')).toBeInTheDocument();
  });

  it('blocks submit while the staged audio file is invalid', async () => {
    const { container } = await renderCreatePage();
    await fillRequiredArticleFields(container);

    uploadAudio(
      container,
      new File(['not-audio'], 'listen.txt', { type: 'text/plain' })
    );

    await userEvent.click(screen.getByRole('button', { name: /publish article/i }));

    expect(screen.getAllByText('Article audio must be MP3, WAV, or M4A.').length).toBeGreaterThan(0);
    expect(hasArticleCreateFetchCall(fetch as ReturnType<typeof createFetchMock>)).toBe(false);
    expect(mocks.uploadArticleTtsAudioDirect).not.toHaveBeenCalled();
  });

  it('shows the recording script and upload control when marked as breaking news', async () => {
    const { container } = await renderCreatePage();

    await userEvent.click(screen.getByLabelText(/mark as breaking news/i));

    expect(screen.getByText('Breaking News Audio')).toBeInTheDocument();
    expect(screen.getByText('Recording Script')).toBeInTheDocument();
    expect(screen.getByText('Untitled breaking headline')).toBeInTheDocument();
    expect(getBreakingAudioInput(container)).toBeInstanceOf(HTMLInputElement);
  });

  it('blocks publishing a breaking article until breaking audio is staged', async () => {
    const { container } = await renderCreatePage();
    await fillRequiredArticleFields(container);
    await userEvent.click(screen.getByLabelText(/mark as breaking news/i));

    await userEvent.click(screen.getByRole('button', { name: /publish article/i }));

    expect(screen.getAllByText(/Upload breaking news audio before publishing/i).length).toBeGreaterThan(0);
    expect(hasArticleCreateFetchCall(fetch as ReturnType<typeof createFetchMock>)).toBe(false);
    expect(mocks.uploadBreakingTtsAudioDirect).not.toHaveBeenCalled();
  });

  it('creates a breaking article first, uploads breaking audio, then publishes it', async () => {
    const fetchMock = fetch as ReturnType<typeof createFetchMock>;
    const { container } = await renderCreatePage();
    await fillRequiredArticleFields(container);
    await userEvent.click(screen.getByLabelText(/mark as breaking news/i));
    const breakingAudio = new File(['breaking-audio'], 'breaking.mp3', { type: 'audio/mpeg' });
    uploadBreakingAudio(container, breakingAudio);

    await userEvent.click(screen.getByRole('button', { name: /publish article/i }));

    await waitFor(() => {
      expect(mocks.uploadBreakingTtsAudioDirect).toHaveBeenCalledWith({
        articleId: '665000000000000000000001',
        file: breakingAudio,
        authHeaders: { Authorization: 'Bearer test-token' },
      });
    });
    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['/api/admin/articles/665000000000000000000001']),
      ])
    );
    const createBody = JSON.parse(
      String(
        (fetchMock.mock.calls.find(([input]) => String(input) === '/api/admin/articles')?.[1])
          ?.body || '{}'
      )
    );
    expect(createBody.breakingAudioUploadPending).toBe(true);
  });

  it('routes to edit retry when required breaking audio upload fails', async () => {
    mocks.uploadBreakingTtsAudioDirect.mockRejectedValueOnce(new Error('Spaces CORS missing'));
    const { container } = await renderCreatePage();
    await fillRequiredArticleFields(container);
    await userEvent.click(screen.getByLabelText(/mark as breaking news/i));
    uploadBreakingAudio(
      container,
      new File(['breaking-audio'], 'breaking.wav', { type: 'audio/wav' })
    );

    await userEvent.click(screen.getByRole('button', { name: /publish article/i }));

    await waitFor(() => {
      expect(screen.getByText(/Article was created, but breaking audio upload failed: Spaces CORS missing/i)).toBeInTheDocument();
    });
    await waitFor(
      () => {
        expect(mocks.push).toHaveBeenCalledWith('/admin/articles/665000000000000000000001/edit');
      },
      { timeout: 3500 }
    );
  });

  it('creates the article first, then uploads staged audio against the returned article id', async () => {
    const { container } = await renderCreatePage();
    await fillRequiredArticleFields(container);
    const audio = new File(['audio-bytes'], 'listen.m4a', { type: 'audio/mp4' });
    uploadAudio(container, audio);

    await userEvent.click(screen.getByRole('button', { name: /publish article/i }));

    await waitFor(() => {
      expect(mocks.uploadArticleTtsAudioDirect).toHaveBeenCalledWith({
        articleId: '665000000000000000000001',
        file: audio,
        authHeaders: { Authorization: 'Bearer test-token' },
      });
    });
    expect(hasArticleCreateFetchCall(fetch as ReturnType<typeof createFetchMock>)).toBe(true);
  });

  it('keeps the article created when optional audio upload fails', async () => {
    mocks.uploadArticleTtsAudioDirect.mockRejectedValueOnce(new Error('Spaces CORS missing'));
    const { container } = await renderCreatePage();
    await fillRequiredArticleFields(container);
    uploadAudio(
      container,
      new File(['audio-bytes'], 'listen.wav', { type: 'audio/wav' })
    );

    await userEvent.click(screen.getByRole('button', { name: /publish article/i }));

    await waitFor(() => {
      expect(screen.getByText(/Article was created, but listen audio upload failed: Spaces CORS missing/i)).toBeInTheDocument();
    });
    expect(hasArticleCreateFetchCall(fetch as ReturnType<typeof createFetchMock>)).toBe(true);
  });
});
