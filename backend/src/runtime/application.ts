import type { FastifyInstance } from 'fastify';

import { createApp } from '../app';
import { adminAuthRoutes } from '../routes/admin-auth.routes';
import { adminEventRoutes } from '../routes/admin-event.routes';
import { adminPlayerRoutes } from '../routes/admin-player.routes';
import { liveUpdateRoutes } from '../routes/live-update.routes';
import { metricsRoutes } from '../routes/metrics.routes';
import { publicRoutes } from '../routes/public.routes';

export function createApplication(): FastifyInstance {
  const app = createApp();

  app.register(adminAuthRoutes);
  app.register(adminEventRoutes);
  app.register(adminPlayerRoutes);
  app.register(publicRoutes);
  app.register(liveUpdateRoutes);
  app.register(metricsRoutes);

  return app;
}
