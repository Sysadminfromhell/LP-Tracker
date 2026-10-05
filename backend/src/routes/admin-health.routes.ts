import type { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { requireAdmin } from '../auth/admin-auth';
import { getAdminHealth } from '../services/health.service';
import { errorResponseSchema } from './schemas/common.schemas';
import { healthResponseSchema } from './schemas/health.schemas';

export const adminHealthRoutes: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.get(
    '/api/admin/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
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
      return getAdminHealth();
    },
  );
};
