import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { Player } from '../src/db/players';
import type { AdminPlayer } from '../src/db/admin-management';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getPlayers: vi.fn(),
  updatePlayerSocials: vi.fn(),
  getActiveEvent: vi.fn(),
  getEventParticipant: vi.fn(),
  savePlayerCacheSuccess: vi.fn(),
  addPlayerToActiveEvent: vi.fn(),
  createAdminPlayer: vi.fn(),
  getAdminPlayers: vi.fn(),
  updateAdminPlayer: vi.fn(),
  getLeagueDataProvider: vi.fn(),
  refreshPlayer: vi.fn(),
  loadLeaderboardFromDatabase: vi.fn(),
  isOperationBusy: vi.fn(),
  setRefreshInProgress: vi.fn(),
  calculateRankScore: vi.fn(),
  getSummonerProfile: vi.fn(),
  getRecentMatches: vi.fn(),
}));

vi.mock('../src/auth/admin-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('../src/db/players', () => ({
  getPlayers: mocks.getPlayers,
  updatePlayerSocials: mocks.updatePlayerSocials,
}));
vi.mock('../src/db/events', () => ({
  getActiveEvent: mocks.getActiveEvent,
  getEventParticipant: mocks.getEventParticipant,
}));
vi.mock('../src/db/player-cache', () => ({
  savePlayerCacheSuccess: mocks.savePlayerCacheSuccess,
}));
vi.mock('../src/db/admin-management', () => ({
  addPlayerToActiveEvent: mocks.addPlayerToActiveEvent,
  createAdminPlayer: mocks.createAdminPlayer,
  getAdminPlayers: mocks.getAdminPlayers,
  updateAdminPlayer: mocks.updateAdminPlayer,
}));
vi.mock('../src/services/league-data.service', () => ({
  getLeagueDataProvider: mocks.getLeagueDataProvider,
}));
vi.mock('../src/services/player-refresh.service', () => ({
  refreshPlayer: mocks.refreshPlayer,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  loadLeaderboardFromDatabase: mocks.loadLeaderboardFromDatabase,
}));
vi.mock('../src/runtime/operation-state', () => ({
  isOperationBusy: mocks.isOperationBusy,
  setRefreshInProgress: mocks.setRefreshInProgress,
}));
vi.mock('../src/rank', () => ({
  calculateRankScore: mocks.calculateRankScore,
}));

import { adminPlayerRoutes } from '../src/routes/admin-player.routes';

const player: Player = {
  id: 1,
  gameName: 'FourK',
  tagLine: 'EUW',
  region: 'EUW',
  twitchUsername: 'fourk',
  twitterUsername: 'FourKTTv',
  enabled: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const adminPlayer: AdminPlayer = {
  id: 1,
  gameName: 'FourK',
  tagLine: 'EUW',
  region: 'EUW',
  twitchUsername: 'fourk',
  twitterUsername: 'FourKTTv',
  enabled: true,
  profileImageUrl: 'https://example.com/profile.png',
  tier: 'GOLD',
  division: 2,
  lp: 50,
  rankScore: 1450,
  lastSuccessfulFetchAt: '2026-09-02T20:00:00.000Z',
  lastError: null,
};
const rankedProfile = {
  gameName: 'FourK',
  tagLine: 'EUW',
  profileImageUrl: 'https://example.com/profile.png',
  queues: [
    {
      gameType: 'SOLORANKED',
      tier: 'GOLD',
      division: 2,
      lp: 50,
      wins: 25,
      losses: 20,
    },
  ],
  lpHistory: [],
};

async function createTestApp() {
  const app = Fastify({
    logger: false,
  });
  await app.register(adminPlayerRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    id: 1,
    username: 'admin',
  });
  mocks.getPlayers.mockResolvedValue([player]);
  mocks.getAdminPlayers.mockResolvedValue([adminPlayer]);
  mocks.updatePlayerSocials.mockResolvedValue(adminPlayer);
  mocks.getActiveEvent.mockResolvedValue(null);
  mocks.getEventParticipant.mockResolvedValue(null);
  mocks.savePlayerCacheSuccess.mockResolvedValue(undefined);
  mocks.createAdminPlayer.mockResolvedValue(adminPlayer);
  mocks.updateAdminPlayer.mockResolvedValue(adminPlayer);
  mocks.addPlayerToActiveEvent.mockResolvedValue(true);
  mocks.refreshPlayer.mockResolvedValue(true);
  mocks.loadLeaderboardFromDatabase.mockResolvedValue(undefined);
  mocks.isOperationBusy.mockReturnValue(false);
  mocks.calculateRankScore.mockReturnValue(1450);
  mocks.getSummonerProfile.mockResolvedValue(rankedProfile);
  mocks.getRecentMatches.mockResolvedValue([]);
  mocks.getLeagueDataProvider.mockResolvedValue({
    name: 'test',
    connect: vi.fn(),
    disconnect: vi.fn(),
    getSummonerProfile: mocks.getSummonerProfile,
    getRecentMatches: mocks.getRecentMatches,
  });
});

describe('admin player routes', () => {
  it('returns admin players', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/players',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        players: [adminPlayer],
      });
      expect(mocks.getAdminPlayers).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
  it('rejects an invalid manual refresh player id', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players/nope/refresh',
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Invalid player id',
      });
      expect(mocks.refreshPlayer).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('rejects a manual refresh while another operation is running', async () => {
    mocks.isOperationBusy.mockReturnValue(true);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players/1/refresh',
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'A player refresh or event transition is currently in progress',
      });
      expect(mocks.setRefreshInProgress).not.toHaveBeenCalled();
      expect(mocks.refreshPlayer).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('manually refreshes a player and always releases the operation lock', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players/1/refresh',
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.getPlayers).toHaveBeenCalledWith(false);
      expect(mocks.refreshPlayer).toHaveBeenCalledWith(player);
      expect(response.json()).toEqual({
        ok: true,
        player: adminPlayer,
      });
      expect(mocks.setRefreshInProgress).toHaveBeenNthCalledWith(1, true);
      expect(mocks.setRefreshInProgress).toHaveBeenLastCalledWith(false);
    } finally {
      await app.close();
    }
  });
  it('reports partial refresh-all failures', async () => {
    const secondPlayer: Player = {
      ...player,
      id: 2,
      gameName: 'Second',
    };
    mocks.getPlayers.mockResolvedValue([player, secondPlayer]);
    mocks.refreshPlayer.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players/refresh-all',
      });
      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        refreshed: 1,
        failed: [
          {
            id: 2,
            gameName: 'Second',
            tagLine: 'EUW',
          },
        ],
      });
      expect(mocks.getPlayers).toHaveBeenCalledWith(true);
      expect(mocks.refreshPlayer).toHaveBeenCalledTimes(2);
      expect(mocks.setRefreshInProgress).toHaveBeenLastCalledWith(false);
    } finally {
      await app.close();
    }
  });
  it('rejects player creation with missing Riot ID fields', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players',
        payload: {
          gameName: 'FourK',
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Game name, tag line and region are required',
      });
      expect(mocks.getLeagueDataProvider).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('rejects players without Solo Queue data', async () => {
    mocks.getSummonerProfile.mockResolvedValue({
      ...rankedProfile,
      queues: [],
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players',
        payload: {
          gameName: 'FourK',
          tagLine: 'EUW',
          region: 'euw',
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'No Solo Queue information returned by league data provider',
      });
      expect(mocks.createAdminPlayer).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('rejects an unranked Solo Queue player', async () => {
    mocks.getSummonerProfile.mockResolvedValue({
      ...rankedProfile,
      queues: [
        {
          gameType: 'SOLORANKED',
          tier: null,
          division: null,
          lp: null,
          wins: null,
          losses: null,
        },
      ],
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players',
        payload: {
          gameName: 'FourK',
          tagLine: 'EUW',
          region: 'EUW',
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'FourK#EUW is currently unranked in Solo Queue',
      });
      expect(mocks.createAdminPlayer).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('validates and creates a ranked player', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players',
        payload: {
          gameName: '  FourK  ',
          tagLine: '  EUW  ',
          region: 'euw',
          twitchUsername: 'fourk',
          twitterUsername: '@FourKTTv',
        },
      });
      expect(response.statusCode).toBe(201);
      expect(mocks.getSummonerProfile).toHaveBeenCalledWith('FourK', 'EUW', 'EUW');
      expect(mocks.calculateRankScore).toHaveBeenCalledWith('GOLD', 2, 50);
      expect(mocks.createAdminPlayer).toHaveBeenCalledWith({
        gameName: 'FourK',
        tagLine: 'EUW',
        region: 'EUW',
        twitchUsername: 'fourk',
        twitterUsername: '@FourKTTv',
      });
      expect(mocks.savePlayerCacheSuccess).toHaveBeenCalledWith({
        playerId: 1,
        profileImageUrl: 'https://example.com/profile.png',
        tier: 'GOLD',
        division: 2,
        lp: 50,
        rankScore: 1450,
        seasonWins: 25,
        seasonLosses: 20,
      });
      expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
      expect(response.json()).toEqual({
        ok: true,
        player: adminPlayer,
      });
    } finally {
      await app.close();
    }
  });
  it('adds a newly created player to an active event', async () => {
    mocks.getActiveEvent.mockResolvedValue({
      id: 42,
      name: 'September Event',
      startsAt: '2026-09-01T18:00:00.000Z',
      endsAt: '2026-09-03T18:00:00.000Z',
      status: 'active',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T18:00:00.000Z',
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players',
        payload: {
          gameName: 'FourK',
          tagLine: 'EUW',
          region: 'EUW',
        },
      });
      expect(response.statusCode).toBe(201);
      expect(mocks.addPlayerToActiveEvent).toHaveBeenCalledWith(42, 1);
    } finally {
      await app.close();
    }
  });
  it('maps duplicate Riot accounts to 409', async () => {
    mocks.createAdminPlayer.mockRejectedValue({
      code: '23505',
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/players',
        payload: {
          gameName: 'FourK',
          tagLine: 'EUW',
          region: 'EUW',
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'This Riot account already exists',
      });
    } finally {
      await app.close();
    }
  });
  it('prevents Riot ID changes for active event participants', async () => {
    mocks.getActiveEvent.mockResolvedValue({
      id: 42,
      name: 'September Event',
      status: 'active',
    });
    mocks.getEventParticipant.mockResolvedValue({
      id: 100,
      eventId: 42,
      playerId: 1,
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/players/1',
        payload: {
          gameName: 'ChangedName',
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: 'Riot ID cannot be changed while the player is part of an active event',
      });
      expect(mocks.updateAdminPlayer).not.toHaveBeenCalled();
      expect(mocks.getSummonerProfile).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('updates socials without league provider validation', async () => {
    const updated = {
      ...adminPlayer,
      twitchUsername: 'newtwitch',
      twitterUsername: 'newtwitter',
    };
    mocks.updatePlayerSocials.mockResolvedValue(updated);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/players/1/socials',
        payload: {
          twitchUsername: 'newtwitch',
          twitterUsername: 'newtwitter',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.updatePlayerSocials).toHaveBeenCalledWith(1, 'newtwitch', 'newtwitter');
      expect(mocks.getLeagueDataProvider).not.toHaveBeenCalled();
      expect(mocks.loadLeaderboardFromDatabase).toHaveBeenCalledTimes(1);
      expect(response.json()).toEqual({
        ok: true,
        player: updated,
      });
    } finally {
      await app.close();
    }
  });
});
