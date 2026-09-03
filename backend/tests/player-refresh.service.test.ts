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
  lpHistory: [],
};

function mockProvider(
  getSummonerProfile: LeagueDataProvider['getSummonerProfile'],
  getRecentMatches: LeagueDataProvider['getRecentMatches'],
  name = 'test',
): void {
  mocks.getLeagueDataProvider.mockResolvedValue({
    name,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getSummonerProfile,
    getRecentMatches,
  } satisfies LeagueDataProvider);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markPlayerFetchAttempt.mockResolvedValue(undefined);
  mocks.savePlayerCacheError.mockResolvedValue(undefined);
  mocks.savePlayerCacheSuccess.mockResolvedValue(undefined);
  mocks.getActiveEvent.mockResolvedValue(null);
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
});
