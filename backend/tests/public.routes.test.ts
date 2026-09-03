import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const mocks = vi.hoisted(() => ({
  getPlayers: vi.fn(),
  getLeaderboard: vi.fn(),
  getLeaderboardHighlights: vi.fn(),
  getLeaderboardMeta: vi.fn(),
  getLeagueDataProviderStatus: vi.fn(),
  getRefreshSchedulerStatus: vi.fn(),
  getLeagueDataProviderDiagnostics: vi.fn(),
}));

vi.mock('../src/db/players', () => ({
  getPlayers: mocks.getPlayers,
}));
vi.mock('../src/services/leaderboard.service', () => ({
  getLeaderboard: mocks.getLeaderboard,
  getLeaderboardHighlights: mocks.getLeaderboardHighlights,
  getLeaderboardMeta: mocks.getLeaderboardMeta,
}));
vi.mock('../src/services/league-data.service', () => ({
  getLeagueDataProviderStatus: mocks.getLeagueDataProviderStatus,
  getLeagueDataProviderDiagnostics: mocks.getLeagueDataProviderDiagnostics,
}));
vi.mock('../src/jobs/refresh-scheduler', () => ({
  getRefreshSchedulerStatus: mocks.getRefreshSchedulerStatus,
}));

import { publicRoutes } from '../src/routes/public.routes';

const event = {
  id: 42,
  name: 'September Event',
  startsAt: '2026-09-01T18:00:00.000Z',
  endsAt: '2026-09-05T18:00:00.000Z',
  status: 'active',
};
const firstPlayer = {
  player: {
    id: 1,
    gameName: 'Alpha',
    tagLine: 'EUW',
    region: 'EUW',
  },
  startedAt: '2026-09-01T18:00:00.000Z',
  start: {
    tier: 'GOLD',
    division: 2,
    lp: 0,
    score: 1400,
  },
  current: {
    tier: 'GOLD',
    division: 1,
    lp: 25,
    score: 1525,
  },
  lpGain: 125,
  record: {
    wins: 3,
    losses: 1,
    games: 4,
  },
  recentMatches: [
    {
      id: 'match-1',
    },
  ],
  lastUpdated: '2026-09-02T20:00:00.000Z',
  error: null,
};
const secondPlayer = {
  ...firstPlayer,
  player: {
    ...firstPlayer.player,
    id: 2,
    gameName: 'Bravo',
  },
  lastUpdated: '2026-09-02T22:00:00.000Z',
};
const highlights = {
  longestWinStreak: {
    player: {
      id: 1,
      gameName: 'Alpha',
    },
    value: 3,
  },
  bestKda: null,
  mostWins: null,
};

async function createTestApp() {
  const app = Fastify({
    logger: false,
  });
  await app.register(publicRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLeaderboard.mockReturnValue([]);
  mocks.getLeaderboardHighlights.mockReturnValue({
    longestWinStreak: null,
    bestKda: null,
    mostWins: null,
  });
  mocks.getLeagueDataProviderDiagnostics.mockReturnValue({
    rateLimit: null,
    warning: null,
  });
  mocks.getLeaderboardMeta.mockReturnValue({
    event: null,
    totalPlayers: 0,
    cachedPlayers: 0,
  });
  mocks.getPlayers.mockResolvedValue([]);
  mocks.getLeagueDataProviderStatus.mockReturnValue({
    name: 'opgg',
    connected: false,
  });
  mocks.getRefreshSchedulerStatus.mockReturnValue({
    running: true,
    intervalMs: 60_000,
  });
});

describe('public routes', () => {
  it('returns an empty leaderboard when no data is cached', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/leaderboard',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ready: false,
        event: {
          id: null,
          name: null,
          startsAt: null,
          endsAt: null,
          status: null,
        },
        totalPlayers: 0,
        loadedPlayers: 0,
        lastUpdated: null,
        highlights: {
          longestWinStreak: null,
          bestKda: null,
          mostWins: null,
        },
        players: [],
      });
    } finally {
      await app.close();
    }
  });
  it('returns leaderboard data and the newest update timestamp', async () => {
    mocks.getLeaderboard.mockReturnValue([secondPlayer, firstPlayer]);
    mocks.getLeaderboardHighlights.mockReturnValue(highlights);
    mocks.getLeaderboardMeta.mockReturnValue({
      event,
      totalPlayers: 5,
      cachedPlayers: 2,
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/leaderboard',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ready: true,
        event,
        totalPlayers: 5,
        loadedPlayers: 2,
        lastUpdated: '2026-09-02T22:00:00.000Z',
        highlights,
        players: [secondPlayer, firstPlayer],
      });
    } finally {
      await app.close();
    }
  });
  it('returns no event player when leaderboard data is unavailable', async () => {
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/event',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ready: false,
        error: 'No leaderboard data available',
      });
    } finally {
      await app.close();
    }
  });
  it('returns the first leaderboard player from the event endpoint', async () => {
    mocks.getLeaderboard.mockReturnValue([firstPlayer, secondPlayer]);
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/event',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ready: true,
        player: firstPlayer.player,
        startedAt: firstPlayer.startedAt,
        start: firstPlayer.start,
        current: firstPlayer.current,
        lpGain: firstPlayer.lpGain,
        record: firstPlayer.record,
        recentMatches: firstPlayer.recentMatches,
        lastUpdated: firstPlayer.lastUpdated,
        error: firstPlayer.error,
      });
    } finally {
      await app.close();
    }
  });
  it('returns health information for database, provider, players and scheduler', async () => {
    mocks.getPlayers.mockResolvedValue([
      {
        id: 1,
      },
      {
        id: 2,
      },
      {
        id: 3,
      },
    ]);
    mocks.getLeaderboardMeta.mockReturnValue({
      event,
      totalPlayers: 7,
      cachedPlayers: 5,
    });
    mocks.getLeagueDataProviderStatus.mockReturnValue({
      name: 'riot',
      connected: true,
    });
    mocks.getRefreshSchedulerStatus.mockReturnValue({
      running: true,
      intervalMs: 30_000,
    });
    mocks.getLeagueDataProviderDiagnostics.mockReturnValue({
      rateLimit: {
        buckets: [
          {
            limit: 100,
            count: 17,
            windowSeconds: 120,
          },
          {
            limit: 20,
            count: 1,
            windowSeconds: 1,
          },
        ],
        restricted: true,
      },
      warning:
        'Low Riot API rate limit detected. ' +
        'This is typical for Development or Personal API keys. ' +
        'Large events may refresh slowly or receive HTTP 429 responses. ' +
        'A Production API key is recommended.',
    });
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.getPlayers).toHaveBeenCalledWith(true);
      expect(response.json()).toEqual({
        status: 'ok',
        database: {
          connected: true,
        },
        provider: {
          name: 'riot',
          connected: true,
          rateLimit: {
            buckets: [
              {
                limit: 100,
                count: 17,
                windowSeconds: 120,
              },
              {
                limit: 20,
                count: 1,
                windowSeconds: 1,
              },
            ],
            restricted: true,
          },
          warning:
            'Low Riot API rate limit detected. ' +
            'This is typical for Development or Personal API keys. ' +
            'Large events may refresh slowly or receive HTTP 429 responses. ' +
            'A Production API key is recommended.',
        },
        event: {
          id: 42,
          status: 'active',
        },
        players: {
          enabled: 3,
          event: 7,
          cached: 5,
        },
        scheduler: {
          running: true,
          intervalMs: 30_000,
        },
      });
      mocks.getLeagueDataProviderDiagnostics.mockReturnValue({
        rateLimit: {
          buckets: [
            {
              limit: 100,
              count: 17,
              windowSeconds: 120,
            },
            {
              limit: 20,
              count: 1,
              windowSeconds: 1,
            },
          ],

          restricted: true,
        },
        warning:
          'Low Riot API rate limit detected. ' +
          'This is typical for Development or Personal API keys. ' +
          'Large events may refresh slowly or receive HTTP 429 responses. ' +
          'A Production API key is recommended.',
      });
    } finally {
      await app.close();
    }
  });
});
