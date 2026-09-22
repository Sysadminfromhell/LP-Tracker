import type { Pool } from 'pg';
import type {
  AdminDatabaseMaintenanceOperation,
  AdminDatabaseMaintenanceResponse,
} from '@lp-tracker/contracts';
import { db } from './client';
import {
  getAdminDatabaseTableDefinition,
  isAdminDatabaseTableName,
  type AdminDatabaseTableName,
} from './admin-database-registry';

type QueryClient = Pick<Pool, 'query'>;

const MAINTENANCE_TABLE_SQL: Record<AdminDatabaseTableName, string> = {
  players: '"public"."players"',
  player_cache: '"public"."player_cache"',
  events: '"public"."events"',
  event_player_selections: '"public"."event_player_selections"',
  event_participants: '"public"."event_participants"',
  event_matches: '"public"."event_matches"',
  event_match_details: '"public"."event_match_details"',
  event_match_participants: '"public"."event_match_participants"',
  lp_rank_observations: '"public"."lp_rank_observations"',
  lp_reconciliation_queue: '"public"."lp_reconciliation_queue"',
  admins: '"public"."admins"',
  admin_sessions: '"public"."admin_sessions"',
  schema_migrations: '"public"."schema_migrations"',
};

export function isAdminDatabaseMaintenanceOperation(
  value: string,
): value is AdminDatabaseMaintenanceOperation {
  return value === 'analyze' || value === 'vacuum_analyze' || value === 'reindex_concurrently';
}
export async function runAdminDatabaseMaintenance(
  tableName: string,
  operation: string,
  client: QueryClient = db,
): Promise<AdminDatabaseMaintenanceResponse | null> {
  if (!isAdminDatabaseTableName(tableName)) {
    return null;
  }
  if (!isAdminDatabaseMaintenanceOperation(operation)) {
    return null;
  }
  const definition = getAdminDatabaseTableDefinition(tableName);
  if (!definition.maintenance) {
    return null;
  }
  const sqlTable = MAINTENANCE_TABLE_SQL[tableName];
  switch (operation) {
    case 'analyze':
      await client.query(`ANALYZE ${sqlTable}`);
      break;
    case 'vacuum_analyze':
      await client.query(`VACUUM (ANALYZE) ${sqlTable}`);
      break;
    case 'reindex_concurrently':
      await client.query(`REINDEX TABLE CONCURRENTLY ${sqlTable}`);
      break;
  }
  return {
    tableName,
    operation,
    completedAt: new Date().toISOString(),
  };
}
