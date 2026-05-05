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
});
