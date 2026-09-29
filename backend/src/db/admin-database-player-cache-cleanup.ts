import type { Pool } from 'pg';
import type { AdminDatabasePlayerCacheCleanupResponse } from '@lp-tracker/contracts';
import { db } from './client';
import { log } from '../utils/logging';

let caller = 'ADMIN DATABASE';

type DatabasePool = Pick<Pool, 'connect'>;

interface PlayerCacheCountRow {
  entry_count: string;
}

function parseEntryCount(value: string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid player cache entry count: ${value}`);
  }
  return count;
}

export async function clearAdminDatabasePlayerCache(
  pool: DatabasePool = db,
): Promise<AdminDatabasePlayerCacheCleanupResponse> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const countResult = await client.query<PlayerCacheCountRow>(
      `
        SELECT COUNT(*)::TEXT AS entry_count
        FROM "public"."player_cache"
      `,
    );
    const row = countResult.rows[0];
    if (!row) {
      throw new Error('Failed to count player cache entries');
    }
    const clearedEntries = parseEntryCount(row.entry_count);
    await client.query('TRUNCATE TABLE "public"."player_cache"');
    await client.query('COMMIT');
    return {
      clearedEntries,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    log(caller, 'error', `Error occoured, try to rollback...`);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      log(caller,'error','Player cache cleanup rollback failed:' + rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
