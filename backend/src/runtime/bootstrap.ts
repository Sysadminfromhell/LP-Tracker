import { testDatabaseConnection } from '../db/client';
import { runMigrations } from '../db/migrations';
import { bootstrapDatabase } from '../db/bootstrap';
import { ensureInitialAdmin } from '../db/admins';
import { deleteAllAdminSessions } from '../db/admin-sessions';
import { getLeaderboardMeta, loadLeaderboardFromDatabase } from '../services/leaderboard.service';
import { log } from '../utils/logging';

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
    log('DB','info',`Application database does not exist, bootstrapping...`);
    await bootstrapDatabase();
    await testDatabaseConnection();
  }
  await runMigrations();
  await ensureInitialAdmin();
  const invalidatedSessions = await deleteAllAdminSessions();
  log('ADMIN','info',`Invalidated ${invalidatedSessions} existing admin session(s)`);
  log('CACHE', 'info',`Loading persistent leaderboard...`);
  await loadLeaderboardFromDatabase();
  const meta = getLeaderboardMeta();
  log('CACHE','info',`Loaded ${meta.cachedPlayers}/${meta.totalPlayers} event player(s)`);
  return meta;
}
