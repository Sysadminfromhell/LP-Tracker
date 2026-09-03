import type { FastifyInstance } from 'fastify';
import { getPlayers } from '../db/players';
import {
  getLeaderboard,
  getLeaderboardHighlights,
  getLeaderboardMeta,
} from '../services/leaderboard.service';
import {
  getLeagueDataProviderDiagnostics,
  getLeagueDataProviderStatus,
} from '../services/league-data.service';
import { getRefreshSchedulerStatus } from '../jobs/refresh-scheduler';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/leaderboard', async () => {
    const leaderboard = getLeaderboard();
    const highlights = getLeaderboardHighlights();
    const { event, totalPlayers } = getLeaderboardMeta();
    const newestUpdate =
      leaderboard
        .map((player) => player.lastUpdated)
        .sort()
        .at(-1) ?? null;
    return {
      ready: leaderboard.length > 0,
      event: {
        id: event?.id ?? null,
        name: event?.name ?? null,
        startsAt: event?.startsAt ?? null,
        endsAt: event?.endsAt ?? null,
        status: event?.status ?? null,
      },
      totalPlayers,
      loadedPlayers: leaderboard.length,
      lastUpdated: newestUpdate,
      highlights,
      players: leaderboard,
    };
  });
  app.get('/api/event', async () => {
    const leaderboard = getLeaderboard();
    const first = leaderboard[0];
    if (!first) {
      return {
        ready: false,
        error: 'No leaderboard data available',
      };
    }
    return {
      ready: true,
      player: first.player,
      startedAt: first.startedAt,
      start: first.start,
      current: first.current,
      lpGain: first.lpGain,
      record: first.record,
      recentMatches: first.recentMatches,
      lastUpdated: first.lastUpdated,
      error: first.error,
    };
  });
  app.get('/api/health', async () => {
    const enabledPlayers = await getPlayers(true);
    const { event, totalPlayers, cachedPlayers } = getLeaderboardMeta();
    const provider = getLeagueDataProviderStatus();
    const providerDiagnostics = getLeagueDataProviderDiagnostics();
    return {
      status: 'ok',
      database: {
        connected: true,
      },
      provider: {
        name: provider.name,
        connected: provider.connected,
        rateLimit: providerDiagnostics.rateLimit,
        warning: providerDiagnostics.warning,
      },
      event: {
        id: event?.id ?? null,
        status: event?.status ?? null,
      },
      players: {
        enabled: enabledPlayers.length,
        event: totalPlayers,
        cached: cachedPlayers,
      },
      scheduler: getRefreshSchedulerStatus(),
    };
  });
}
