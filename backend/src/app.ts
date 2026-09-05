import Fastify, { LogController } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';

export function createApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,reqId',
          singleLine: true,
        },
      },
    },
    logController: new LogController({
      disableRequestLogging: true,
    }),
  });
  app.register(cookie);
  app.register(helmet, {
    contentSecurityPolicy: false,
  });
  app.addHook('onRequest', async (request, reply) => {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    const protectedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    if (!protectedMethods.has(request.method) || !request.url.startsWith('/api/admin/')) {
      return;
    }
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (!origin || !host) {
      return reply.code(403).send({
        error: 'Invalid request origin',
      });
    }
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return reply.code(403).send({
        error: 'Invalid request origin',
      });
    }
    if (originHost !== host) {
      return reply.code(403).send({
        error: 'Invalid request origin',
      });
    }
  });
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(`${request.method} ${request.url} -> ${reply.statusCode} | ${request.ip}`);
  });
  return app;
}
