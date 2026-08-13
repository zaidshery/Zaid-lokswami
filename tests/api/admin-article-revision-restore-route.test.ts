import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const connectDBMock = vi.fn();
const articleFindByIdMock = vi.fn();
const articleFindOneAndUpdateMock = vi.fn();
const articleExistsMock = vi.fn();
const recordArticleActivityMock = vi.fn();
const originalMongoUri = process.env.MONGODB_URI;

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionFromReq: getAdminSessionMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    findById: articleFindByIdMock,
    findOneAndUpdate: articleFindOneAndUpdateMock,
    exists: articleExistsMock,
  },
}));

vi.mock('@/lib/server/articleActivity', () => ({
  buildArticleActivityMessage: vi.fn(() => 'Article activity recorded.'),
  recordArticleActivity: recordArticleActivityMock,
}));

function createRequest() {
  return new Request(
    'http://localhost/api/admin/articles/507f1f77bcf86cd799439011/revisions/revision-1/restore',
    { method: 'POST' }
  ) as NextRequest;
}

describe('/api/admin/articles/[id]/revisions/[revisionId]/restore route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MONGODB_URI = 'mongodb://example.test/lokswami';
    connectDBMock.mockResolvedValue(undefined);
    articleExistsMock.mockResolvedValue(false);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'super_admin',
    });
  });

  afterEach(() => {
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
  });

  it('atomically increments the article version when restoring a Mongo revision', async () => {
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        version: 4,
        title: 'Current title',
        summary: 'Current summary',
        content: '<p>Current content</p>',
        contentJson: {
          version: 1,
          blocks: [
            {
              id: 'current-block',
              type: 'paragraph',
              html: '<p>Current structured content</p>',
              text: 'Current structured content',
              attrs: {},
            },
          ],
        },
        image: '/current.jpg',
        category: 'News',
        author: 'Current Author',
        slug: 'current-title',
        previousSlugs: ['older-current-title'],
        seo: { canonicalUrl: 'https://example.com/historical-story' },
        editorial: { storyType: 'standard' },
        media: { sourceMediaId: 'current-media' },
        workflow: { status: 'draft' },
        revisions: [
          {
            _id: 'revision-1',
            title: 'Restored title',
            summary: 'Restored summary',
            content: '<p>Restored content</p>',
            contentJson: {
              version: 1,
              blocks: [
                {
                  id: 'restored-block',
                  type: 'paragraph',
                  html: '<p>Restored structured content</p>',
                  text: 'Restored structured content',
                  attrs: {},
                },
              ],
            },
            image: '/restored.jpg',
            category: 'Politics',
            author: 'Revision Author',
            slug: 'restored-title',
            previousSlugs: ['legacy-title'],
            seo: { canonicalUrl: 'https://example.com/historical-story' },
            editorial: { storyType: 'investigation' },
            media: { sourceMediaId: 'restored-media' },
          },
        ],
      }),
    });
    articleFindOneAndUpdateMock.mockResolvedValue({
      toObject: vi.fn(() => ({
        version: 5,
        title: 'Restored title',
        workflow: { status: 'draft' },
      })),
    });

    const { POST } = await import(
      '@/app/api/admin/articles/[id]/revisions/[revisionId]/restore/route'
    );
    const response = await POST(createRequest(), {
      params: Promise.resolve({
        id: '507f1f77bcf86cd799439011',
        revisionId: 'revision-1',
      }),
    });

    expect(response.status).toBe(200);
    expect(articleExistsMock).toHaveBeenCalledWith({
      _id: { $ne: '507f1f77bcf86cd799439011' },
      $or: [{ slug: 'restored-title' }, { previousSlugs: 'restored-title' }],
    });
    expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
      {
        _id: '507f1f77bcf86cd799439011',
        version: 4,
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          content: '<p>Restored content</p>',
          contentJson: expect.objectContaining({
            blocks: [expect.objectContaining({ id: 'restored-block' })],
          }),
          editorial: expect.objectContaining({ storyType: 'investigation' }),
          media: expect.objectContaining({ sourceMediaId: 'restored-media' }),
          slug: 'restored-title',
          seo: expect.objectContaining({
            canonicalUrl: 'https://example.com/historical-story',
          }),
          previousSlugs: expect.arrayContaining([
            'older-current-title',
            'legacy-title',
            'current-title',
          ]),
        }),
        $inc: { version: 1 },
        $push: {
          revisions: {
            $each: [
              expect.objectContaining({
                contentJson: expect.objectContaining({
                  blocks: [expect.objectContaining({ id: 'current-block' })],
                }),
                editorial: expect.objectContaining({ storyType: 'standard' }),
                media: expect.objectContaining({ sourceMediaId: 'current-media' }),
                slug: 'current-title',
                previousSlugs: ['older-current-title'],
              }),
            ],
            $slice: -30,
          },
        },
      }),
      { new: true, runValidators: true }
    );
  });

  it('advances a legacy article without a stored version from logical version 1 to 2', async () => {
    articleExistsMock.mockResolvedValue(true);
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        title: 'Current title',
        summary: 'Current summary',
        content: '<p>Current content</p>',
        image: '/current.jpg',
        category: 'News',
        author: 'Current Author',
        slug: 'current-title',
        previousSlugs: ['older-current-title'],
        workflow: { status: 'draft' },
        revisions: [
          {
            _id: 'revision-1',
            title: 'Restored title',
            summary: 'Restored summary',
            content: '<p>Restored content</p>',
            image: '/restored.jpg',
            category: 'Politics',
            author: 'Revision Author',
            slug: 'taken-title',
            previousSlugs: ['revision-history'],
          },
        ],
      }),
    });
    articleFindOneAndUpdateMock.mockResolvedValue({
      toObject: vi.fn(() => ({
        version: 2,
        title: 'Restored title',
        workflow: { status: 'draft' },
      })),
    });

    const { POST } = await import(
      '@/app/api/admin/articles/[id]/revisions/[revisionId]/restore/route'
    );
    const response = await POST(createRequest(), {
      params: Promise.resolve({
        id: '507f1f77bcf86cd799439011',
        revisionId: 'revision-1',
      }),
    });

    expect(response.status).toBe(200);
    expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
      {
        _id: '507f1f77bcf86cd799439011',
        version: { $exists: false },
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          slug: 'current-title',
          previousSlugs: ['older-current-title'],
        }),
        $inc: { version: 2 },
      }),
      { new: true, runValidators: true }
    );
  });

  it('rejects a revision that changes the canonical to an unsupported value', async () => {
    articleFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        version: 4,
        title: 'Current title',
        summary: 'Current summary',
        content: '<p>Current content</p>',
        image: '/current.jpg',
        category: 'News',
        author: 'Current Author',
        slug: 'current-title',
        previousSlugs: [],
        seo: { canonicalUrl: '' },
        workflow: { status: 'draft' },
        revisions: [
          {
            _id: 'revision-1',
            title: 'Restored title',
            summary: 'Restored summary',
            content: '<p>Restored content</p>',
            image: '/restored.jpg',
            category: 'Politics',
            author: 'Revision Author',
            slug: 'restored-title',
            previousSlugs: [],
            seo: { canonicalUrl: 'https://example.com/restored-title' },
          },
        ],
      }),
    });

    const { POST } = await import(
      '@/app/api/admin/articles/[id]/revisions/[revisionId]/restore/route'
    );
    const response = await POST(createRequest(), {
      params: Promise.resolve({
        id: '507f1f77bcf86cd799439011',
        revisionId: 'revision-1',
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/public site origin/i);
    expect(articleFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it.each([
    ['omitted', undefined, 200, 'https://example.com/historical-story'],
    ['cleared', { canonicalUrl: '' }, 200, ''],
    [
      'unchanged',
      { canonicalUrl: 'https://example.com/historical-story' },
      200,
      'https://example.com/historical-story',
    ],
    [
      'changed valid',
      { canonicalUrl: 'https://lokswami.com/main/article/restored-title' },
      200,
      'https://lokswami.com/main/article/restored-title',
    ],
    [
      'changed invalid',
      { canonicalUrl: 'https://example.com/restored-title' },
      400,
      'public site origin',
    ],
  ])(
    'keeps Mongo revision canonical semantics aligned for %s input',
    async (_label, revisionSeo, expectedStatus, expectedValue) => {
      const targetRevision = {
        _id: 'revision-1',
        title: 'Restored title',
        summary: 'Restored summary',
        content: '<p>Restored content</p>',
        image: '/restored.jpg',
        category: 'Politics',
        author: 'Revision Author',
        slug: 'restored-title',
        previousSlugs: [],
        ...(revisionSeo === undefined ? {} : { seo: revisionSeo }),
      };
      articleFindByIdMock.mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          version: 4,
          title: 'Current title',
          summary: 'Current summary',
          content: '<p>Current content</p>',
          image: '/current.jpg',
          category: 'News',
          author: 'Current Author',
          slug: 'current-title',
          previousSlugs: [],
          seo: { canonicalUrl: 'https://example.com/historical-story' },
          workflow: { status: 'draft' },
          revisions: [targetRevision],
        }),
      });
      articleFindOneAndUpdateMock.mockResolvedValue({
        toObject: vi.fn(() => ({
          version: 5,
          title: 'Restored title',
          workflow: { status: 'draft' },
        })),
      });

      const { POST } = await import(
        '@/app/api/admin/articles/[id]/revisions/[revisionId]/restore/route'
      );
      const response = await POST(createRequest(), {
        params: Promise.resolve({
          id: '507f1f77bcf86cd799439011',
          revisionId: 'revision-1',
        }),
      });

      expect(response.status).toBe(expectedStatus);
      if (expectedStatus === 200) {
        expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            $set: expect.objectContaining({
              seo: expect.objectContaining({ canonicalUrl: expectedValue }),
            }),
          }),
          { new: true, runValidators: true }
        );
      } else {
        const payload = await response.json();
        expect(payload.error).toContain(expectedValue);
        expect(articleFindOneAndUpdateMock).not.toHaveBeenCalled();
      }
    }
  );
});
