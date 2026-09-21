import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEndedEventHistory: vi.fn(),
  getEndedEventHistoryEvent: vi.fn(),
  getEndedEventHistoryStandings: vi.fn(),
}));

vi.mock('../src/db/event-history', () => ({
  getEndedEventHistory: mocks.getEndedEventHistory,
  getEndedEventHistoryEvent: mocks.getEndedEventHistoryEvent,
  getEndedEventHistoryStandings: mocks.getEndedEventHistoryStandings,
}));

import {
  getPublicEventHistory,
  getPublicEventHistoryDetails,
} from '../src/services/event-history.service';

const event = {
  id: 42,
  name: 'September Event',
  startsAt: '2026-09-01T18:00:00.000Z',
  endsAt: '2026-09-05T18:00:00.000Z',
  participantCount: 3,
};

function createStanding(
  overrides: Partial<{
    playerId: number;
    gameName: string;
    tagLine: string;
    region: string;
    profileImageUrl: string | null;
    twitchUsername: string | null;
    twitterUsername: string | null;
    startTier: string;
    startDivision: number | null;
    startLp: number;
    startRankScore: number;
    finalTier: string | null;
    finalDivision: number | null;
    finalLp: number | null;
    finalRankScore: number | null;
    lpPenalty: number;
    penaltyReason: string | null;
    games: number;
    wins: number;
    losses: number;
  }> = {},
) {
  return {
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
    lpPenalty: 0,
    penaltyReason: null,
    games: 12,
    wins: 8,
    losses: 4,
    ...overrides,
  };
}

describe('event history service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns public ended event history', async () => {
    mocks.getEndedEventHistory.mockResolvedValue([event]);
    await expect(getPublicEventHistory()).resolves.toEqual({
      events: [event],
    });
  });
  it('returns null when the event is not part of public history', async () => {
    mocks.getEndedEventHistoryEvent.mockResolvedValue(null);
    await expect(getPublicEventHistoryDetails(999)).resolves.toBeNull();
    expect(mocks.getEndedEventHistoryStandings).not.toHaveBeenCalled();
  });
  it('maps and sorts standings by LP gain', async () => {
    mocks.getEndedEventHistoryEvent.mockResolvedValue(event);
    mocks.getEndedEventHistoryStandings.mockResolvedValue([
      createStanding({
        playerId: 1,
        gameName: 'Alpha',
        finalRankScore: 2521,
      }),
      createStanding({
        playerId: 2,
        gameName: 'Bravo',
        finalRankScore: 2571,
      }),
    ]);
    const result = await getPublicEventHistoryDetails(42);
    expect(result?.standings.map((standing) => standing.player.id)).toEqual([2, 1]);
  });
  it('uses final rank score as the secondary sort order', async () => {
    mocks.getEndedEventHistoryEvent.mockResolvedValue(event);
    mocks.getEndedEventHistoryStandings.mockResolvedValue([
      createStanding({
        playerId: 1,
        gameName: 'Alpha',
        startRankScore: 2400,
        finalRankScore: 2500,
      }),
      createStanding({
        playerId: 2,
        gameName: 'Bravo',
        startRankScore: 2450,
        finalRankScore: 2550,
      }),
    ]);
    const result = await getPublicEventHistoryDetails(42);
    expect(result?.standings.map((standing) => standing.player.id)).toEqual([2, 1]);
  });
  it('uses player name as the final stable sort order', async () => {
    mocks.getEndedEventHistoryEvent.mockResolvedValue(event);
    mocks.getEndedEventHistoryStandings.mockResolvedValue([
      createStanding({
        playerId: 2,
        gameName: 'Bravo',
        startRankScore: 2400,
        finalRankScore: 2500,
      }),
      createStanding({
        playerId: 1,
        gameName: 'Alpha',
        startRankScore: 2400,
        finalRankScore: 2500,
      }),
    ]);
    const result = await getPublicEventHistoryDetails(42);
    expect(result?.standings.map((standing) => standing.player.gameName)).toEqual([
      'Alpha',
      'Bravo',
    ]);
  });
  it('subtracts penalties from LP gain', async () => {
    mocks.getEndedEventHistoryEvent.mockResolvedValue(event);
    mocks.getEndedEventHistoryStandings.mockResolvedValue([
      createStanding({
        startRankScore: 2400,
        finalRankScore: 2525,
        lpPenalty: 25,
        penaltyReason: 'Manual penalty',
      }),
    ]);
    const result = await getPublicEventHistoryDetails(42);
    expect(result?.standings[0]).toMatchObject({
      lpGain: 100,
      penalty: {
        lp: 25,
        reason: 'Manual penalty',
      },
    });
  });
  it('allows final ranks without divisions', async () => {
    mocks.getEndedEventHistoryEvent.mockResolvedValue(event);
    mocks.getEndedEventHistoryStandings.mockResolvedValue([
      createStanding({
        finalTier: 'MASTER',
        finalDivision: null,
        finalLp: 125,
        finalRankScore: 3225,
      }),
    ]);
    const result = await getPublicEventHistoryDetails(42);
    expect(result?.standings[0].final).toEqual({
      tier: 'MASTER',
      division: null,
      lp: 125,
      score: 3225,
    });
  });
  it('rejects incomplete final event snapshots', async () => {
    mocks.getEndedEventHistoryEvent.mockResolvedValue(event);
    mocks.getEndedEventHistoryStandings.mockResolvedValue([
      createStanding({
        playerId: 7,
        finalRankScore: null,
      }),
    ]);
    await expect(getPublicEventHistoryDetails(42)).rejects.toThrow(
      'EVENT_HISTORY_SNAPSHOT_INCOMPLETE:42:7',
    );
  });
});
