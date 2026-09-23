import type { Pool } from 'pg';
import type { AdminDatabaseResetResponse } from '@lp-tracker/contracts';
import { db } from './client';

type DatabasePool = Pick<Pool, 'connect'>;

export const ADMIN_DATABASE_RESET_TABLES = [
  'player_cache',
  'event_match_participants',
  'event_match_details',
  'event_matches',
  'lp_rank_observations',
  'lp_reconciliation_queue',
  'event_player_selections',
  'event_participants',
  'events',
  'players',
  'admin_sessions',
  'admins',
] as const;
const RESET_SQL = `
  TRUNCATE TABLE
    "public"."player_cache",
    "public"."event_match_participants",
    "public"."event_match_details",
    "public"."event_matches",
    "public"."lp_rank_observations",
    "public"."lp_reconciliation_queue",
    "public"."event_player_selections",
    "public"."event_participants",
    "public"."events",
    "public"."players",
    "public"."admin_sessions",
    "public"."admins"
  RESTART IDENTITY
  CASCADE
`;

export async function resetAdminDatabase(
  pool: DatabasePool = db,
): Promise<AdminDatabaseResetResponse> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(RESET_SQL);
    await client.query('COMMIT');
    return {
      resetAt: new Date().toISOString(),
      restartRequired: true,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[ADMIN DATABASE] Reset rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
