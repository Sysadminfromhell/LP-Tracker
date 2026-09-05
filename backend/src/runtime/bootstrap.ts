import { testDatabaseConnection } from '../db/client';
import { runMigrations } from '../db/migrations';
import { ensureInitialAdmin } from '../db/admins';
import { deleteAllAdminSessions } from '../db/admin-sessions';
import { getLeaderboardMeta, loadLeaderboardFromDatabase } from '../services/leaderboard.service';

export async function bootstrapApplication() {
  await testDatabaseConnection();
  await runMigrations();
  await ensureInitialAdmin();
  const invalidatedSessions = await deleteAllAdminSessions();
  console.log(`[ADMIN] Invalidated ${invalidatedSessions} existing admin session(s)`)
  console.log('[CACHE] Loading persistent leaderboard...');
  await loadLeaderboardFromDatabase();
  const meta = getLeaderboardMeta();
  console.log(`[CACHE] Loaded ${meta.cachedPlayers}/${meta.totalPlayers} event player(s) ✓`);
  return meta;
}
