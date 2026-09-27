import { testDatabaseConnection } from '../db/client';
import { runMigrations } from '../db/migrations';
import { bootstrapDatabase } from '../db/bootstrap';
import { ensureInitialAdmin } from '../db/admins';
import { deleteAllAdminSessions } from '../db/admin-sessions';
import { getLeaderboardMeta, loadLeaderboardFromDatabase } from '../services/leaderboard.service';

function getDatabaseErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export async function bootstrapApplication() {
  try {
    await testDatabaseConnection();
  } catch (error) {
    if (getDatabaseErrorCode(error) !== '3D000') {
      throw error;
    }
    console.log('[DB] Application database does not exist, bootstrapping...');
    await bootstrapDatabase();
    await testDatabaseConnection();
  }
  await runMigrations();
  await ensureInitialAdmin();
  const invalidatedSessions = await deleteAllAdminSessions();
  console.log(`[ADMIN] Invalidated ${invalidatedSessions} existing admin session(s)`);
  console.log('[CACHE] Loading persistent leaderboard...');
  await loadLeaderboardFromDatabase();
  const meta = getLeaderboardMeta();
  console.log(`[CACHE] Loaded ${meta.cachedPlayers}/${meta.totalPlayers} event player(s) ✓`);
  return meta;
}
