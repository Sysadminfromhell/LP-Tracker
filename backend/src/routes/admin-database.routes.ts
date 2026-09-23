import type { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { requireAdmin } from '../auth/admin-auth';
import { getAdminDatabaseOverview } from '../db/admin-database';
import { getAdminDatabaseTableDetails } from '../db/admin-database-table-details';
import { runAdminDatabaseMaintenance } from '../db/admin-database-maintenance';
import {
  adminDatabaseMaintenanceRequestSchema,
  adminDatabaseMaintenanceResponseSchema,
  adminDatabaseOverviewResponseSchema,
  adminDatabaseTableDetailsResponseSchema,
  adminDatabaseResetRequestSchema,
  adminDatabaseResetResponseSchema,
  adminDatabaseMaintenanceAllResponseSchema,
  adminDatabasePlayerCacheCleanupResponseSchema,
} from './schemas/admin-database.schemas';
import { errorResponseSchema } from './schemas/common.schemas';
import { resetAdminDatabase } from '../db/admin-database-reset';
import { runAdminDatabaseMaintenanceAll } from '../db/admin-database-maintenance-all';
import { clearAdminDatabasePlayerCache } from '../db/admin-database-player-cache-cleanup';

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
};
