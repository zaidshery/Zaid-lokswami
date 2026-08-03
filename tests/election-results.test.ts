import { describe, expect, it } from 'vitest';
import {
  finalizeElectionResults,
  normalizeElectionResultsData,
} from '@/lib/elections/results';

describe('election results configuration', () => {
  it('normalizes older live-only result data into the reusable widget shape', () => {
    const data = normalizeElectionResultsData({
      lastUpdated: '2026-05-04T08:00:00.000Z',
      states: {
        wb: {
          name: 'West Bengal',
          totalSeats: 294,
          parties: [{ name: 'TMC', color: '#45B5E4', won: 12, leading: 182 }],
        },
      },
    });

    expect(data.mode).toBe('final');
    expect(data.homepageEnabled).toBe(true);
    expect(data.badgeLabel).toBe('FINAL');
    expect(data.states.wb.parties[0]).toEqual({
      name: 'TMC',
      color: '#45B5E4',
      won: 12,
      leading: 182,
    });
  });

  it('can convert live leads into final won totals for archiving', () => {
    const finalized = finalizeElectionResults(
      normalizeElectionResultsData({
        mode: 'live',
        badgeLabel: 'LIVE',
        states: {
          wb: {
            name: 'West Bengal',
            totalSeats: 294,
            parties: [
              { name: 'TMC', color: '#45B5E4', won: 12, leading: 182 },
              { name: 'BJP', color: '#FF6B00', won: 8, leading: 84 },
            ],
          },
        },
      })
    );

    expect(finalized.mode).toBe('final');
    expect(finalized.badgeLabel).toBe('FINAL');
    expect(finalized.states.wb.parties).toEqual([
      { name: 'TMC', color: '#45B5E4', won: 194, leading: 0 },
      { name: 'BJP', color: '#FF6B00', won: 92, leading: 0 },
    ]);
  });

  it('normalizes constituency live coverage and clamps counting progress', () => {
    const data = normalizeElectionResultsData({
      featuredContest: {
        status: 'live',
        backgroundImageUrl: '/elections/datia-bypoll-background-v2.png',
        totalRounds: 15,
        roundsCompleted: 19,
        leadMargin: 1786,
        sourceUrl: 'javascript:alert(1)',
        candidates: [
          {
            id: 'ghanshyam-singh',
            name: 'Ghanshyam Singh',
            party: 'INC',
            votes: '',
          },
        ],
      },
    });

    expect(data.featuredContest.status).toBe('live');
    expect(data.featuredContest.roundsCompleted).toBe(15);
    expect(data.featuredContest.leadMargin).toBe(1786);
    expect(data.featuredContest.candidates[0].votes).toBeNull();
    expect(data.featuredContest.backgroundImageUrl).toBe('/elections/datia-bypoll-background-v2.png');
    expect(data.featuredContest.sourceUrl).toBe('');
  });

  it('rejects protocol-relative election image paths', () => {
    const data = normalizeElectionResultsData({
      featuredContest: { backgroundImageUrl: '//example.com/untrusted.png' },
    });

    expect(data.featuredContest.backgroundImageUrl).toBe('');
  });
});
