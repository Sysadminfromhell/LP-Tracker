import type { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { requireAdmin } from '../auth/admin-auth';
import { getLegalPage, getLegalPages, updateLegalPage } from '../db/legal-pages';
import { errorResponseSchema } from './schemas/common.schemas';
import {
  legalPageResponseSchema,
  legalPagesResponseSchema,
  legalPageUpdateSchema,
} from './schemas/legal-page.schemas';

const params = {
  type: 'object',
  additionalProperties: false,
  required: ['slug'],
  properties: { slug: { type: 'string', minLength: 1 } },
} as const;
export const legalPageRoutes: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.get(
    '/api/legal-pages/:slug',
    {
      schema: {
        params,
        response: {
          200: legalPageResponseSchema,
          404: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const page = await getLegalPage(request.params.slug);
      return page ? { page } : reply.code(404).send({ error: 'Legal page not found' });
    },
  );
  app.get(
    '/api/admin/legal-pages',
    {
      schema: {
        response: {
          200: legalPagesResponseSchema,
          401: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return;
      return { pages: await getLegalPages(true) };
    },
  );
  app.put(
    '/api/admin/legal-pages/:slug',
    {
      schema: {
        params,
        body: legalPageUpdateSchema,
        response: {
          200: legalPageResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return;
      const page = await updateLegalPage(request.params.slug, request.body);
      return page ? { page } : reply.code(404).send({ error: 'Legal page not found' });
    },
  );
};
