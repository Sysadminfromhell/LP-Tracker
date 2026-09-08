import type { FastifyInstance } from 'fastify';
import { findEventMatchDetails } from '../db/event-match-details-reader';
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
import { getBuildInfo } from '../runtime/build-info';

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
  app.get<{
    Params: {
      eventId: string;
      playerId: string;
      matchId: string;
    };
  }>('/api/events/:eventId/players/:playerId/matches/:matchId', async (request, reply) => {
    const eventId = Number(request.params.eventId);
    const playerId = Number(request.params.playerId);
    const matchId = request.params.matchId.trim();
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return reply.code(400).send({
        error: 'Invalid event id',
      });
    }
    if (!Number.isInteger(playerId) || playerId <= 0) {
      return reply.code(400).send({
        error: 'Invalid player id',
      });
    }
    if (matchId.length === 0) {
      return reply.code(400).send({
        error: 'Invalid match id',
      });
    }
    const details = await findEventMatchDetails(eventId, playerId, matchId);
    if (!details) {
      return reply.code(404).send({
        error: 'Match details not found',
      });
    }
    return {
      matchId,
      durationSeconds: details.durationSeconds,
      participants: details.participants,
    };
  });
  app.get('/api/health', async () => {
    const enabledPlayers = await getPlayers(true);
    const { event, totalPlayers, cachedPlayers } = getLeaderboardMeta();
    const provider = getLeagueDataProviderStatus();
    const providerDiagnostics = getLeagueDataProviderDiagnostics();
    return {
      status: 'ok',
      build: getBuildInfo(),
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
