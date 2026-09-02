import type { FastifyInstance } from 'fastify';
import { addLiveUpdateClient } from '../services/live-update.service';

const HEARTBEAT_INTERVAL_MS = 15_000;

export async function liveUpdateRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/live', async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.flushHeaders();
    reply.raw.write('retry: 5000\n\n');
    const removeClient = addLiveUpdateClient(reply.raw);
    const heartbeat = setInterval(() => {
      if (reply.raw.destroyed || reply.raw.writableEnded) {
        return;
      }
      reply.raw.write(': keep-alive\n\n');
    }, HEARTBEAT_INTERVAL_MS);
    const cleanup = () => {
      clearInterval(heartbeat);
      removeClient();
    };
    reply.raw.once('close', cleanup);
    reply.raw.once('error', cleanup);
  });
}
