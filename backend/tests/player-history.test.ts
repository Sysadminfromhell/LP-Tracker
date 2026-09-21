import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import { getPlayerEventHistory, getPlayerProfile } from '../src/db/player-history';

describe('player history database queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns a public player profile', async () => {
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
        },
      ],
    });
    const result = await getPlayerProfile(7);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('FROM players p'), [7]);
    expect(result).toEqual({
      playerId: 7,
      gameName: 'FourK',
      tagLine: 'EUW',
      region: 'EUW',
      profileImageUrl: 'https://example.com/profile.png',
      twitchUsername: 'fourk',
      twitterUsername: null,
    });
  });
  it('returns null for an unknown player', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
    });
    await expect(getPlayerProfile(999)).resolves.toBeNull();
  });
  it('returns event history ordered by newest event and maps snapshots', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          event_participant_id: '100',
          event_id: '42',
          event_name: 'September Event',
          event_status: 'ended',
          starts_at: new Date('2026-09-01T18:00:00.000Z'),
          ends_at: new Date('2026-09-05T18:00:00.000Z'),
          start_tier: 'EMERALD',
          start_division: 1,
          start_lp: 21,
          start_rank_score: 2421,
          current_tier: 'DIAMOND',
          current_division: 4,
          current_lp: 34,
          current_rank_score: 2534,
          lp_penalty: 0,
          penalty_reason: null,
          games: '12',
          wins: '8',
          losses: '4',
          main_role: 'MID',
          last_updated: new Date('2026-09-05T18:00:00.000Z'),
        },
      ],
    });
    const result = await getPlayerEventHistory(7);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("e.status IN ('active', 'ended')");
    expect(String(sql)).toContain('ORDER BY');
    expect(String(sql)).toContain('e.starts_at DESC');
    expect(String(sql)).toContain("WHEN 'MIDDLE' THEN 'MID'");
    expect(params).toEqual([7, null]);
    expect(result).toEqual([
      {
        eventParticipantId: 100,
        eventId: 42,
        eventName: 'September Event',
        eventStatus: 'ended',
        startsAt: '2026-09-01T18:00:00.000Z',
        endsAt: '2026-09-05T18:00:00.000Z',
        startTier: 'EMERALD',
        startDivision: 1,
        startLp: 21,
        startRankScore: 2421,
        currentTier: 'DIAMOND',
        currentDivision: 4,
        currentLp: 34,
        currentRankScore: 2534,
        lpPenalty: 0,
        penaltyReason: null,
        games: 12,
        wins: 8,
        losses: 4,
        mainRole: 'MID',
        lastUpdated: '2026-09-05T18:00:00.000Z',
      },
    ]);
  });
  it('filters history by event id when requested', async () => {
    mocks.query.mockResolvedValue({
      rows: [],
    });
    await getPlayerEventHistory(7, 42);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('($2::BIGINT IS NULL OR e.id = $2)'),
      [7, 42],
    );
  });
});
