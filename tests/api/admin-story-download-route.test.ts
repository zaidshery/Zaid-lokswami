import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const getStoredStoryByIdMock = vi.fn();
const createStoryVideoDownloadRequestMock = vi.fn();
const connectDBMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('@/lib/storage/storiesFile', () => ({
  getStoredStoryById: getStoredStoryByIdMock,
}));

vi.mock('@/lib/storage/storyVideoUpload', () => ({
  STORY_VIDEO_STORAGE_PROVIDER: 'do-spaces',
  createStoryVideoDownloadRequest: createStoryVideoDownloadRequestMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Story', () => ({
  default: {
    findById: vi.fn(),
  },
}));

function createGetRequest(asset: 'thumbnail' | 'media' = 'media') {
  return new Request(
    `http://localhost/api/admin/stories/story-1/download?asset=${asset}`,
    { method: 'GET' }
  ) as unknown as NextRequest;
}

describe('story asset download route', () => {
  const originalMongoUri = process.env.MONGODB_URI;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MONGODB_URI = '';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env.MONGODB_URI = originalMongoUri;
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated downloads', async () => {
    getAdminSessionMock.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/stories/[id]/download/route');
    const response = await GET(createGetRequest(), {
      params: Promise.resolve({ id: 'story-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets assigned copy editors download story media through the signed video request', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'copy-editor-1',
      email: 'copy@example.com',
      name: 'Copy Editor',
      role: 'copy_editor',
    });
    getStoredStoryByIdMock.mockResolvedValue({
      _id: 'story-1',
      title: 'Budget Meeting',
      author: 'Reporter One',
      thumbnail: 'https://cdn.example.com/thumb.jpg',
      mediaType: 'video',
      mediaUrl: 'https://cdn.example.com/story.mp4',
      mediaKey: 'stories/videos/2026/04/18/story-1.mp4',
      mediaMimeType: 'video/mp4',
      storageProvider: 'do-spaces',
      isPublished: false,
      publishedAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '2026-04-18T10:30:00.000Z',
      workflow: {
        status: 'copy_edit',
        createdBy: {
          id: 'reporter-1',
          name: 'Reporter One',
          email: 'reporter@example.com',
          role: 'reporter',
        },
        assignedTo: {
          id: 'copy-editor-1',
          name: 'Copy Editor',
          email: 'copy@example.com',
          role: 'copy_editor',
        },
      },
    });
    createStoryVideoDownloadRequestMock.mockReturnValue({
      url: 'https://origin.example.com/stories/videos/2026/04/18/story-1.mp4',
      headers: {
        Authorization: 'signed-request',
      },
    });
    fetchMock.mockResolvedValue(
      new Response('video-bytes', {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
        },
      })
    );

    const { GET } = await import('@/app/api/admin/stories/[id]/download/route');
    const response = await GET(createGetRequest('media'), {
      params: Promise.resolve({ id: 'story-1' }),
    });

    expect(response.status).toBe(200);
    expect(createStoryVideoDownloadRequestMock).toHaveBeenCalledWith(
      'stories/videos/2026/04/18/story-1.mp4'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://origin.example.com/stories/videos/2026/04/18/story-1.mp4',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'signed-request',
        },
      })
    );
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('content-disposition')).toContain(
      'budget-meeting-media.mp4'
    );
    expect(await response.text()).toBe('video-bytes');
  });

  it('blocks copy editors from downloading unassigned story assets', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'copy-editor-1',
      email: 'copy@example.com',
      name: 'Copy Editor',
      role: 'copy_editor',
    });
    getStoredStoryByIdMock.mockResolvedValue({
      _id: 'story-1',
      title: 'Desk Story',
      author: 'Reporter One',
      thumbnail: 'https://cdn.example.com/thumb.jpg',
      workflow: {
        status: 'copy_edit',
        createdBy: {
          id: 'reporter-1',
          name: 'Reporter One',
          email: 'reporter@example.com',
          role: 'reporter',
        },
        assignedTo: {
          id: 'someone-else',
          name: 'Another Editor',
          email: 'other@example.com',
          role: 'copy_editor',
        },
      },
      isPublished: false,
      publishedAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '2026-04-18T10:30:00.000Z',
    });

    const { GET } = await import('@/app/api/admin/stories/[id]/download/route');
    const response = await GET(createGetRequest('thumbnail'), {
      params: Promise.resolve({ id: 'story-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      error: 'Forbidden',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets reporters download thumbnail assets for their own stories', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'reporter-1',
      email: 'reporter@example.com',
      name: 'Reporter One',
      role: 'reporter',
    });
    getStoredStoryByIdMock.mockResolvedValue({
      _id: 'story-1',
      title: 'Reporter Package',
      author: 'Reporter One',
      thumbnail: 'https://cdn.example.com/thumb.webp',
      workflow: {
        status: 'submitted',
        createdBy: {
          id: 'reporter-1',
          name: 'Reporter One',
          email: 'reporter@example.com',
          role: 'reporter',
        },
        assignedTo: {
          id: 'copy-editor-1',
          name: 'Copy Editor',
          email: 'copy@example.com',
          role: 'copy_editor',
        },
      },
      isPublished: false,
      publishedAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '2026-04-18T10:30:00.000Z',
    });
    fetchMock.mockResolvedValue(
      new Response('thumb-bytes', {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
        },
      })
    );

    const { GET } = await import('@/app/api/admin/stories/[id]/download/route');
    const response = await GET(createGetRequest('thumbnail'), {
      params: Promise.resolve({ id: 'story-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain(
      'reporter-package-thumbnail.webp'
    );
    expect(await response.text()).toBe('thumb-bytes');
  });
});
