import type { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { broadcastLiveUpdate } from '../services/live-update.service';
import { loadLeaderboardFromDatabase } from '../services/leaderboard.service';
import { requireAdmin } from '../auth/admin-auth';
import { getAdminDatabaseOverview } from '../db/admin-database';
import { getAdminDatabaseTableDetails } from '../db/admin-database-table-details';
import { runAdminDatabaseMaintenance } from '../db/admin-database-maintenance';
import {
  adminDatabaseMaintenanceRequestSchema,
  adminDatabaseMaintenanceResponseSchema,
  adminDatabaseOverviewResponseSchema,
  adminDatabaseTableDetailsResponseSchema,
  adminDatabaseMatchDetailsPruneRequestSchema,
  adminDatabaseMatchDetailsPruneResponseSchema,
  adminDatabaseDeleteEndedEventParamsSchema,
  adminDatabaseDeleteEndedEventRequestSchema,
  adminDatabaseDeleteEndedEventResponseSchema,
  adminDatabasePlayerDeleteParamsSchema,
  adminDatabasePlayerDeleteDependenciesResponseSchema,
  adminDatabaseDeletePlayerRequestSchema,
  adminDatabaseDeletePlayerResponseSchema,
  adminDatabaseResetRequestSchema,
  adminDatabaseResetResponseSchema,
  adminDatabaseMaintenanceAllResponseSchema,
  adminDatabasePlayerCacheCleanupResponseSchema,
} from './schemas/admin-database.schemas';
import { errorResponseSchema } from './schemas/common.schemas';
import { resetAdminDatabase } from '../db/admin-database-reset';
import { runAdminDatabaseMaintenanceAll } from '../db/admin-database-maintenance-all';
import { clearAdminDatabasePlayerCache } from '../db/admin-database-player-cache-cleanup';
import { pruneAdminDatabaseMatchDetails } from '../db/admin-database-match-details-prune';
import { deleteAdminDatabaseEndedEvent } from '../db/admin-database-delete-ended-event';
import { getAdminDatabasePlayerDeleteDependencies } from '../db/admin-database-player-delete-dependencies';
import { deleteAdminDatabasePlayer } from '../db/admin-database-delete-player';

const adminDatabaseTableParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tableName: {
      type: 'string',
      minLength: 1,
    },
  },
  required: ['tableName'],
} as const;
export const adminDatabaseRoutes: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.get(
    '/api/admin/database/overview',
    {
      schema: {
        response: {
          200: adminDatabaseOverviewResponseSchema,
          401: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      return getAdminDatabaseOverview();
    },
  );
  app.get(
    '/api/admin/database/tables/:tableName',
    {
      schema: {
        params: adminDatabaseTableParamsSchema,
        response: {
          200: adminDatabaseTableDetailsResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      const details = await getAdminDatabaseTableDetails(request.params.tableName);
      if (!details) {
        return reply.code(404).send({
          error: 'Database table not found',
        });
      }
      return details;
    },
  );
  app.get(
    '/api/admin/database/cleanup/players/:playerId/dependencies',
    {
      schema: {
        params: adminDatabasePlayerDeleteParamsSchema,
        response: {
          200: adminDatabasePlayerDeleteDependenciesResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      const playerId = Number(request.params.playerId);
      if (!Number.isSafeInteger(playerId) || playerId <= 0) {
        return reply.code(400).send({
          error: 'Invalid player ID',
        });
      }
      const dependencies = await getAdminDatabasePlayerDeleteDependencies(playerId);
      if (!dependencies) {
        return reply.code(404).send({
          error: 'Player not found',
        });
      }
      return dependencies;
    },
  );
  app.post(
    '/api/admin/database/tables/:tableName/maintenance',
    {
      schema: {
        params: adminDatabaseTableParamsSchema,
        body: adminDatabaseMaintenanceRequestSchema,
        response: {
          200: adminDatabaseMaintenanceResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);

      if (!admin) {
        return;
      }
      const result = await runAdminDatabaseMaintenance(
        request.params.tableName,
        request.body.operation,
      );
      if (!result) {
        return reply.code(404).send({
          error: 'Database table not found or maintenance not allowed',
        });
      }
      return result;
    },
  );
  app.post(
    '/api/admin/database/reset',
    {
      schema: {
        body: adminDatabaseResetRequestSchema,
        response: {
          200: adminDatabaseResetResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);

      if (!admin) {
        return;
      }
      if (
        request.body.confirmation !== 'RESET_APPLICATION' ||
        request.body.acknowledgement !== 'I understand'
      ) {
        return reply.code(400).send({
          error: 'Reset confirmation invalid',
        });
      }
      return resetAdminDatabase();
    },
  );
  app.post(
    '/api/admin/database/maintenance',
    {
      schema: {
        body: adminDatabaseMaintenanceRequestSchema,
        response: {
          200: adminDatabaseMaintenanceAllResponseSchema,
          401: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      return runAdminDatabaseMaintenanceAll(request.body.operation);
    },
  );
  app.post(
    '/api/admin/database/cleanup/player-cache',
    {
      schema: {
        response: {
          200: adminDatabasePlayerCacheCleanupResponseSchema,
          401: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      return clearAdminDatabasePlayerCache();
    },
  );
  app.post(
    '/api/admin/database/cleanup/match-details',
    {
      schema: {
        body: adminDatabaseMatchDetailsPruneRequestSchema,
        response: {
          200: adminDatabaseMatchDetailsPruneResponseSchema,
          401: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);

      if (!admin) {
        return;
      }
      return pruneAdminDatabaseMatchDetails(request.body.olderThanDays);
    },
  );
  app.post(
    '/api/admin/database/cleanup/events/:eventId/delete',
    {
      schema: {
        params: adminDatabaseDeleteEndedEventParamsSchema,
        body: adminDatabaseDeleteEndedEventRequestSchema,
        response: {
          200: adminDatabaseDeleteEndedEventResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      if (request.body.confirmation !== 'DELETE_ENDED_EVENT') {
        return reply.code(400).send({
          error: 'Event deletion confirmation invalid',
        });
      }
      const eventId = Number(request.params.eventId);
      if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        return reply.code(400).send({
          error: 'Invalid event ID',
        });
      }
      try {
        const result = await deleteAdminDatabaseEndedEvent(eventId);
        await loadLeaderboardFromDatabase();
        broadcastLiveUpdate('events-changed');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'INVALID_EVENT_ID') {
            return reply.code(400).send({
              error: 'Invalid event ID',
            });
          }
          if (error.message === 'EVENT_NOT_FOUND') {
            return reply.code(404).send({
              error: 'Event not found',
            });
          }
          if (error.message === 'EVENT_NOT_ENDED') {
            return reply.code(409).send({
              error: 'Only ended events can be permanently deleted',
            });
          }
        }
        throw error;
      }
    },
  );
  app.post(
    '/api/admin/database/cleanup/players/:playerId/delete',
    {
      schema: {
        params: adminDatabasePlayerDeleteParamsSchema,
        body: adminDatabaseDeletePlayerRequestSchema,
        response: {
          200: adminDatabaseDeletePlayerResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      if (request.body.confirmation !== 'DELETE_PLAYER') {
        return reply.code(400).send({
          error: 'Player deletion confirmation invalid',
        });
      }
      const playerId = Number(request.params.playerId);
      if (!Number.isSafeInteger(playerId) || playerId <= 0) {
        return reply.code(400).send({
          error: 'Invalid player ID',
        });
      }
      try {
        const result = await deleteAdminDatabasePlayer(playerId);
        await loadLeaderboardFromDatabase();
        broadcastLiveUpdate('events-changed');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'INVALID_PLAYER_ID') {
            return reply.code(400).send({
              error: 'Invalid player ID',
            });
          }
          if (error.message === 'PLAYER_NOT_FOUND') {
            return reply.code(404).send({
              error: 'Player not found',
            });
          }
          if (error.message === 'PLAYER_HAS_EVENT_HISTORY') {
            return reply.code(409).send({
              error: 'Player cannot be permanently deleted while event history exists',
            });
          }
        }
        throw error;
      }
    },
  );
};
