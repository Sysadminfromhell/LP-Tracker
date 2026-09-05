import { createApplication } from './runtime/application';
import { bootstrapApplication } from './runtime/bootstrap';
import { createShutdownHandler } from './runtime/shutdown';
import { startRefreshScheduler } from './jobs/refresh-scheduler';
import { startEventLifecycle } from './jobs/event-lifecycle';

const fastify = createApplication();
const shutdown = createShutdownHandler(fastify);

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
  await shutdown();
  process.exit(1);
});
