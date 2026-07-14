import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const getStoredArticleByIdMock = vi.fn();
const listAllStoredArticlesMock = vi.fn();
const updateStoredArticleMock = vi.fn();
const deleteStoredArticleMock = vi.fn();
const connectDBMock = vi.fn();
const recordArticleActivityMock = vi.fn();
const resolveReusableBreakingTtsMock = vi.fn();
const articleExistsMock = vi.fn();
const articleFindByIdMock = vi.fn();
const articleFindOneAndUpdateMock = vi.fn();
const articleFindOneAndDeleteMock = vi.fn();
const articleFindByIdAndUpdateMock = vi.fn();
const articleFindByIdAndDeleteMock = vi.fn();
const isArticleVersionConflictErrorMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
  getAdminSessionFromReq: getAdminSessionMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    exists: articleExistsMock,
    findById: articleFindByIdMock,
    findOneAndUpdate: articleFindOneAndUpdateMock,
    findOneAndDelete: articleFindOneAndDeleteMock,
    findByIdAndUpdate: articleFindByIdAndUpdateMock,
    findByIdAndDelete: articleFindByIdAndDeleteMock,
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
  isArticleVersionConflictError: isArticleVersionConflictErrorMock,
  listAllStoredArticles: listAllStoredArticlesMock,
  updateStoredArticle: updateStoredArticleMock,
}));

vi.mock('@/lib/server/breakingTts', () => ({
  deleteStoredBreakingAudio: vi.fn(),
  ensureBreakingTtsForArticle: vi.fn(),
  resolveReusableBreakingTts: resolveReusableBreakingTtsMock,
}));

vi.mock('@/lib/server/articleActivity', () => ({
  buildArticleActivityMessage: vi.fn(() => 'Article activity recorded.'),
  recordArticleActivity: recordArticleActivityMock,
}));

vi.mock('@/lib/server/newsroomStoryLinks', () => ({
  clearStoryLinkedArticle: vi.fn(),
  syncStoryLinkedArticle: vi.fn(),
}));

function createJsonRequest(
  method: 'GET' | 'PATCH' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>
) {
  const url = new URL('http://localhost/api/admin/articles/article-1');
  Object.entries(searchParams || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const request = new Request(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest & { nextUrl: URL };

  Object.defineProperty(request, 'nextUrl', {
    value: new URL(request.url),
  });

  return request;
}

const MONGO_ARTICLE_ID = '507f1f77bcf86cd799439011';

function createMongoArticleDocument(overrides: Record<string, unknown> = {}) {
  const data = {
    _id: MONGO_ARTICLE_ID,
    version: 2,
    title: 'Updated title',
    slug: 'updated-title',
    previousSlugs: [],
    isBreaking: false,
    breakingTts: null,
    workflow: { status: 'draft' },
    ...overrides,
  };

  return {
    ...data,
    save: vi.fn().mockResolvedValue(undefined),
    toObject: vi.fn(() => ({ ...data })),
  };
}

function createReadyWorkflowArticle(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'article-1',
    version: 4,
    title: 'Ready article',
    summary:
      'This ready summary includes the essential facts, location, and context for readers.',
    content:
      'This ready article contains verified newsroom copy with enough context to pass editorial readiness. It explains what happened, where it happened, why it matters, and what readers should expect next.',
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
    ...overrides,
  };
}

describe('/api/admin/articles/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
    listAllStoredArticlesMock.mockResolvedValue([]);
    resolveReusableBreakingTtsMock.mockReturnValue(null);
    isArticleVersionConflictErrorMock.mockReturnValue(false);
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

  it('rejects a stale autosave instead of overwriting a newer draft', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      version: 4,
      title: 'Newer server title',
      slug: 'newer-server-title',
      previousSlugs: [],
      updatedAt: '2026-07-13T08:30:00.000Z',
      workflow: {
        status: 'draft',
        createdBy: {
          id: 'admin-1',
          email: 'desk@example.com',
          name: 'Desk',
          role: 'admin',
        },
      },
    });

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', {
        title: 'Stale browser title',
        autosave: true,
        expectedVersion: 3,
      }),
      { params: Promise.resolve({ id: 'article-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        code: 'ARTICLE_VERSION_CONFLICT',
        currentVersion: 4,
        updatedAt: '2026-07-13T08:30:00.000Z',
      })
    );
    expect(updateStoredArticleMock).not.toHaveBeenCalled();
  });

  it('autosaves a current draft without creating a revision snapshot', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      version: 4,
      title: 'Draft title',
      slug: 'draft-title',
      previousSlugs: [],
      updatedAt: '2026-07-13T08:30:00.000Z',
      workflow: {
        status: 'draft',
        createdBy: {
          id: 'admin-1',
          email: 'desk@example.com',
          name: 'Desk',
          role: 'admin',
        },
      },
    });
    updateStoredArticleMock.mockResolvedValue({
      _id: 'article-1',
      version: 5,
      title: 'Updated draft title',
      workflow: { status: 'draft' },
    });

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', {
        title: 'Updated draft title',
        autosave: true,
        expectedVersion: 4,
      }),
      { params: Promise.resolve({ id: 'article-1' }) }
    );

    expect(response.status).toBe(200);
    expect(updateStoredArticleMock).toHaveBeenCalledWith(
      'article-1',
      expect.objectContaining({ title: 'Updated draft title' }),
      { skipRevision: true, expectedVersion: 4 }
    );
  });

  it('rejects a stale full edit instead of overwriting a newer article', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      version: 5,
      title: 'Newer server title',
      slug: 'newer-server-title',
      previousSlugs: [],
      updatedAt: '2026-07-13T09:30:00.000Z',
      workflow: { status: 'draft' },
    });

    const { PUT } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PUT(
      createJsonRequest('PUT', {
        expectedVersion: 4,
        title: 'Stale browser title',
        summary: 'Stale browser summary',
        content: 'Stale browser content',
        image: 'https://cdn.example.com/stale.jpg',
        category: 'General',
        author: 'Desk',
      }),
      { params: Promise.resolve({ id: 'article-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        code: 'ARTICLE_VERSION_CONFLICT',
        currentVersion: 5,
        updatedAt: '2026-07-13T09:30:00.000Z',
      })
    );
    expect(updateStoredArticleMock).not.toHaveBeenCalled();
  });

  it('uses the current version as a compare-and-swap guard for a full edit', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      version: 5,
      title: 'Current title',
      slug: 'current-title',
      previousSlugs: [],
      updatedAt: '2026-07-13T09:30:00.000Z',
      workflow: { status: 'draft' },
    });
    updateStoredArticleMock.mockResolvedValue({
      _id: 'article-1',
      version: 6,
      title: 'Guarded title',
      isBreaking: false,
      breakingTts: null,
      workflow: { status: 'draft' },
    });

    const { PUT } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PUT(
      createJsonRequest('PUT', {
        expectedVersion: 5,
        title: 'Guarded title',
        summary: 'Guarded summary',
        content: 'Guarded content',
        image: 'https://cdn.example.com/guarded.jpg',
        category: 'General',
        author: 'Desk',
      }),
      { params: Promise.resolve({ id: 'article-1' }) }
    );

    expect(response.status).toBe(200);
    expect(updateStoredArticleMock).toHaveBeenNthCalledWith(
      1,
      'article-1',
      expect.objectContaining({ title: 'Guarded title' }),
      { expectedVersion: 5 }
    );
  });

  it('patches a legacy Mongo article with no stored version using logical version 1', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lokswami-test';
    connectDBMock.mockResolvedValue(undefined);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: MONGO_ARTICLE_ID,
        title: 'Legacy title',
        slug: 'legacy-title',
        previousSlugs: [],
        updatedAt: '2026-07-13T09:30:00.000Z',
        workflow: {
          status: 'draft',
          createdBy: {
            id: 'admin-1',
            email: 'desk@example.com',
            name: 'Desk',
            role: 'admin',
          },
        },
      }),
    });
    articleFindOneAndUpdateMock.mockResolvedValue(
      createMongoArticleDocument({ title: 'Updated legacy title' })
    );

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', {
        title: 'Updated legacy title',
        autosave: true,
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: MONGO_ARTICLE_ID }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.version).toBe(2);
    expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
      {
        _id: MONGO_ARTICLE_ID,
        $or: [{ version: 1 }, { version: { $exists: false } }],
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          title: 'Updated legacy title',
          version: 2,
        }),
      }),
      { new: true, runValidators: true }
    );
    const mongoUpdate = articleFindOneAndUpdateMock.mock.calls[0]?.[1];
    expect(mongoUpdate).not.toHaveProperty('$inc');
  });

  it('replaces a legacy Mongo article with no stored version using logical version 1', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lokswami-test';
    connectDBMock.mockResolvedValue(undefined);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    articleExistsMock.mockResolvedValue(false);
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: MONGO_ARTICLE_ID,
        title: 'Legacy title',
        slug: 'legacy-title',
        previousSlugs: [],
        updatedAt: '2026-07-13T09:30:00.000Z',
        workflow: {
          status: 'draft',
          createdBy: {
            id: 'admin-1',
            email: 'desk@example.com',
            name: 'Desk',
            role: 'admin',
          },
        },
      }),
    });
    articleFindOneAndUpdateMock.mockResolvedValue(
      createMongoArticleDocument({ title: 'Replaced legacy title' })
    );

    const { PUT } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PUT(
      createJsonRequest('PUT', {
        expectedVersion: 1,
        title: 'Replaced legacy title',
        summary: 'Updated legacy summary',
        content: 'Updated legacy article content',
        image: 'https://cdn.example.com/legacy.jpg',
        category: 'General',
        author: 'Desk',
      }),
      { params: Promise.resolve({ id: MONGO_ARTICLE_ID }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.version).toBe(2);
    expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
      {
        _id: MONGO_ARTICLE_ID,
        $or: [{ version: 1 }, { version: { $exists: false } }],
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          title: 'Replaced legacy title',
          version: 2,
        }),
      }),
      { new: true, runValidators: true }
    );
    const mongoUpdate = articleFindOneAndUpdateMock.mock.calls[0]?.[1];
    expect(mongoUpdate).not.toHaveProperty('$inc');
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
    getStoredArticleByIdMock.mockResolvedValue(createReadyWorkflowArticle());
    updateStoredArticleMock.mockResolvedValue({
      _id: 'article-1',
      version: 5,
      title: 'Ready article',
      workflow: { status: 'published' },
      publishedAt: '2026-05-12T10:00:00.000Z',
    });

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', { action: 'publish', expectedVersion: 4 }),
      {
      params: Promise.resolve({ id: 'article-1' }),
      }
    );
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
      { skipRevision: true, expectedVersion: 4 }
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

  it('rejects a stale workflow action before updating the file store', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue(createReadyWorkflowArticle());

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', { action: 'publish', expectedVersion: 3 }),
      { params: Promise.resolve({ id: 'article-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        code: 'ARTICLE_VERSION_CONFLICT',
        currentVersion: 4,
      })
    );
    expect(updateStoredArticleMock).not.toHaveBeenCalled();
    expect(recordArticleActivityMock).not.toHaveBeenCalled();
  });

  it('returns 409 when a file-store workflow action loses its queued version claim', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue(createReadyWorkflowArticle());
    const conflict = Object.assign(new Error('stale workflow'), { currentVersion: 5 });
    updateStoredArticleMock.mockRejectedValue(conflict);
    isArticleVersionConflictErrorMock.mockReturnValue(true);

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', { action: 'publish', expectedVersion: 4 }),
      { params: Promise.resolve({ id: 'article-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        code: 'ARTICLE_VERSION_CONFLICT',
        currentVersion: 5,
      })
    );
    expect(updateStoredArticleMock).toHaveBeenCalledWith(
      'article-1',
      expect.objectContaining({ workflow: expect.objectContaining({ status: 'published' }) }),
      { skipRevision: true, expectedVersion: 4 }
    );
    expect(recordArticleActivityMock).not.toHaveBeenCalled();
  });

  it('atomically advances a legacy Mongo workflow action from logical version 1 to 2', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lokswami-test';
    connectDBMock.mockResolvedValue(undefined);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue(
        createReadyWorkflowArticle({ _id: MONGO_ARTICLE_ID, version: undefined })
      ),
    });
    articleFindOneAndUpdateMock.mockResolvedValue(
      createMongoArticleDocument({ workflow: { status: 'published' }, version: 2 })
    );

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', { action: 'publish', expectedVersion: 1 }),
      { params: Promise.resolve({ id: MONGO_ARTICLE_ID }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.version).toBe(2);
    expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
      {
        _id: MONGO_ARTICLE_ID,
        $or: [{ version: 1 }, { version: { $exists: false } }],
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          workflow: expect.objectContaining({ status: 'published' }),
          version: 2,
        }),
      }),
      { new: true, runValidators: true }
    );
    expect(articleFindOneAndUpdateMock.mock.calls[0]?.[1]).not.toHaveProperty('$inc');
    expect(recordArticleActivityMock).toHaveBeenCalledTimes(1);
  });

  it('returns 409 without activity when a Mongo workflow action loses its CAS', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lokswami-test';
    connectDBMock.mockResolvedValue(undefined);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    articleFindByIdMock
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(
          createReadyWorkflowArticle({ _id: MONGO_ARTICLE_ID, version: 7 })
        ),
      })
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          _id: MONGO_ARTICLE_ID,
          version: 8,
          updatedAt: '2026-07-14T10:00:00.000Z',
        }),
      });
    articleFindOneAndUpdateMock.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(
      createJsonRequest('PATCH', { action: 'publish', expectedVersion: 7 }),
      { params: Promise.resolve({ id: MONGO_ARTICLE_ID }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        code: 'ARTICLE_VERSION_CONFLICT',
        currentVersion: 8,
      })
    );
    expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: MONGO_ARTICLE_ID, version: 7 },
      expect.objectContaining({ $inc: { version: 1 } }),
      { new: true, runValidators: true }
    );
    expect(recordArticleActivityMock).not.toHaveBeenCalled();
  });

  it('blocks publishing breaking articles without ready manual breaking audio', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      title: 'Breaking article',
      summary: 'Ready summary',
      content: 'Ready content',
      image: 'https://cdn.example.com/image.jpg',
      category: 'General',
      author: 'Desk',
      isBreaking: true,
      breakingTts: null,
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

    const { PATCH } = await import('@/app/api/admin/articles/[id]/route');
    const response = await PATCH(createJsonRequest('PATCH', { action: 'publish' }), {
      params: Promise.resolve({ id: 'article-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: 'Upload breaking news audio before publishing this breaking article.',
    });
    expect(updateStoredArticleMock).not.toHaveBeenCalled();
  });

  it('returns 409 when a queued file-store delete loses its version claim', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'article-1',
      version: 4,
      workflow: { status: 'draft' },
      updatedAt: '2026-07-14T09:00:00.000Z',
    });
    deleteStoredArticleMock.mockRejectedValue(
      Object.assign(new Error('stale delete'), { currentVersion: 5 })
    );
    isArticleVersionConflictErrorMock.mockReturnValue(true);

    const { DELETE } = await import('@/app/api/admin/articles/[id]/route');
    const response = await DELETE(
      createJsonRequest('DELETE', undefined, { expectedVersion: '4' }),
      { params: Promise.resolve({ id: 'article-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        code: 'ARTICLE_VERSION_CONFLICT',
        currentVersion: 5,
      })
    );
    expect(deleteStoredArticleMock).toHaveBeenCalledWith('article-1', {
      expectedVersion: 4,
    });
  });

  it('rejects a stale Mongo delete before removing the article', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lokswami-test';
    connectDBMock.mockResolvedValue(undefined);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: MONGO_ARTICLE_ID,
        version: 4,
        workflow: { status: 'draft' },
        updatedAt: '2026-07-14T09:00:00.000Z',
      }),
    });

    const { DELETE } = await import('@/app/api/admin/articles/[id]/route');
    const response = await DELETE(
      createJsonRequest('DELETE', undefined, { expectedVersion: '3' }),
      { params: Promise.resolve({ id: MONGO_ARTICLE_ID }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        code: 'ARTICLE_VERSION_CONFLICT',
        currentVersion: 4,
      })
    );
    expect(articleFindOneAndDeleteMock).not.toHaveBeenCalled();
  });

  it('atomically deletes a legacy Mongo article at logical version 1', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lokswami-test';
    connectDBMock.mockResolvedValue(undefined);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    const legacyArticle = {
      _id: MONGO_ARTICLE_ID,
      workflow: { status: 'draft' },
      updatedAt: '2026-07-14T09:00:00.000Z',
    };
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue(legacyArticle),
    });
    articleFindOneAndDeleteMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue(legacyArticle),
    });

    const { DELETE } = await import('@/app/api/admin/articles/[id]/route');
    const response = await DELETE(
      createJsonRequest('DELETE', undefined, { expectedVersion: '1' }),
      { params: Promise.resolve({ id: MONGO_ARTICLE_ID }) }
    );

    expect(response.status).toBe(200);
    expect(articleFindOneAndDeleteMock).toHaveBeenCalledWith({
      _id: MONGO_ARTICLE_ID,
      $or: [{ version: 1 }, { version: { $exists: false } }],
    });
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
