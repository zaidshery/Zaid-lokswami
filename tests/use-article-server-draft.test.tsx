import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useArticleServerDraft from '@/components/forms/useArticleServerDraft';

vi.mock('@/lib/auth/clientToken', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer test' }),
}));

describe('useArticleServerDraft', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('patches an adopted draft with its expected version', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { _id: 'article-1', version: 3, updatedAt: '2026-07-13T10:00:00.000Z' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useArticleServerDraft({
        enabled: true,
        hasMeaningfulContent: true,
        payload: { title: 'Versioned edit' },
        createIfMissing: false,
        onSaved,
      })
    );

    act(() => {
      result.current.adoptDraft({
        id: 'article-1',
        version: 2,
        updatedAt: '2026-07-13T09:00:00.000Z',
      });
    });
    await act(async () => {
      await result.current.saveNow();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/articles/article-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Versioned edit',
          autosave: true,
          expectedVersion: 2,
        }),
      })
    );
    expect(result.current.draftVersion).toBe(3);
    expect(result.current.status).toBe('saved');
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'article-1',
        version: 3,
        payloadSignature: JSON.stringify({ title: 'Versioned edit' }),
      })
    );
  });

  it('blocks later saves after a server version conflict', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          code: 'ARTICLE_VERSION_CONFLICT',
          currentVersion: 8,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const { result } = renderHook(() =>
      useArticleServerDraft({
        enabled: true,
        hasMeaningfulContent: true,
        payload: { title: 'Conflicting edit' },
        createIfMissing: false,
      })
    );
    act(() => {
      result.current.adoptDraft({
        id: 'article-1',
        version: 7,
        updatedAt: '2026-07-13T09:00:00.000Z',
      });
    });

    await act(async () => {
      await result.current.saveNow();
      await result.current.saveNow();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('conflict');
    expect(result.current.message).toContain('Server version 8 is newer');
  });

  it('does not create a replacement draft when an edited article was deleted', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const { result } = renderHook(() =>
      useArticleServerDraft({
        enabled: true,
        hasMeaningfulContent: true,
        payload: { title: 'Deleted article edit' },
        createIfMissing: false,
      })
    );
    act(() => {
      result.current.adoptDraft({
        id: 'article-removed',
        version: 1,
        updatedAt: '2026-07-13T09:00:00.000Z',
      });
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/articles/article-removed');
    expect(result.current.status).toBe('error');
    expect(result.current.message).toContain('no longer exists');
  });

  it('pauses new saves and drains the in-flight save before a server mutation', async () => {
    let resolveSave: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSave = resolve;
        })
    );
    const { result } = renderHook(() =>
      useArticleServerDraft({
        enabled: true,
        hasMeaningfulContent: true,
        payload: { title: 'Pending edit' },
        createIfMissing: false,
      })
    );
    act(() => {
      result.current.adoptDraft({
        id: 'article-1',
        version: 2,
        updatedAt: '2026-07-13T09:00:00.000Z',
      });
    });

    let savePromise: ReturnType<typeof result.current.saveNow> | undefined;
    act(() => {
      savePromise = result.current.saveNow();
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    let drainPromise: ReturnType<typeof result.current.pauseAndWait> | undefined;
    act(() => {
      drainPromise = result.current.pauseAndWait();
    });
    const blockedSave = result.current.saveNow();
    resolveSave?.(
      new Response(
        JSON.stringify({
          success: true,
          data: { _id: 'article-1', version: 3, updatedAt: '2026-07-13T10:00:00.000Z' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await act(async () => {
      await Promise.all([savePromise, drainPromise, blockedSave]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.draftVersion).toBe(3);

    await act(async () => {
      await result.current.saveNow();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { _id: 'article-1', version: 4, updatedAt: '2026-07-13T11:00:00.000Z' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    act(() => result.current.resume());
    await act(async () => {
      await result.current.saveNow();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          title: 'Pending edit',
          autosave: true,
          expectedVersion: 3,
        }),
      })
    );
  });
});
