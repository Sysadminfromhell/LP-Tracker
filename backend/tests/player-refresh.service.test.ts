import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../src/db/players';
import type { LeagueDataProvider } from '../src/providers/league-data.provider';
import type { SummonerProfile } from '../src/providers/league-data.types';

const mocks = vi.hoisted(() => ({
  markPlayerFetchAttempt: vi.fn(),
  savePlayerCacheError: vi.fn(),
  savePlayerCacheSuccess: vi.fn(),
  getActiveEvent: vi.fn(),
  getEventParticipant: vi.fn(),
  getLatestEventMatchCursor: vi.fn(),
  updateEventAfterPlayerRefresh: vi.fn(),
  getLeagueDataProvider: vi.fn(),
  getLeaderboardPlayer: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  refreshLeaderboardPlayer: vi.fn(),
  setLeaderboardPlayerError: vi.fn(),
}));
vi.mock('../src/db/player-cache', () => ({
  markPlayerFetchAttempt: mocks.markPlayerFetchAttempt,
  savePlayerCacheError: mocks.savePlayerCacheError,
  savePlayerCacheSuccess: mocks.savePlayerCacheSuccess,
}));
vi.mock('../src/db/events', () => ({
  getActiveEvent: mocks.getActiveEvent,
  getEventParticipant: mocks.getEventParticipant,
  getLatestEventMatchCursor: mocks.getLatestEventMatchCursor,
}));
vi.mock('../src/db/event-refresh', () => ({
  updateEventAfterPlayerRefresh: mocks.updateEventAfterPlayerRefresh,
}));
vi.mock('../src/services/league-data.service', () => ({
  getLeagueDataProvider: mocks.getLeagueDataProvider,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  getLeaderboardPlayer: mocks.getLeaderboardPlayer,
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
  refreshLeaderboardPlayer: mocks.refreshLeaderboardPlayer,
  setLeaderboardPlayerError: mocks.setLeaderboardPlayerError,
}));

import { refreshPlayer } from '../src/services/player-refresh.service';

const player: Player = {
  id: 1,
  gameName: 'TestPlayer',
  tagLine: 'EUW',
  region: 'EUW',
  twitchUsername: null,
  twitterUsername: null,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const profile: SummonerProfile = {
  gameName: player.gameName,
  tagLine: player.tagLine,
  profileImageUrl: '',
  queues: [
    {
      gameType: 'SOLORANKED',
      tier: 'GOLD',
      division: 2,
      lp: 50,
      wins: 10,
      losses: 8,
    },
  ],
  lpHistory: [
    {
      createdAt: '2026-09-02T18:35:00.000Z',
      tier: 'GOLD',
      division: 2,
      lp: 50,
    },
  ],
};

function mockProvider(
  getSummonerProfile: LeagueDataProvider['getSummonerProfile'],
  getRecentMatches: LeagueDataProvider['getRecentMatches'],
  name = 'test',
  maxRecentMatches = 100,
): void {
  mocks.getLeagueDataProvider.mockResolvedValue({
    name,
    maxRecentMatches,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getSummonerProfile,
    getRecentMatches,
  } satisfies LeagueDataProvider);
}
function mockActiveEventParticipant(): void {
  mocks.getActiveEvent.mockResolvedValue({
    id: 10,
    name: 'Test Event',
    startsAt: '2026-09-01T18:00:00.000Z',
    endsAt: '2026-09-03T18:00:00.000Z',
    status: 'active',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  });

  mocks.getEventParticipant.mockResolvedValue({
    id: 100,
    eventId: 10,
    playerId: player.id,
    snapshotCapturedAt: '2026-09-01T18:00:00.000Z',
  });

  mocks.getLatestEventMatchCursor.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markPlayerFetchAttempt.mockResolvedValue(undefined);
  mocks.savePlayerCacheError.mockResolvedValue(undefined);
  mocks.savePlayerCacheSuccess.mockResolvedValue(undefined);
  mocks.getActiveEvent.mockResolvedValue(null);
  mocks.getLatestEventMatchCursor.mockResolvedValue(null);
  mocks.loadLeaderboardFromDatabase.mockResolvedValue(undefined);
  mocks.refreshLeaderboardPlayer.mockResolvedValue(undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('refreshPlayer provider reliability', () => {
  it('passes LP history to the event refresh', async () => {
    const recentMatches = [
      {
        id: 'match-1',
        createdAt: '2026-09-02T18:00:00.000Z',
        gameType: 'SOLORANKED',
        durationSeconds: 1800,
        championId: 266,
        champion: 'Aatrox',
        position: 'TOP',
        items: [],
        damageToChampions: 20000,
        kills: 5,
        deaths: 3,
        assists: 7,
        laneCs: 180,
        jungleCs: 0,
        cs: 180,
        result: 'WIN' as const,
      },
    ];
    const getRecentMatches = vi.fn().mockResolvedValue(recentMatches);
    mockProvider(vi.fn().mockResolvedValue(profile), getRecentMatches);
    mocks.getActiveEvent.mockResolvedValue({
      id: 10,
      name: 'Test Event',
      startsAt: '2026-09-01T18:00:00.000Z',
      endsAt: '2026-09-03T18:00:00.000Z',
      status: 'active',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    mocks.getEventParticipant.mockResolvedValue({
      id: 100,
      eventId: 10,
      playerId: player.id,
      snapshotCapturedAt: '2026-09-01T18:00:00.000Z',
    });
    mocks.getLatestEventMatchCursor.mockResolvedValue({
      providerMatchId: 'match-1',
      gameCreatedAt: '2026-09-02T18:00:00.000Z',
    });
    mocks.updateEventAfterPlayerRefresh.mockResolvedValue({
      newMatches: 1,
      resolvedMatches: 1,
      unknownMatches: 0,
    });
    mocks.getLeaderboardPlayer.mockReturnValue(null);
    const result = await refreshPlayer(player);
    expect(result).toBe(true);
    expect(getRecentMatches).toHaveBeenCalledTimes(1);
    expect(getRecentMatches).toHaveBeenCalledWith(
      player.gameName,
      player.tagLine,
      player.region,
      5,
    );
    expect(mocks.updateEventAfterPlayerRefresh).toHaveBeenCalledWith(
      100,
      '2026-09-01T18:00:00.000Z',
      '2026-09-03T18:00:00.000Z',
      recentMatches,
      1450,
      profile.lpHistory,
    );
  });
  it('fails cleanly when the profile request times out', async () => {
    vi.useFakeTimers();
    mockProvider(() => new Promise(() => {}), vi.fn());
    const result = refreshPlayer(player);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(result).resolves.toBe(false);
    expect(mocks.savePlayerCacheError).toHaveBeenCalledWith(
      player.id,
      'Provider profile request timed out after 15000ms',
    );
    expect(mocks.setLeaderboardPlayerError).toHaveBeenCalledWith(
      player.id,
      'Provider profile request timed out after 15000ms',
    );
  });
  it('fails cleanly when the match request times out', async () => {
    vi.useFakeTimers();
    mockActiveEventParticipant();
    mockProvider(vi.fn().mockResolvedValue(profile), () => new Promise(() => {}));
    const result = refreshPlayer(player);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(result).resolves.toBe(false);
    expect(mocks.savePlayerCacheError).toHaveBeenCalledWith(
      player.id,
      'Provider match request timed out after 15000ms',
    );
    expect(mocks.setLeaderboardPlayerError).toHaveBeenCalledWith(
      player.id,
      'Provider match request timed out after 15000ms',
    );
  });
  it('allows longer match requests for the Riot provider', async () => {
    vi.useFakeTimers();
    mockActiveEventParticipant();
    mockProvider(vi.fn().mockResolvedValue(profile), () => new Promise(() => {}), 'riot');
    const result = refreshPlayer(player);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(result).resolves.toBe(false);
    expect(mocks.savePlayerCacheError).toHaveBeenCalledWith(
      player.id,
      'Provider match request timed out after 120000ms',
    );
    expect(mocks.setLeaderboardPlayerError).toHaveBeenCalledWith(
      player.id,
      'Provider match request timed out after 120000ms',
    );
  });
  it('does not request match history when no event is active', async () => {
    const getRecentMatches = vi.fn();
    mockProvider(vi.fn().mockResolvedValue(profile), getRecentMatches);
    mocks.getActiveEvent.mockResolvedValue(null);
    mocks.getLeaderboardPlayer.mockReturnValue(null);
    const result = await refreshPlayer(player);
    expect(result).toBe(true);
    expect(getRecentMatches).not.toHaveBeenCalled();
    expect(mocks.getEventParticipant).not.toHaveBeenCalled();
    expect(mocks.getLatestEventMatchCursor).not.toHaveBeenCalled();
    expect(mocks.updateEventAfterPlayerRefresh).not.toHaveBeenCalled();
    expect(mocks.savePlayerCacheSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
  });
  it('expands the match backfill until the stored cursor is reached', async () => {
    const firstBatch = [
      {
        id: 'match-3',
        createdAt: '2026-09-08T20:00:00.000Z',
        gameType: 'SOLORANKED' as const,
        durationSeconds: 1800,
        championId: 266,
        champion: 'Aatrox',
        position: 'TOP',
        items: [],
        damageToChampions: 20000,
        kills: 5,
        deaths: 3,
        assists: 7,
        laneCs: 180,
        jungleCs: 0,
        cs: 180,
        result: 'WIN' as const,
      },
      {
        id: 'match-2',
        createdAt: '2026-09-08T19:30:00.000Z',
        gameType: 'SOLORANKED' as const,
        durationSeconds: 1800,
        championId: 266,
        champion: 'Aatrox',
        position: 'TOP',
        items: [],
        damageToChampions: 20000,
        kills: 5,
        deaths: 3,
        assists: 7,
        laneCs: 180,
        jungleCs: 0,
        cs: 180,
        result: 'WIN' as const,
      },
    ];
    const secondBatch = [
      ...firstBatch,
      {
        id: 'match-1',
        createdAt: '2026-09-08T18:00:00.000Z',
        gameType: 'SOLORANKED' as const,
        durationSeconds: 1800,
        championId: 266,
        champion: 'Aatrox',
        position: 'TOP',
        items: [],
        damageToChampions: 20000,
        kills: 5,
        deaths: 3,
        assists: 7,
        laneCs: 180,
        jungleCs: 0,
        cs: 180,
        result: 'WIN' as const,
      },
    ];
    const getRecentMatches = vi.fn(
      async (_gameName: string, _tagLine: string, _region: string, limit: number = 20) => {
        if (limit === 5) {
          return firstBatch;
        }
        return secondBatch;
      },
    );
    mockActiveEventParticipant();
    mocks.getLatestEventMatchCursor.mockResolvedValue({
      providerMatchId: 'match-1',
      gameCreatedAt: '2026-09-08T18:00:00.000Z',
    });
    mocks.updateEventAfterPlayerRefresh.mockResolvedValue({
      newMatches: 2,
      resolvedMatches: 2,
      unknownMatches: 0,
    });
    mocks.getLeaderboardPlayer.mockReturnValue(null);
    mockProvider(vi.fn().mockResolvedValue(profile), getRecentMatches);
    const result = await refreshPlayer(player);
    expect(result).toBe(true);
    expect(getRecentMatches.mock.calls).toEqual([
      [player.gameName, player.tagLine, player.region, 5],
      [player.gameName, player.tagLine, player.region, 20],
    ]);
    expect(mocks.updateEventAfterPlayerRefresh).toHaveBeenCalledWith(
      100,
      '2026-09-01T18:00:00.000Z',
      '2026-09-03T18:00:00.000Z',
      secondBatch,
      1450,
      profile.lpHistory,
    );
  });
  it('fails without updating event data when the backfill anchor cannot be reached', async () => {
    const getRecentMatches = vi.fn(
      async (_gameName: string, _tagLine: string, _region: string, limit: number = 20) =>
        Array.from({ length: limit }, (_, index) => ({
          id: `match-${index}`,
          createdAt: '2026-09-08T20:00:00.000Z',
          gameType: 'SOLORANKED' as const,
          durationSeconds: 1800,
          championId: 266,
          champion: 'Aatrox',
          position: 'TOP',
          items: [],
          damageToChampions: 20000,
          kills: 5,
          deaths: 3,
          assists: 7,
          laneCs: 180,
          jungleCs: 0,
          cs: 180,
          result: 'WIN' as const,
        })),
    );
    mockActiveEventParticipant();
    mocks.getLatestEventMatchCursor.mockResolvedValue({
      providerMatchId: 'old-match',
      gameCreatedAt: '2026-09-01T19:00:00.000Z',
    });
    mockProvider(vi.fn().mockResolvedValue(profile), getRecentMatches, 'opgg', 20);
    const result = await refreshPlayer(player);
    expect(result).toBe(false);
    expect(getRecentMatches.mock.calls).toEqual([
      [player.gameName, player.tagLine, player.region, 5],
      [player.gameName, player.tagLine, player.region, 20],
    ]);
    expect(mocks.updateEventAfterPlayerRefresh).not.toHaveBeenCalled();
    expect(mocks.savePlayerCacheError).toHaveBeenCalledWith(
      player.id,
      'Match backfill limit reached before sync anchor (20 matches)',
    );
  });
});
