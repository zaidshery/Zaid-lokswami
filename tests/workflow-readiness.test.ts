import { describe, expect, it } from 'vitest';
import {
  buildEditorialReadiness,
  buildPublicationReadiness,
  validateEditorialPublishReadiness,
} from '@/lib/workflow/readiness';

describe('shared newsroom readiness', () => {
  it('keeps warnings advisory but blocks missing editorial publish requirements', () => {
    const draft = buildEditorialReadiness({ contentType: 'video', title: 'Desk update', category: 'National' });
    expect(draft.state).toBe('blocked');
    expect(draft.blockers).toEqual(expect.arrayContaining([
      'Add a video description before publishing.',
      'Add the final video source before publishing.',
    ]));
    expect(validateEditorialPublishReadiness({ contentType: 'video', title: 'Desk update', category: 'National' }, 'approve')).toBeNull();
    expect(validateEditorialPublishReadiness({ contentType: 'video', title: 'Desk update', category: 'National' }, 'publish')).toContain('Publishing is blocked');
  });

  it('requires breaking audio for urgent article release readiness', () => {
    const report = buildEditorialReadiness({
      contentType: 'article',
      title: 'Breaking update',
      category: 'National',
      summary: 'Verified summary',
      content: 'A'.repeat(120),
      author: 'News Desk',
      image: '/uploads/lead.jpg',
      slug: 'breaking-update',
      isBreaking: true,
      breakingAudioReady: false,
    });
    expect(report.blockers).toContain('Breaking stories require matching audio before publishing.');
  });

  it('uses monthly issue language for E-Magazine without daily edition assumptions', () => {
    const magazine = buildPublicationReadiness({ publicationType: 'emagazine', title: 'July issue' });
    expect(magazine.blockers.join(' ')).toContain('monthly issue');
    expect(magazine.blockers.join(' ')).not.toContain('daily');
  });
});
