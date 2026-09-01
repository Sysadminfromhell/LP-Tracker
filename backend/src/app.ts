import Fastify from 'fastify';
import cookie from '@fastify/cookie';

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
    disableRequestLogging: true,
  });
  app.register(cookie);
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(`${request.method} ${request.url} -> ${reply.statusCode} | ${request.ip}`);
  });
  return app;
}