import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const getStoredArticleByIdMock = vi.fn();
const listAllStoredArticlesMock = vi.fn();
const updateStoredArticleMock = vi.fn();
const deleteStoredArticleMock = vi.fn();
const connectDBMock = vi.fn();
const recordArticleActivityMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    exists: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('@/lib/models/EPaper', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('@/lib/models/EPaperArticle', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('@/lib/models/User', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  deleteStoredArticle: deleteStoredArticleMock,
  getStoredArticleById: getStoredArticleByIdMock,
  listAllStoredArticles: listAllStoredArticlesMock,
  updateStoredArticle: updateStoredArticleMock,
}));

vi.mock('@/lib/server/breakingTts', () => ({
  deleteStoredBreakingAudio: vi.fn(),
  ensureBreakingTtsForArticle: vi.fn(),
}));

vi.mock('@/lib/server/articleActivity', () => ({
  buildArticleActivityMessage: vi.fn(() => 'Article activity recorded.'),
  recordArticleActivity: recordArticleActivityMock,
}));

vi.mock('@/lib/server/newsroomStoryLinks', () => ({
  clearStoryLinkedArticle: vi.fn(),
  syncStoryLinkedArticle: vi.fn(),
}));

function createJsonRequest(method: 'GET' | 'PATCH' | 'PUT', body?: Record<string, unknown>) {
  const request = new Request('http://localhost/api/admin/articles/article-1', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest & { nextUrl: URL };

  Object.defineProperty(request, 'nextUrl', {
    value: new URL(request.url),
  });

  return request;
}

describe('/api/admin/articles/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
    listAllStoredArticlesMock.mockResolvedValue([]);
  });

  it('prevents reporters from opening article detail through the API', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'reporter-1',
      email: 'reporter@example.com',
      name: 'Reporter',
      role: 'reporter',
    });

    const { GET } = await import('@/app/api/admin/articles/[id]/route');
    const response = await GET(createJsonRequest('GET'), {
      params: Promise.resolve({ id: 'article-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      error: 'Forbidden',
    });
    expect(getStoredArticleByIdMock).not.toHaveBeenCalled();
  });

  it('prevents reporters from patching articles through the API', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'reporter-1',
      email: 'reporter@example.com',
      name: 'Reporter',
      role: 'reporter',
    });

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', { title: 'Updated title' }),
      {
        params: Promise.resolve({ id: 'article-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      error: 'Forbidden',
    });
    expect(getStoredArticleByIdMock).not.toHaveBeenCalled();
    expect(updateStoredArticleMock).not.toHaveBeenCalled();
  });

  it('prevents reporters from replacing articles through the API', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'reporter-1',
      email: 'reporter@example.com',
      name: 'Reporter',
      role: 'reporter',
    });

    const { PUT } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PUT(
      createJsonRequest('PUT', {
        title: 'Updated title',
        summary: 'Updated summary',
        content: 'Updated content',
        image: 'https://cdn.example.com/updated.jpg',
        category: 'General',
        author: 'Desk',
      }),
      {
        params: Promise.resolve({ id: 'article-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      error: 'Forbidden',
    });
    expect(getStoredArticleByIdMock).not.toHaveBeenCalled();
    expect(updateStoredArticleMock).not.toHaveBeenCalled();
    expect(deleteStoredArticleMock).not.toHaveBeenCalled();
  });

  it('publishes an approved article through the workflow action route', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      title: 'Ready article',
      summary: 'Ready summary',
      content: 'Ready content',
      image: 'https://cdn.example.com/image.jpg',
      category: 'General',
      author: 'Desk',
      workflow: {
        status: 'approved',
        priority: 'normal',
        createdBy: {
          id: 'admin-1',
          name: 'Desk',
          email: 'desk@example.com',
          role: 'admin',
        },
      },
    });
    updateStoredArticleMock.mockResolvedValue({
      _id: 'article-1',
      title: 'Ready article',
      workflow: { status: 'published' },
      publishedAt: '2026-05-12T10:00:00.000Z',
    });

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(createJsonRequest('PATCH', { action: 'publish' }), {
      params: Promise.resolve({ id: 'article-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: expect.objectContaining({
        _id: 'article-1',
        workflow: { status: 'published' },
      }),
      message: 'Article moved to published.',
    });
    expect(updateStoredArticleMock).toHaveBeenCalledWith(
      'article-1',
      expect.objectContaining({
        workflow: expect.objectContaining({
          status: 'published',
        }),
        publishedAt: expect.any(String),
      }),
      { skipRevision: true }
    );
    expect(recordArticleActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: 'article-1',
        action: 'publish',
        fromStatus: 'approved',
        toStatus: 'published',
      })
    );
  });

  it('records the old slug when replacing an article slug', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      title: 'Old title',
      summary: 'Old summary',
      content: 'Old content',
      image: 'https://cdn.example.com/old.jpg',
      category: 'General',
      author: 'Desk',
      slug: 'old-title',
      previousSlugs: [],
      workflow: { status: 'published' },
    });
    listAllStoredArticlesMock.mockResolvedValue([
      {
        _id: 'article-1',
        slug: 'old-title',
        previousSlugs: [],
      },
    ]);
    updateStoredArticleMock.mockResolvedValue({
      _id: 'article-1',
      slug: 'new-title',
      previousSlugs: ['old-title'],
      isBreaking: false,
      workflow: { status: 'published' },
    });

    const { PUT } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PUT(
      createJsonRequest('PUT', {
        title: 'New title',
        slug: 'new-title',
        summary: 'Updated summary',
        content: 'Updated content',
        image: 'https://cdn.example.com/updated.jpg',
        category: 'General',
        author: 'Desk',
      }),
      {
        params: Promise.resolve({ id: 'article-1' }),
      }
    );

    expect(response.status).toBe(200);
    expect(updateStoredArticleMock).toHaveBeenCalledWith(
      'article-1',
      expect.objectContaining({
        slug: 'new-title',
        previousSlugs: ['old-title'],
      })
    );
  });
});
