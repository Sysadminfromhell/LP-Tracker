import type { FastifyInstance } from 'fastify';

import { closeDatabase } from '../db/client';
import { stopRefreshScheduler } from '../jobs/refresh-scheduler';
import { stopEventLifecycle } from '../jobs/event-lifecycle';
import { disconnectLeagueDataProvider } from '../services/league-data.service';
import { closeLiveUpdateClients } from '../services/live-update.service';

export function createShutdownHandler(app: FastifyInstance): () => Promise<void> {
  let shuttingDown = false;
  return async function shutdown(): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log();
    console.log('[APP] Shutting down...');
    stopRefreshScheduler();
    stopEventLifecycle();
    closeLiveUpdateClients();
    await disconnectLeagueDataProvider().catch(() => {});
    await app.close().catch(() => {});
    await closeDatabase().catch(() => {});
    console.log('[APP] Shutdown complete ✓');
  };
}
