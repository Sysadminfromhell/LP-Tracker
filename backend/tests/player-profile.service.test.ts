import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlayerProfile: vi.fn(),
  getPlayerEventHistory: vi.fn(),
  getPlayerEventMatches: vi.fn(),
}));
vi.mock('../src/db/player-history', () => ({
  getPlayerProfile: mocks.getPlayerProfile,
  getPlayerEventHistory: mocks.getPlayerEventHistory,
  getPlayerEventMatches: mocks.getPlayerEventMatches,
}));

import {
  getPublicPlayerEventDetails,
  getPublicPlayerProfile,
} from '../src/services/player-profile.service';

const player = {
  playerId: 7,
  gameName: 'FourK',
  tagLine: 'EUW',
  region: 'EUW',
  profileImageUrl: 'https://example.com/profile.png',
  twitchUsername: 'fourk',
  twitterUsername: null,
};
const latestEvent = {
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
} as const;
const previousEvent = {
  ...latestEvent,
  eventParticipantId: 50,
  eventId: 21,
  eventName: 'August Event',
  startsAt: '2026-08-01T18:00:00.000Z',
  endsAt: '2026-08-05T18:00:00.000Z',
  currentRankScore: 2471,
} as const;

describe('player profile service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlayerEventMatches.mockResolvedValue([]);
  });
  it('returns the latest event separately from previous events', async () => {
    mocks.getPlayerProfile.mockResolvedValue(player);
    mocks.getPlayerEventHistory.mockResolvedValue([
      latestEvent,
      previousEvent,
    ]);
    const result = await getPublicPlayerProfile(7);
    expect(result).toMatchObject({
      player: {
        id: 7,
        gameName: 'FourK',
        tagLine: 'EUW',
      },
      latestEvent: {
        id: 42,
        name: 'September Event',
        lpGain: 113,
        mainRole: 'MID',
      },
      previousEvents: [
        {
          id: 21,
          name: 'August Event',
        },
      ],
    });
  });
  it('returns a player with no attended events', async () => {
    mocks.getPlayerProfile.mockResolvedValue(player);
    mocks.getPlayerEventHistory.mockResolvedValue([]);
    const result = await getPublicPlayerProfile(7);
    expect(result?.latestEvent).toBeNull();
    expect(result?.previousEvents).toEqual([]);
  });
  it('returns null when the player does not exist', async () => {
    mocks.getPlayerProfile.mockResolvedValue(null);
    mocks.getPlayerEventHistory.mockResolvedValue([]);
    await expect(getPublicPlayerProfile(999)).resolves.toBeNull();
  });
  it('returns all stored matches for a player event', async () => {
    mocks.getPlayerEventHistory.mockResolvedValue([latestEvent]);
    mocks.getPlayerEventMatches.mockResolvedValue([
      {
        providerMatchId: 'EUW1_123',
        gameCreatedAt: '2026-09-04T20:00:00.000Z',
        durationSeconds: 1800,
        championId: 103,
        champion: 'Ahri',
        position: 'MID',
        kills: 8,
        deaths: 2,
        assists: 11,
        cs: 220,
        result: 'WIN',
        lpDelta: 24,
        lpDeltaStatus: 'resolved',
        items: ['6655', '3020', '3089'],
      },
    ]);
    const result = await getPublicPlayerEventDetails(7, 42);
    expect(mocks.getPlayerEventMatches).toHaveBeenCalledWith(100);
    expect(result?.matches).toEqual([
      {
        id: 'EUW1_123',
        createdAt: '2026-09-04T20:00:00.000Z',
        durationSeconds: 1800,
        championId: 103,
        champion: 'Ahri',
        position: 'MID',
        kills: 8,
        deaths: 2,
        assists: 11,
        cs: 220,
        result: 'WIN',
        lpDelta: 24,
        lpDeltaStatus: 'resolved',
        items: ['6655', '3020', '3089'],
      },
    ]);
  });
  it('returns null when the player did not attend the event', async () => {
    mocks.getPlayerEventHistory.mockResolvedValue([]);
    await expect(
      getPublicPlayerEventDetails(7, 999),
    ).resolves.toBeNull();
    expect(mocks.getPlayerEventMatches).not.toHaveBeenCalled();
  });
});