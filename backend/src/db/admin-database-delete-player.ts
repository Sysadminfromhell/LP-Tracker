import type { Pool } from 'pg';
import type { AdminDatabaseDeletePlayerResponse } from '@lp-tracker/contracts';
import { db } from './client';

type DatabasePool = Pick<Pool, 'connect'>;

interface PlayerRow {
  id: string;
  game_name: string;
  tag_line: string;
}
interface ParticipationCountRow {
  participation_count: string;
}

function parseCount(value: string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('INVALID_PLAYER_DEPENDENCY_COUNT');
  }
  return count;
}
export async function deleteAdminDatabasePlayer(
  playerId: number,
  pool: DatabasePool = db,
): Promise<AdminDatabaseDeletePlayerResponse> {
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new Error('INVALID_PLAYER_ID');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const playerResult = await client.query<PlayerRow>(
      `
        SELECT
          id,
          game_name,
          tag_line
        FROM "public"."players"
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [playerId],
    );
    const player = playerResult.rows[0];
    if (!player) {
      throw new Error('PLAYER_NOT_FOUND');
    }
    const dependencyResult = await client.query<ParticipationCountRow>(
      `
          SELECT COUNT(*)::TEXT AS participation_count
          FROM "public"."event_participants"
          WHERE player_id = $1
        `,
      [playerId],
    );
    const participationCount = parseCount(dependencyResult.rows[0]?.participation_count);
    if (participationCount > 0) {
      throw new Error('PLAYER_HAS_EVENT_HISTORY');
    }
    const deleteResult = await client.query(
      `
        DELETE FROM "public"."players"
        WHERE id = $1
      `,
      [playerId],
    );
    if (deleteResult.rowCount !== 1) {
      throw new Error('PLAYER_DELETE_FAILED');
    }
    await client.query('COMMIT');
    return {
      playerId,
      playerName: `${player.game_name}#${player.tag_line}`,
      deletedAt: new Date().toISOString(),
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[ADMIN DATABASE] Player delete rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
