import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const getStoredArticleByIdMock = vi.fn();
const updateStoredArticleMock = vi.fn();
const deleteStoredArticleMock = vi.fn();
const connectDBMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
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
  updateStoredArticle: updateStoredArticleMock,
}));

vi.mock('@/lib/server/breakingTts', () => ({
  deleteStoredBreakingAudio: vi.fn(),
  ensureBreakingTtsForArticle: vi.fn(),
}));

vi.mock('@/lib/server/articleActivity', () => ({
  buildArticleActivityMessage: vi.fn(() => 'Article activity recorded.'),
  recordArticleActivity: vi.fn(),
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
});
