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
  getEndedEventHistory,
  getEndedEventHistoryEvent,
  getEndedEventHistoryStandings,
} from '../src/db/event-history';

describe('event history database queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns ended events newest first', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          id: '42',
          name: 'September Event',
          starts_at: new Date('2026-09-01T18:00:00.000Z'),
          ends_at: new Date('2026-09-05T18:00:00.000Z'),
          participant_count: '8',
        },
      ],
    });
    const result = await getEndedEventHistory();
    const [sql] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("WHERE e.status = 'ended'");
    expect(String(sql)).toContain('e.starts_at DESC');
    expect(result).toEqual([
      {
        id: 42,
        name: 'September Event',
        startsAt: '2026-09-01T18:00:00.000Z',
        endsAt: '2026-09-05T18:00:00.000Z',
        participantCount: 8,
      },
    ]);
  });
  it('returns one ended event by id', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          id: '42',
          name: 'September Event',
          starts_at: new Date('2026-09-01T18:00:00.000Z'),
          ends_at: new Date('2026-09-05T18:00:00.000Z'),
          participant_count: '8',
        },
      ],
    });
    const result = await getEndedEventHistoryEvent(42);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("AND e.status = 'ended'"),
      [42],
    );
    expect(result?.id).toBe(42);
  });
  it('returns null when the ended event does not exist', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
    });
    await expect(getEndedEventHistoryEvent(999)).resolves.toBeNull();
  });
  it('rejects incomplete historical event dates', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          id: '42',
          name: 'Broken Event',
          starts_at: new Date('2026-09-01T18:00:00.000Z'),
          ends_at: null,
          participant_count: '8',
        },
      ],
    });
    await expect(getEndedEventHistory()).rejects.toThrow('EVENT_HISTORY_DATES_INCOMPLETE:42');
  });
  it('returns historical standings from stored event snapshots', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          player_id: '7',
          game_name: 'FourK',
          tag_line: 'EUW',
          region: 'EUW',
          profile_image_url: 'https://example.com/profile.png',
          twitch_username: 'fourk',
          twitter_username: null,
          start_tier: 'EMERALD',
          start_division: 1,
          start_lp: 21,
          start_rank_score: 2421,
          end_tier: 'DIAMOND',
          end_division: 4,
          end_lp: 34,
          end_rank_score: 2534,
          lp_penalty: 10,
          penalty_reason: 'Manual penalty',
          games: '12',
          wins: '8',
          losses: '4',
        },
      ],
    });
    const result = await getEndedEventHistoryStandings(42);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("AND e.status = 'ended'");
    expect(String(sql)).toContain('ep.end_rank_score');
    expect(params).toEqual([42]);
    expect(result).toEqual([
      {
        playerId: 7,
        gameName: 'FourK',
        tagLine: 'EUW',
        region: 'EUW',
        profileImageUrl: 'https://example.com/profile.png',
        twitchUsername: 'fourk',
        twitterUsername: null,
        startTier: 'EMERALD',
        startDivision: 1,
        startLp: 21,
        startRankScore: 2421,
        finalTier: 'DIAMOND',
        finalDivision: 4,
        finalLp: 34,
        finalRankScore: 2534,
        lpPenalty: 10,
        penaltyReason: 'Manual penalty',
        games: 12,
        wins: 8,
        losses: 4,
      },
    ]);
  });
});
