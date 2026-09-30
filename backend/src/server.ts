import { createApplication } from './runtime/application';
import { bootstrapApplication } from './runtime/bootstrap';
import { createShutdownHandler } from './runtime/shutdown';
import { startRefreshScheduler } from './jobs/refresh-scheduler';
import { startEventLifecycle } from './jobs/event-lifecycle';
import { startLpReconciliationWorker } from './jobs/lp-reconciliation';
import { log } from './utils/logging';

let caller = "APP";

const fastify = createApplication();
const shutdown = createShutdownHandler(fastify);

async function main(): Promise<void> {
  log(caller, 'info', ``);
  log(caller, 'info', `LP Tracker`);
  log(caller, 'info', `==========`);
  log(caller, 'info', ``);
  const { event } = await bootstrapApplication();
  await fastify.listen({
    host: '0.0.0.0',
    port: 3000,
  });
  log(caller, 'info', ``);
  log(caller, 'info', `listening on http://localhost:3000`,"API");
  log(caller, 'info', `${event ? `${event.name} (${event.status})` : 'No event available'}`, "EVENT");
  log(caller, 'info', ``);
  startRefreshScheduler();
  startEventLifecycle();
  startLpReconciliationWorker();
}
process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
main().catch(async (error) => {
  log(caller, 'info', ``);
  log(caller, 'info', `Fatal startup error:`);
  log(caller, 'info', error);
  await shutdown();
  process.exit(1);
});
