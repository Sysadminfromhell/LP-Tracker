import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbEvent, DbEventMatch, DbEventMatchStats } from '../src/db/events';
import type { EventLeaderboardDbPlayer } from '../src/db/event-leaderboard';

const mocks = vi.hoisted(() => ({
  getDisplayEvent: vi.fn(),
  getEventMatchStats: vi.fn(),
  getRecentEventMatches: vi.fn(),
  getEventLeaderboardPlayer: vi.fn(),
  getEventLeaderboardPlayers: vi.fn(),
  broadcastLiveUpdate: vi.fn(),
}));

vi.mock('../src/db/events', () => ({
  getDisplayEvent: mocks.getDisplayEvent,
  getEventMatchStats: mocks.getEventMatchStats,
  getRecentEventMatches: mocks.getRecentEventMatches,
}));
vi.mock('../src/db/event-leaderboard', () => ({
  getEventLeaderboardPlayer: mocks.getEventLeaderboardPlayer,
  getEventLeaderboardPlayers: mocks.getEventLeaderboardPlayers,
}));
vi.mock('../src/services/live-update.service', () => ({
  broadcastLiveUpdate: mocks.broadcastLiveUpdate,
}));

import {
  getLeaderboard,
  getLeaderboardHighlights,
  getLeaderboardMeta,
  getLeaderboardPlayer,
  loadLeaderboardFromDatabase,
  refreshLeaderboardPlayer,
  setLeaderboardPlayerError,
} from '../src/services/leaderboard.service';

const event: DbEvent = {
  id: 1,
  name: 'Test Event',
  startsAt: '2026-09-01T18:00:00.000Z',
  endsAt: '2026-09-03T18:00:00.000Z',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T18:00:00.000Z',
};

function createRow(overrides: Partial<EventLeaderboardDbPlayer> = {}): EventLeaderboardDbPlayer {
  return {
    playerId: 1,
    gameName: 'Alpha',
    tagLine: 'EUW',
    region: 'EUW',
    twitchUsername: null,
    twitterUsername: null,
    profileImageUrl: 'https://example.com/profile.png',
    eventId: event.id,
    eventName: event.name,
    eventStatus: 'active',
    eventStartsAt: event.startsAt!,
    eventEndsAt: event.endsAt,
    eventParticipantId: 101,
    startTier: 'GOLD',
    startDivision: 2,
    startLp: 0,
    startRankScore: 1400,
    startWins: 10,
    startLosses: 10,
    currentTier: 'GOLD',
    currentDivision: 1,
    currentLp: 0,
    currentRankScore: 1500,
    currentWins: 12,
    currentLosses: 11,
    lastUpdated: '2026-09-02T20:00:00.000Z',
    lastError: null,
    ...overrides,
  };
}
function createMatch(overrides: Partial<DbEventMatch> = {}): DbEventMatch {
  return {
    id: 1,
    eventParticipantId: 101,
    providerMatchId: 'match-1',
    gameCreatedAt: '2026-09-02T19:00:00.000Z',
    championId: 266,
    champion: 'Aatrox',
    position: 'TOP',
    kills: 8,
    deaths: 3,
    assists: 6,
    cs: 202,
    result: 'WIN',
    lpDelta: 24,
    lpDeltaStatus: 'resolved',
    discoveredAt: '2026-09-02T19:30:00.000Z',
    updatedAt: '2026-09-02T19:30:00.000Z',
    ...overrides,
  };
}
function createStats(overrides: Partial<DbEventMatchStats> = {}): DbEventMatchStats {
  return {
    games: 1,
    kills: 8,
    deaths: 3,
    assists: 6,
    longestWinStreak: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.getDisplayEvent.mockResolvedValue(null);
  mocks.getEventLeaderboardPlayers.mockResolvedValue([]);
  mocks.getEventLeaderboardPlayer.mockResolvedValue(null);
  mocks.getEventMatchStats.mockResolvedValue(createStats());
  mocks.getRecentEventMatches.mockResolvedValue([]);
  await loadLeaderboardFromDatabase();
  vi.clearAllMocks();
});
describe('leaderboard service', () => {
  it('sorts the leaderboard by LP gain, score and player name', async () => {
    const delta = createRow({
      playerId: 4,
      gameName: 'Delta',
      eventParticipantId: 104,
      startRankScore: 1200,
      currentRankScore: 1500,
    });
    const charlie = createRow({
      playerId: 3,
      gameName: 'Charlie',
      eventParticipantId: 103,
      startRankScore: 1000,
      currentRankScore: 1200,
    });
    const bravo = createRow({
      playerId: 2,
      gameName: 'Bravo',
      eventParticipantId: 102,
      startRankScore: 900,
      currentRankScore: 1100,
    });
    const alpha = createRow({
      playerId: 1,
      gameName: 'Alpha',
      eventParticipantId: 101,
      startRankScore: 900,
      currentRankScore: 1100,
    });
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([alpha, bravo, charlie, delta]);
    await loadLeaderboardFromDatabase();
    expect(getLeaderboard().map((player) => player.player.gameName)).toEqual([
      'Delta',
      'Charlie',
      'Alpha',
      'Bravo',
    ]);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith('leaderboard');
  });
  it('builds leaderboard players from DB data and recent matches', async () => {
    const row = createRow();
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([row]);
    mocks.getEventMatchStats.mockResolvedValue(
      createStats({
        games: 3,
        kills: 20,
        deaths: 5,
        assists: 10,
        longestWinStreak: 2,
      }),
    );
    mocks.getRecentEventMatches.mockResolvedValue([createMatch()]);
    await loadLeaderboardFromDatabase();
    const player = getLeaderboardPlayer(row.playerId);
    expect(player).toMatchObject({
      player: {
        id: 1,
        gameName: 'Alpha',
        tagLine: 'EUW',
        region: 'EUW',
      },
      start: {
        score: 1400,
      },
      current: {
        score: 1500,
      },
      lpGain: 100,
      record: {
        wins: 2,
        losses: 1,
        games: 3,
      },
      recentMatches: [
        {
          id: 'match-1',
          champion: 'Aatrox',
          kills: 8,
          deaths: 3,
          assists: 6,
          lpDelta: 24,
          lpDeltaStatus: 'resolved',
        },
      ],
    });
  });
  it('calculates leaderboard highlights', async () => {
    const alpha = createRow({
      playerId: 1,
      gameName: 'Alpha',
      eventParticipantId: 101,
      startWins: 10,
      currentWins: 13,
    });
    const bravo = createRow({
      playerId: 2,
      gameName: 'Bravo',
      eventParticipantId: 102,
      startWins: 10,
      currentWins: 15,
    });
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([alpha, bravo]);
    mocks.getEventMatchStats.mockImplementation(
      async (eventParticipantId: number): Promise<DbEventMatchStats> => {
        if (eventParticipantId === 101) {
          return createStats({
            games: 3,
            kills: 20,
            deaths: 4,
            assists: 12,
            longestWinStreak: 4,
          });
        }
        return createStats({
          games: 5,
          kills: 15,
          deaths: 10,
          assists: 10,
          longestWinStreak: 2,
        });
      },
    );
    await loadLeaderboardFromDatabase();
    const highlights = getLeaderboardHighlights();
    expect(highlights.longestWinStreak).toMatchObject({
      player: {
        id: 1,
        gameName: 'Alpha',
      },
      value: 4,
    });
    expect(highlights.bestKda).toMatchObject({
      player: {
        id: 1,
        gameName: 'Alpha',
      },
      value: 8,
    });
    expect(highlights.mostWins).toMatchObject({
      player: {
        id: 2,
        gameName: 'Bravo',
      },
      value: 5,
    });
  });
  it('broadcasts a lightweight player refresh event when leaderboard data is unchanged', async () => {
    const row = createRow();
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([row]);
    await loadLeaderboardFromDatabase();
    vi.clearAllMocks();
    const refreshedRow = createRow({
      lastUpdated: '2026-09-02T20:05:00.000Z',
    });
    mocks.getEventLeaderboardPlayer.mockResolvedValue(refreshedRow);
    mocks.getEventMatchStats.mockResolvedValue(createStats());
    mocks.getRecentEventMatches.mockResolvedValue([]);
    await refreshLeaderboardPlayer(event.id, row.playerId);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith('player-refreshed', {
      playerId: row.playerId,
      lastUpdated: refreshedRow.lastUpdated,
    });
  });
  it('updates rank movement when an incremental refresh changes positions', async () => {
    const alpha = createRow({
      playerId: 1,
      gameName: 'Alpha',
      eventParticipantId: 101,
      startRankScore: 1000,
      currentRankScore: 1200,
    });
    const bravo = createRow({
      playerId: 2,
      gameName: 'Bravo',
      eventParticipantId: 102,
      startRankScore: 1000,
      currentRankScore: 1100,
    });
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([alpha, bravo]);
    await loadLeaderboardFromDatabase();
    expect(getLeaderboard().map((player) => player.player.id)).toEqual([1, 2]);
    vi.clearAllMocks();
    const updatedBravo = {
      ...bravo,
      currentRankScore: 1300,
      currentLp: 100,
    };
    mocks.getEventLeaderboardPlayer.mockResolvedValue(updatedBravo);
    mocks.getEventMatchStats.mockResolvedValue(createStats());
    mocks.getRecentEventMatches.mockResolvedValue([]);
    await refreshLeaderboardPlayer(event.id, bravo.playerId);
    const leaderboard = getLeaderboard();
    expect(leaderboard.map((player) => player.player.id)).toEqual([2, 1]);
    expect(getLeaderboardPlayer(2)?.rankMovement.delta).toBe(1);
    expect(getLeaderboardPlayer(1)?.rankMovement.delta).toBe(-1);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith('leaderboard');
  });
  it('falls back to a full reload for an uncached player', async () => {
    const row = createRow();
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([row]);
    await loadLeaderboardFromDatabase();
    vi.clearAllMocks();
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([row]);
    mocks.getEventMatchStats.mockResolvedValue(createStats());
    mocks.getRecentEventMatches.mockResolvedValue([]);
    await refreshLeaderboardPlayer(event.id, 999);
    expect(mocks.getEventLeaderboardPlayer).not.toHaveBeenCalled();
    expect(mocks.getEventLeaderboardPlayers).toHaveBeenCalledWith(event.id);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith('leaderboard');
  });
  it('clears the cache when there is no display event', async () => {
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([createRow()]);
    await loadLeaderboardFromDatabase();
    expect(getLeaderboard()).toHaveLength(1);
    vi.clearAllMocks();
    mocks.getDisplayEvent.mockResolvedValue(null);
    await loadLeaderboardFromDatabase();
    expect(getLeaderboard()).toEqual([]);
    expect(getLeaderboardMeta()).toEqual({
      event: null,
      totalPlayers: 0,
      cachedPlayers: 0,
    });
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith('leaderboard');
  });
  it('broadcasts only when a player error changes', async () => {
    const row = createRow();
    mocks.getDisplayEvent.mockResolvedValue(event);
    mocks.getEventLeaderboardPlayers.mockResolvedValue([row]);
    await loadLeaderboardFromDatabase();
    vi.clearAllMocks();
    setLeaderboardPlayerError(row.playerId, 'Provider exploded');
    expect(getLeaderboardPlayer(row.playerId)?.error).toBe('Provider exploded');
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledTimes(1);
    setLeaderboardPlayerError(row.playerId, 'Provider exploded');
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledTimes(1);
  });
});
