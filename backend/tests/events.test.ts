import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import {
  getEventMatches,
  getLatestEventMatchCursor,
  getRecentEventMatches,
} from '../src/db/events';

describe('event database queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns the latest event match as sync cursor', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          provider_match_id: 'EUW1_123456789',
          game_created_at: new Date('2026-09-08T18:30:00.000Z'),
        },
      ],
    });
    const result = await getLatestEventMatchCursor(42);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('is_sync_anchor = TRUE'),
      [42],
    );
    expect(result).toEqual({
      providerMatchId: 'EUW1_123456789',
      gameCreatedAt: '2026-09-08T18:30:00.000Z',
    });
  });
  it('returns null when the participant has no stored matches', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
    });
    const result = await getLatestEventMatchCursor(42);
    expect(result).toBeNull();
  });
  it('returns event matches with permanent duration', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          id: '101',
          event_participant_id: '42',
          provider_match_id: 'EUW1_123456789',
          game_created_at: new Date('2026-09-08T18:30:00.000Z'),
          duration_seconds: 1800,
          champion_id: 266,
          champion: 'Aatrox',
          position: 'TOP',
          kills: 5,
          deaths: 3,
          assists: 7,
          cs: 180,
          result: 'WIN',
          lp_delta: 20,
          lp_delta_status: 'resolved',
          discovered_at: new Date('2026-09-08T19:00:00.000Z'),
          updated_at: new Date('2026-09-08T19:00:00.000Z'),
        },
      ],
    });
    const result = await getEventMatches(42);
    expect(result[0]?.durationSeconds).toBe(1800);
    const sql = String(mocks.query.mock.calls[0]?.[0]);
    expect(sql).toContain('duration_seconds');
  });
  it('returns recent event matches with permanent duration', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          id: '101',
          event_participant_id: '42',
          provider_match_id: 'EUW1_123456789',
          game_created_at: new Date('2026-09-08T18:30:00.000Z'),
          duration_seconds: 1800,
          champion_id: 266,
          champion: 'Aatrox',
          position: 'TOP',
          kills: 5,
          deaths: 3,
          assists: 7,
          cs: 180,
          result: 'WIN',
          lp_delta: 20,
          lp_delta_status: 'resolved',
          discovered_at: new Date('2026-09-08T19:00:00.000Z'),
          updated_at: new Date('2026-09-08T19:00:00.000Z'),
        },
      ],
    });
    const result = await getRecentEventMatches(42, 3);
    expect(result[0]?.durationSeconds).toBe(1800);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain('duration_seconds');
    expect(params).toEqual([42, 3]);
  });
});
