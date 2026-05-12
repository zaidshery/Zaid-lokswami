import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectDBMock = vi.fn();
const listAllStoredArticlesMock = vi.fn();
const listAllStoredStoriesMock = vi.fn();
const listAllStoredVideosMock = vi.fn();
const listAllStoredEPapersMock = vi.fn();

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('@/lib/models/Story', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('@/lib/models/Video', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('@/lib/models/EPaper', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  listAllStoredArticles: listAllStoredArticlesMock,
}));

vi.mock('@/lib/storage/storiesFile', () => ({
  listAllStoredStories: listAllStoredStoriesMock,
}));

vi.mock('@/lib/storage/videosFile', () => ({
  listAllStoredVideos: listAllStoredVideosMock,
}));

vi.mock('@/lib/storage/epapersFile', () => ({
  listAllStoredEPapers: listAllStoredEPapersMock,
}));

describe('article workflow overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.MONGODB_URI;
    listAllStoredArticlesMock.mockResolvedValue([]);
    listAllStoredStoriesMock.mockResolvedValue([]);
    listAllStoredVideosMock.mockResolvedValue([]);
    listAllStoredEPapersMock.mockResolvedValue([]);
  });

  it('builds reporter my-work overview with story-only statuses', async () => {
    listAllStoredArticlesMock.mockResolvedValue([
      {
        _id: 'article-1',
        title: 'Reporter article',
        category: 'Politics',
        author: 'Reporter One',
        updatedAt: '2026-04-13T12:00:00.000Z',
        workflow: {
          status: 'changes_requested',
          createdBy: {
            id: 'reporter-1',
            name: 'Reporter One',
            email: 'reporter@example.com',
            role: 'reporter',
          },
          reviewedBy: {
            id: 'copy-1',
            name: 'Copy Desk',
            email: 'copy@example.com',
            role: 'copy_editor',
          },
        },
        reporterMeta: {
          locationTag: 'Bhopal',
          reporterNotes: 'Need district confirmation',
        },
        copyEditorMeta: {
          copyEditorNotes: 'Tighten the intro.',
          returnForChangesReason: 'Add one more named source before resubmitting.',
        },
      },
      {
        _id: 'article-2',
        title: 'Another desk article',
        category: 'General',
        author: 'Desk',
        updatedAt: '2026-04-13T07:00:00.000Z',
        workflow: {
          status: 'approved',
          createdBy: {
            id: 'admin-1',
            name: 'Desk',
            email: 'desk@example.com',
            role: 'admin',
          },
        },
      },
    ]);

    listAllStoredStoriesMock.mockResolvedValue([
      {
        _id: 'story-1',
        title: 'Submitted story',
        category: 'General',
        author: 'Desk',
        updatedAt: '2026-04-13T11:00:00.000Z',
        isPublished: false,
        workflow: {
          status: 'submitted',
          createdBy: {
            id: 'reporter-1',
            name: 'Reporter One',
            email: 'reporter@example.com',
            role: 'reporter',
          },
        },
      },
      {
        _id: 'story-2',
        title: 'Assigned story',
        category: 'Metro',
        author: 'Desk',
        updatedAt: '2026-04-13T10:00:00.000Z',
        isPublished: false,
        workflow: {
          status: 'assigned',
          createdBy: {
            id: 'reporter-2',
            name: 'Reporter Two',
            email: 'reporter-two@example.com',
            role: 'reporter',
          },
          assignedTo: {
            id: 'reporter-1',
            name: 'Reporter One',
            email: 'reporter@example.com',
            role: 'reporter',
          },
        },
      },
    ]);

    const { getMyWorkOverview } = await import('@/lib/admin/articleWorkflowOverview');
    const overview = await getMyWorkOverview(
      {
        id: 'reporter-1',
        email: 'reporter@example.com',
        name: 'Reporter One',
        role: 'reporter',
      },
      { maxItems: null }
    );

    expect(overview.counts).toMatchObject({
      submitted: 1,
      assigned: 1,
    });
    expect(overview.counts.changes_requested || 0).toBe(0);
    expect(overview.contentCounts).toMatchObject({
      story: 2,
    });
    expect(overview.contentCounts.article || 0).toBe(0);
    expect(overview.items.map((item) => item.id)).toEqual(['story-1', 'story-2']);
    expect(overview.items[0]).toEqual(
      expect.objectContaining({
        contentType: 'story',
        author: 'Reporter One',
        status: 'submitted',
      })
    );
    expect(overview.items[1]).toEqual(
      expect.objectContaining({
        contentType: 'story',
        author: 'Reporter Two',
        status: 'assigned',
      })
    );
  });

  it('builds review queue overview from reviewable workflow states only', async () => {
    listAllStoredArticlesMock.mockResolvedValue([
      {
        _id: 'article-review',
        title: 'Needs desk review',
        category: 'Politics',
        author: 'Desk',
        updatedAt: '2026-04-13T12:00:00.000Z',
        workflow: {
          status: 'submitted',
          priority: 'high',
          assignedTo: {
            id: 'copy-1',
            name: 'Copy Desk',
            email: 'copy@example.com',
            role: 'copy_editor',
          },
        },
      },
      {
        _id: 'article-draft',
        title: 'Draft article',
        category: 'General',
        author: 'Desk',
        updatedAt: '2026-04-13T09:00:00.000Z',
        workflow: {
          status: 'draft',
          priority: 'normal',
        },
      },
    ]);

    listAllStoredStoriesMock.mockResolvedValue([
      {
        _id: 'story-copy',
        title: 'Copy edit story',
        category: 'Metro',
        author: 'Desk',
        updatedAt: '2026-04-13T11:00:00.000Z',
        isPublished: false,
        workflow: {
          status: 'copy_edit',
          priority: 'high',
        },
      },
    ]);

    listAllStoredVideosMock.mockResolvedValue([
      {
        _id: 'video-approved',
        title: 'Approved video',
        category: 'General',
        updatedAt: '2026-04-13T10:00:00.000Z',
        isPublished: false,
        workflow: {
          status: 'approved',
          priority: 'urgent',
        },
      },
      {
        _id: 'video-published',
        title: 'Published video',
        category: 'General',
        updatedAt: '2026-04-13T08:00:00.000Z',
        isPublished: true,
        workflow: {
          status: 'published',
        },
      },
    ]);

    const { getReviewQueueOverview } = await import('@/lib/admin/articleWorkflowOverview');
    const overview = await getReviewQueueOverview({ maxItems: null });

    expect(overview.counts).toMatchObject({
      submitted: 1,
      copy_edit: 1,
      approved: 1,
    });
    expect(overview.contentCounts).toMatchObject({
      article: 1,
      story: 1,
      video: 1,
    });
    expect(overview.items.map((item) => item.id)).toEqual([
      'article-review',
      'story-copy',
      'video-approved',
    ]);

    const highPriorityOverview = await getReviewQueueOverview({
      maxItems: null,
      filters: {
        priority: 'high',
      },
    });
    expect(highPriorityOverview.items.map((item) => item.id)).toEqual([
      'article-review',
      'story-copy',
    ]);

    const assignedSubmittedOverview = await getReviewQueueOverview({
      maxItems: null,
      filters: {
        status: 'submitted',
        assignment: 'assigned',
      },
    });
    expect(assignedSubmittedOverview.items.map((item) => item.id)).toEqual(['article-review']);

    const unassignedSubmittedOverview = await getReviewQueueOverview({
      maxItems: null,
      filters: {
        status: 'submitted',
        assignment: 'unassigned',
      },
    });
    expect(unassignedSubmittedOverview.items).toEqual([]);
  });
});
