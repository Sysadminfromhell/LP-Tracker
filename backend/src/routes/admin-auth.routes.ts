import type { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import rateLimit from '@fastify/rate-limit';
import { authenticateAdmin } from '../db/admins';
import { createAdminSession, deleteAdminSession } from '../db/admin-sessions';
import { ADMIN_COOKIE_NAME, getAdminCookieOptions, requireAdmin } from '../auth/admin-auth';

const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    username: {
      type: 'string',
    },
    password: {
      type: 'string',
    },
  },
} as const;

export const adminAuthRoutes: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  await app.register(rateLimit, {
    global: false,
  });
  app.post(
    '/api/admin/login',
    {
      schema: {
        body: loginBodySchema,
      },
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const username = request.body.username?.trim();
      const password = request.body.password;
      if (!username || !password) {
        return reply.code(400).send({
          error: 'Username and password are required',
        });
      }
      const admin = await authenticateAdmin(username, password);
      if (!admin) {
        return reply.code(401).send({
          error: 'Invalid username or password',
        });
      }
      const session = await createAdminSession(admin.id);
      reply.setCookie(ADMIN_COOKIE_NAME, session.token, {
        ...getAdminCookieOptions(),
        expires: new Date(session.expiresAt),
      });
      return {
        ok: true,
        admin: {
          id: admin.id,
          username: admin.username,
        },
      };
    },
  );
  app.post('/api/admin/logout', async (request, reply) => {
    const token = request.cookies[ADMIN_COOKIE_NAME];
    if (token) {
      await deleteAdminSession(token).catch(() => {});
    }
    reply.clearCookie(ADMIN_COOKIE_NAME, getAdminCookieOptions());
    return {
      ok: true,
    };
  });
  app.get('/api/admin/me', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }
    return {
      authenticated: true,
      admin: {
        id: admin.id,
        username: admin.username,
        lastLoginAt: admin.lastLoginAt,
      },
    };
  });
};
