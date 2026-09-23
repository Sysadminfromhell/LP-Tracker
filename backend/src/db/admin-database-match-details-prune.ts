import type { Pool } from 'pg';
import type { AdminDatabaseMatchDetailsPruneResponse } from '@lp-tracker/contracts';
import { db } from './client';

type DatabasePool = Pick<Pool, 'connect'>;

interface PruneCountRow {
  detail_count: string;
  participant_count: string;
}

function parseCount(value: string): number {
  const count = Number(value);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid prune count: ${value}`);
  }

  return count;
}
function validateOlderThanDays(value: number): void {
  if (!Number.isSafeInteger(value) || value < 7 || value > 3650) {
    throw new Error('olderThanDays must be an integer between 7 and 3650');
  }
}
export async function pruneAdminDatabaseMatchDetails(
  olderThanDays: number,
  pool: DatabasePool = db,
): Promise<AdminDatabaseMatchDetailsPruneResponse> {
  validateOlderThanDays(olderThanDays);
  const cutoffAt = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const countResult = await client.query<PruneCountRow>(
      `
        SELECT
          (
            SELECT COUNT(*)::TEXT
            FROM "public"."event_match_details" details
            JOIN "public"."event_matches" matches
              ON matches.id = details.event_match_id
            JOIN "public"."event_participants" participants
              ON participants.id = matches.event_participant_id
            JOIN "public"."events" events
              ON events.id = participants.event_id
            WHERE
              events.status = 'ended'
              AND events.ends_at IS NOT NULL
              AND events.ends_at < $1
          ) AS detail_count,
          (
            SELECT COUNT(*)::TEXT
            FROM "public"."event_match_participants" match_participants
            JOIN "public"."event_match_details" details
              ON details.event_match_id = match_participants.event_match_id
            JOIN "public"."event_matches" matches
              ON matches.id = details.event_match_id
            JOIN "public"."event_participants" participants
              ON participants.id = matches.event_participant_id
            JOIN "public"."events" events
              ON events.id = participants.event_id
            WHERE
              events.status = 'ended'
              AND events.ends_at IS NOT NULL
              AND events.ends_at < $1
          ) AS participant_count
      `,
      [cutoffAt],
    );
    const row = countResult.rows[0];
    if (!row) {
      throw new Error('Failed to count historical match details');
    }
    const deletedMatchParticipants = parseCount(row.participant_count);
    const deleteResult = await client.query(
      `
        DELETE FROM "public"."event_match_details" details
        USING
          "public"."event_matches" matches,
          "public"."event_participants" participants,
          "public"."events" events
        WHERE
          matches.id = details.event_match_id
          AND participants.id = matches.event_participant_id
          AND events.id = participants.event_id
          AND events.status = 'ended'
          AND events.ends_at IS NOT NULL
          AND events.ends_at < $1
      `,
      [cutoffAt],
    );
    const deletedMatchDetails = deleteResult.rowCount ?? 0;
    await client.query('COMMIT');
    return {
      olderThanDays,
      cutoffAt: cutoffAt.toISOString(),
      deletedMatchDetails,
      deletedMatchParticipants,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[ADMIN DATABASE] Match details prune rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
