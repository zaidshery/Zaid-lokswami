import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const getStoredStoryByIdMock = vi.fn();
const getStoredArticleByIdMock = vi.fn();
const upsertStoredSocialPostByStoryAndPlatformMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('@/lib/storage/storiesFile', () => ({
  getStoredStoryById: getStoredStoryByIdMock,
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  getStoredArticleById: getStoredArticleByIdMock,
}));

vi.mock('@/lib/storage/socialPostsFile', () => ({
  upsertStoredSocialPostByStoryAndPlatform: upsertStoredSocialPostByStoryAndPlatformMock,
}));

function createJsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/social-posts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('/api/admin/social-posts/generate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
  });

  it('rejects non-admin callers', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'copy-1',
      email: 'copy@example.com',
      name: 'Copy Editor',
      role: 'copy_editor',
    });

    const { POST } = await import('@/app/api/admin/social-posts/generate/route');
    const response = await POST(createJsonRequest({ storyId: 'story-1' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      error: 'Forbidden',
    });
  });

  it('blocks draft generation until the final edited export is present', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredStoryByIdMock.mockResolvedValue({
      _id: 'story-1',
      title: 'Story title',
      category: 'General',
      author: 'Reporter',
      thumbnail: 'https://cdn.example.com/thumb.jpg',
      linkedArticleId: 'article-1',
      videoProduction: {
        status: 'editing',
        masterExportUrl: '',
      },
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      title: 'Article title',
      summary: 'Article summary',
      sourceStoryId: 'story-1',
    });

    const { POST } = await import('@/app/api/admin/social-posts/generate/route');
    const response = await POST(createJsonRequest({ storyId: 'story-1' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: 'Upload the final edited video export before generating social drafts.',
    });
    expect(upsertStoredSocialPostByStoryAndPlatformMock).not.toHaveBeenCalled();
  });

  it('creates one social draft per supported platform from approved content', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredStoryByIdMock.mockResolvedValue({
      _id: 'story-1',
      title: 'Story title',
      category: 'Politics',
      author: 'Reporter',
      thumbnail: 'https://cdn.example.com/thumb.jpg',
      linkedArticleId: 'article-1',
      videoProduction: {
        status: 'ready_to_publish',
        masterExportUrl: 'https://cdn.example.com/final.mp4',
        thumbnailUrl: 'https://cdn.example.com/final-thumb.jpg',
      },
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      title: 'Article title',
      summary: 'Article summary',
      sourceStoryId: 'story-1',
    });
    upsertStoredSocialPostByStoryAndPlatformMock.mockImplementation(
      async (_storyId: string, _platform: string, seed: Record<string, unknown>) => ({
        _id: `social-${String(seed.platform)}`,
        ...seed,
      })
    );

    const { POST } = await import('@/app/api/admin/social-posts/generate/route');
    const response = await POST(createJsonRequest({ storyId: 'story-1' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(upsertStoredSocialPostByStoryAndPlatformMock).toHaveBeenCalledTimes(3);
    expect(payload).toEqual({
      success: true,
      data: [
        expect.objectContaining({ platform: 'youtube', sourceStoryId: 'story-1' }),
        expect.objectContaining({ platform: 'facebook', sourceStoryId: 'story-1' }),
        expect.objectContaining({ platform: 'instagram', sourceStoryId: 'story-1' }),
      ],
    });
  });
});
