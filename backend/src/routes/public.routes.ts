import type { FastifyInstance } from 'fastify';
import type { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { eventPlayerIdParamsSchema, eventPlayerMatchParamsSchema } from './schemas/id.schemas';
import { errorResponseSchema } from './schemas/common.schemas';
import { healthResponseSchema } from './schemas/health.schemas';
import {
  eventPlayerReadyResponseSchema,
  eventPlayerResponseSchema,
} from './schemas/event-player.schemas';
import { leaderboardResponseSchema } from './schemas/leaderboard.schemas';
import {
  matchDetailsErrorResponseSchema,
  matchDetailsResponseSchema,
} from './schemas/match-details.schemas';
import { findEventMatchDetails } from '../db/event-match-details-reader';
import { getPlayers } from '../db/players';
import {
  getEventPlayerSnapshot,
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
  const typedApp = app.withTypeProvider<JsonSchemaToTsProvider>();
  typedApp.get(
    '/api/leaderboard',
    {
      schema: {
        response: {
          200: leaderboardResponseSchema,
        },
      },
    },
    async () => {
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
    },
  );
  typedApp.get(
    '/api/event',
    {
      schema: {
        response: {
          200: eventPlayerResponseSchema,
        },
      },
    },
    async () => {
      const leaderboard = getLeaderboard();
      const first = leaderboard[0];
      if (!first) {
        return {
          ready: false as const,
          error: 'No leaderboard data available',
        };
      }
      return {
        ready: true as const,
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
    },
  );
  typedApp.get(
    '/api/events/:eventId/players/:playerId',
    {
      schema: {
        params: eventPlayerIdParamsSchema,
        response: {
          200: eventPlayerReadyResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const eventId = Number(request.params.eventId);
      const playerId = Number(request.params.playerId);
      if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        return reply.code(400).send({
          error: 'Invalid event id',
        });
      }
      if (!Number.isSafeInteger(playerId) || playerId <= 0) {
        return reply.code(400).send({
          error: 'Invalid player id',
        });
      }
      const player = await getEventPlayerSnapshot(eventId, playerId);
      if (!player) {
        return reply.code(404).send({
          error: 'Event player not found',
        });
      }
      return {
        ready: true as const,
        player: player.player,
        startedAt: player.startedAt,
        start: player.start,
        current: player.current,
        lpGain: player.lpGain,
        record: player.record,
        recentMatches: player.recentMatches,
        lastUpdated: player.lastUpdated,
        error: player.error,
      };
    },
  );
  typedApp.get(
    '/api/events/:eventId/players/:playerId/matches/:matchId',
    {
      schema: {
        params: eventPlayerMatchParamsSchema,
        response: {
          200: matchDetailsResponseSchema,
          400: matchDetailsErrorResponseSchema,
          404: matchDetailsErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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
    },
  );
  typedApp.get(
    '/api/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => {
      const enabledPlayers = await getPlayers(true);
      const { event, totalPlayers, cachedPlayers } = getLeaderboardMeta();
      const provider = getLeagueDataProviderStatus();
      const providerDiagnostics = getLeagueDataProviderDiagnostics();

      return {
        status: 'ok' as const,
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
    },
  );
}
