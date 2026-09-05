import { createApplication } from './runtime/application';
import { bootstrapApplication } from './runtime/bootstrap';
import { closeDatabase } from './db/client';
import { startRefreshScheduler, stopRefreshScheduler } from './jobs/refresh-scheduler';
import { startEventLifecycle, stopEventLifecycle } from './jobs/event-lifecycle';
import { disconnectLeagueDataProvider } from './services/league-data.service';
import { closeLiveUpdateClients } from './services/live-update.service';

const fastify = createApplication();

async function main(): Promise<void> {
  console.log();
  console.log('LP Tracker');
  console.log('==========');
  console.log();
  const { event } = await bootstrapApplication();
  await fastify.listen({
    host: '0.0.0.0',
    port: 3000,
  });
  console.log();
  console.log('[API] http://localhost:3000 ✓');
  console.log(`[EVENT] ${event ? `${event.name} (${event.status})` : 'No event available'}`);
  console.log();
  startRefreshScheduler();
  startEventLifecycle();
}
let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log();
  console.log('[APP] Shutting down...');
  stopRefreshScheduler();
  stopEventLifecycle();
  closeLiveUpdateClients();
  await disconnectLeagueDataProvider();
  await fastify.close().catch(() => {});
  await closeDatabase().catch(() => {});
  console.log('[APP] Shutdown complete ✓');
}
process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
/*
 * ============================================================
 * Start
 * ============================================================
 */
main().catch(async (error) => {
  console.error();
  console.error('[APP] Fatal startup error:');
  console.error(error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
