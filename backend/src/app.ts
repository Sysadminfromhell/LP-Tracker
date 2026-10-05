import Fastify, { LogController } from 'fastify';
import { STATUS_CODES } from 'node:http';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { log } from './utils/logging';

export function createApp() {
  function getTrustProxySetting(): false | string {
    const value = process.env.TRUST_PROXY?.trim();
    if (!value || value.toLowerCase() === 'false') {
      return false;
    }
    if (value.toLowerCase() === 'true') {
      throw new Error('TRUST_PROXY must contain trusted proxy IPs/CIDRs instead of "true"');
    }
    log('APP', 'info', `A reverse Proxy is configured ${value}`, 'BOOTUP');
    return value;
  }

  const app = Fastify({
    trustProxy: getTrustProxySetting(),
    ajv: {
      customOptions: {
        coerceTypes: false,
        useDefaults: false,
        removeAdditional: false,
        allErrors: false,
      },
    },
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
  app.setErrorHandler((error, request, reply) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      Array.isArray(error.validation)
    ) {
      return reply.code(400).send({
        error: 'Invalid request',
      });
    }
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : 500;
    if (statusCode >= 500) {
      const message = error instanceof Error ? error.message : String(error);
      log('APP', 'error', `${request.method} ${request.url} failed: ${message}`, 'WEB');
    }
    return reply.code(statusCode).send({
      error: STATUS_CODES[statusCode] ?? 'Request failed',
    });
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
    log(
      'APP',
      'info',
      `${request.method} ${request.url} -> ${reply.statusCode} | ${request.ip}`,
      'WEB',
    );
  });
  return app;
}
