import { createApp } from './app';
import { closeDatabase, testDatabaseConnection } from './db/client';
import { runMigrations } from './db/migrations';
import { adminAuthRoutes } from './routes/admin-auth.routes';
import { adminEventRoutes } from './routes/admin-event.routes';
import { adminPlayerRoutes } from './routes/admin-player.routes';
import { publicRoutes } from './routes/public.routes';
import { getLeaderboardMeta, loadLeaderboardFromDatabase } from './services/leaderboard.service';
import { startRefreshScheduler, stopRefreshScheduler } from './jobs/refresh-scheduler';
import { startEventLifecycle, stopEventLifecycle } from './jobs/event-lifecycle';
import { disconnectLeagueDataProvider } from './services/league-data.service';
import { ensureInitialAdmin } from './db/admins';
import { deleteExpiredAdminSessions } from './db/admin-sessions';

const fastify = createApp();
fastify.register(adminAuthRoutes);
fastify.register(adminEventRoutes);
fastify.register(adminPlayerRoutes);
fastify.register(publicRoutes);

async function main(): Promise<void> {
  console.log();
  console.log('LP Tracker');
  console.log('==========');
  console.log();
  await testDatabaseConnection();
  await runMigrations();
  await ensureInitialAdmin();
  const deletedSessions = await deleteExpiredAdminSessions();
  if (deletedSessions > 0) {
    console.log(`[ADMIN] Removed ${deletedSessions} expired session(s)`);
  }
  console.log('[CACHE] Loading persistent leaderboard...');
  await loadLeaderboardFromDatabase();
  const { event, totalPlayers, cachedPlayers } = getLeaderboardMeta();
  console.log(`[CACHE] Loaded ${cachedPlayers}/${totalPlayers} event player(s) ✓`);
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
