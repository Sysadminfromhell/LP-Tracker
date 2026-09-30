import type { FastifyInstance } from 'fastify';
import { closeDatabase } from '../db/client';
import { stopRefreshScheduler } from '../jobs/refresh-scheduler';
import { stopEventLifecycle } from '../jobs/event-lifecycle';
import { disconnectLeagueDataProvider } from '../services/league-data.service';
import { closeLiveUpdateClients } from '../services/live-update.service';
import { jobCoordinator } from './job-coordinator';
import { stopLpReconciliationWorker } from '../jobs/lp-reconciliation';
import { log } from '../utils/logging';

let caller = "APP";

export function createShutdownHandler(app: FastifyInstance): () => Promise<void> {
  let shuttingDown = false;
  return async function shutdown(): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log(caller, 'info', ``);
    log(caller, 'info', `Shutting down...`);
    stopRefreshScheduler();
    stopEventLifecycle();
    jobCoordinator.stopAcceptingJobs();
    stopLpReconciliationWorker();
    await jobCoordinator.waitForIdle();
    closeLiveUpdateClients();
    await disconnectLeagueDataProvider().catch(() => {});
    await app.close().catch(() => {});
    await closeDatabase().catch(() => {});
    log(caller, 'info', `Shutdown complete`);
  };
}
