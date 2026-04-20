import { describe, expect, it } from 'vitest';
import { summarizeNewsroomPipeline } from '@/lib/admin/newsroomPipeline';

describe('newsroom pipeline analytics', () => {
  it('summarizes story to article to video to social completion in one place', () => {
    const summary = summarizeNewsroomPipeline({
      source: 'file',
      stories: [
        {
          _id: 'story-1',
          workflow: { status: 'approved' },
          linkedArticleId: 'article-1',
          linkedArticleStatus: 'published',
          videoProduction: {
            status: 'ready_to_publish',
            masterExportUrl: 'https://cdn.example.com/final-1.mp4',
          },
        },
        {
          _id: 'story-2',
          workflow: { status: 'approved' },
          linkedArticleId: '',
          linkedArticleStatus: 'not_created',
          videoProduction: {
            status: 'not_started',
            masterExportUrl: '',
          },
        },
        {
          _id: 'story-3',
          workflow: { status: 'submitted' },
          linkedArticleId: '',
          linkedArticleStatus: 'not_created',
          videoProduction: {
            status: 'not_started',
            masterExportUrl: '',
          },
        },
      ],
      articles: [
        {
          _id: 'article-1',
          sourceType: 'story',
          sourceStoryId: 'story-1',
          workflow: { status: 'published' },
        },
        {
          _id: 'article-2',
          sourceType: 'direct',
          sourceStoryId: '',
          workflow: { status: 'draft' },
        },
      ],
      socialPosts: [
        {
          sourceStoryId: 'story-1',
          status: 'draft',
        },
        {
          sourceStoryId: 'story-1',
          status: 'published',
        },
      ],
    });

    expect(summary.totals.stories).toBe(3);
    expect(summary.totals.approvedStories).toBe(2);
    expect(summary.totals.linkedArticles).toBe(1);
    expect(summary.totals.directArticles).toBe(1);

    expect(summary.pipeline.storiesSubmitted).toBe(1);
    expect(summary.pipeline.linkedArticleCreated).toBe(1);
    expect(summary.pipeline.linkedArticlePublished).toBe(1);
    expect(summary.pipeline.videoReady).toBe(1);
    expect(summary.pipeline.socialDrafted).toBe(1);
    expect(summary.pipeline.socialPublished).toBe(1);
    expect(summary.pipeline.fullyDistributed).toBe(1);

    expect(summary.bottlenecks.awaitingArticle).toBe(1);
    expect(summary.bottlenecks.awaitingVideo).toBe(0);
    expect(summary.bottlenecks.awaitingSocialDrafts).toBe(0);
    expect(summary.bottlenecks.awaitingSocialPublish).toBe(0);
    expect(summary.socialStatuses.draft).toBe(1);
    expect(summary.socialStatuses.published).toBe(1);
  });

  it('filters pipeline analytics by time window, category, and reporter', () => {
    const summary = summarizeNewsroomPipeline({
      source: 'file',
      now: new Date('2026-04-20T12:00:00.000Z'),
      filters: {
        range: '30d',
        category: 'Politics',
        reporter: 'Parvez Khan',
      },
      stories: [
        {
          _id: 'story-1',
          category: 'Politics',
          author: 'Parvez Khan',
          updatedAt: '2026-04-18T10:00:00.000Z',
          workflow: {
            status: 'approved',
            createdBy: {
              id: 'reporter-1',
              name: 'Parvez Khan',
              email: 'parvez@example.com',
            },
          },
          linkedArticleId: 'article-1',
          linkedArticleStatus: 'draft',
          videoProduction: {
            status: 'editing',
            masterExportUrl: '',
          },
        },
        {
          _id: 'story-2',
          category: 'Sports',
          author: 'Desk',
          updatedAt: '2026-01-01T10:00:00.000Z',
          workflow: {
            status: 'approved',
            createdBy: {
              id: 'reporter-2',
              name: 'Other Reporter',
              email: 'other@example.com',
            },
          },
          linkedArticleId: 'article-2',
          linkedArticleStatus: 'published',
          videoProduction: {
            status: 'ready_to_publish',
            masterExportUrl: 'https://cdn.example.com/final-2.mp4',
          },
        },
      ],
      articles: [
        {
          _id: 'article-1',
          category: 'Politics',
          author: 'Parvez Khan',
          sourceType: 'story',
          sourceStoryId: 'story-1',
          workflow: { status: 'draft' },
          updatedAt: '2026-04-18T10:30:00.000Z',
        },
        {
          _id: 'article-2',
          category: 'Politics',
          author: 'Parvez Khan',
          sourceType: 'direct',
          sourceStoryId: '',
          workflow: {
            status: 'submitted',
            createdBy: {
              id: 'editor-1',
              name: 'Parvez Khan',
              email: 'parvez@example.com',
            },
          },
          updatedAt: '2026-04-16T10:30:00.000Z',
        },
      ],
      socialPosts: [
        {
          sourceStoryId: 'story-1',
          status: 'draft',
        },
        {
          sourceStoryId: 'story-2',
          status: 'published',
        },
      ],
    });

    expect(summary.filters.applied.range).toBe('30d');
    expect(summary.filters.applied.category).toBe('Politics');
    expect(summary.filters.applied.reporter).toBe('Parvez Khan');
    expect(summary.filters.options.categories).toContain('Politics');
    expect(summary.filters.options.reporters).toContain('Parvez Khan');

    expect(summary.totals.stories).toBe(1);
    expect(summary.totals.articles).toBe(2);
    expect(summary.totals.linkedArticles).toBe(1);
    expect(summary.totals.directArticles).toBe(1);
    expect(summary.totals.socialPosts).toBe(1);

    expect(summary.pipeline.approvedStories).toBe(1);
    expect(summary.pipeline.linkedArticleCreated).toBe(1);
    expect(summary.pipeline.videoStarted).toBe(1);
    expect(summary.pipeline.socialDrafted).toBe(1);
    expect(summary.pipeline.socialPublished).toBe(0);
  });
});
