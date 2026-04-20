import { describe, expect, it } from 'vitest';
import {
  buildSocialDraftCaption,
  buildSocialDraftHashtags,
  buildSocialDraftSeed,
  canGenerateSocialDrafts,
} from '@/lib/server/socialPostDrafts';

const baseStory = {
  _id: 'story-1',
  title: 'Bhopal Monsoon Update',
  category: 'Weather',
  author: 'Lokswami Desk',
  thumbnail: 'https://cdn.example.com/story-thumb.jpg',
  linkedArticleId: 'article-1',
  videoProduction: {
    status: 'ready_to_publish' as const,
    assignedTo: null,
    editorNotes: '',
    masterExportUrl: 'https://cdn.example.com/final-story.mp4',
    thumbnailUrl: 'https://cdn.example.com/final-thumb.jpg',
    updatedAt: '2026-04-20T12:00:00.000Z',
  },
};

const baseArticle = {
  _id: 'article-1',
  title: 'Heavy rain alert issued across Bhopal',
  summary: 'Officials warned commuters to avoid low-lying areas.',
  sourceStoryId: 'story-1',
};

describe('social post draft helpers', () => {
  it('blocks draft generation until the newsroom has a linked article and final export', () => {
    expect(canGenerateSocialDrafts({ story: null, article: null })).toBe('Source story not found');
    expect(
      canGenerateSocialDrafts({
        story: { ...baseStory, linkedArticleId: '' },
        article: null,
      })
    ).toBe('Create the primary article before generating social drafts.');
    expect(
      canGenerateSocialDrafts({
        story: {
          ...baseStory,
          videoProduction: {
            ...baseStory.videoProduction,
            masterExportUrl: '',
          },
        },
        article: baseArticle,
      })
    ).toBe('Upload the final edited video export before generating social drafts.');
  });

  it('creates platform-specific captions and hashtags from approved content', () => {
    expect(
      buildSocialDraftCaption({
        story: baseStory,
        article: baseArticle,
        platform: 'youtube',
      })
    ).toBe('Heavy rain alert issued across Bhopal\n\nOfficials warned commuters to avoid low-lying areas.');

    expect(
      buildSocialDraftCaption({
        story: baseStory,
        article: baseArticle,
        platform: 'facebook',
      })
    ).toBe('Heavy rain alert issued across Bhopal - Officials warned commuters to avoid low-lying areas.');

    expect(buildSocialDraftHashtags('Breaking News')).toBe('#Lokswami #BreakingNews #News');
  });

  it('generates one social draft per supported platform', () => {
    const records = buildSocialDraftSeed({
      story: baseStory,
      article: baseArticle,
      actor: {
        id: 'admin-1',
        name: 'Desk Admin',
        email: 'desk@example.com',
        role: 'admin',
      },
    });

    expect(records).toHaveLength(3);
    expect(records.map((record) => record.platform)).toEqual([
      'youtube',
      'facebook',
      'instagram',
    ]);
    expect(records[0]).toEqual(
      expect.objectContaining({
        sourceStoryId: 'story-1',
        sourceArticleId: 'article-1',
        status: 'draft',
        videoUrl: 'https://cdn.example.com/final-story.mp4',
        thumbnailUrl: 'https://cdn.example.com/final-thumb.jpg',
        createdBy: expect.objectContaining({
          id: 'admin-1',
          role: 'admin',
        }),
      })
    );
  });
});
