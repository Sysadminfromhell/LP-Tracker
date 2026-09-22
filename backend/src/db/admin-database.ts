import type { Pool } from 'pg';
import type {
  AdminDatabaseOverviewResponse,
  AdminDatabaseTableOverview,
} from '@lp-tracker/contracts';
import { getAdminDatabaseRelationships } from './admin-database-relationships';
import { db } from './client';

type QueryClient = Pick<Pool, 'query'>;

interface DatabaseInfoRow {
  database_name: string;
  server_version: string;
  database_size_bytes: string;
}
interface DatabaseTableRow {
  table_name: string;
  estimated_rows: string;
  dead_rows: string;
  table_size_bytes: string;
  index_size_bytes: string;
  total_size_bytes: string;
  index_count: string;
  invalid_index_count: string;
  last_vacuum: Date | null;
  last_autovacuum: Date | null;
  last_analyze: Date | null;
  last_autoanalyze: Date | null;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid PostgreSQL statistic: ${value}`);
  }
  return parsed;
}
function toIsoString(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}
export async function getAdminDatabaseOverview(
  client: QueryClient = db,
): Promise<AdminDatabaseOverviewResponse> {
  const infoResult = await client.query<DatabaseInfoRow>(
    `
      SELECT
        current_database() AS database_name,
        current_setting('server_version') AS server_version,
        pg_database_size(current_database())::TEXT AS database_size_bytes
    `,
  );
  const tableResult = await client.query<DatabaseTableRow>(
    `
      SELECT
        stats.relname AS table_name,
        stats.n_live_tup::TEXT AS estimated_rows,
        stats.n_dead_tup::TEXT AS dead_rows,
        pg_relation_size(stats.relid)::TEXT AS table_size_bytes,
        pg_indexes_size(stats.relid)::TEXT AS index_size_bytes,
        pg_total_relation_size(stats.relid)::TEXT AS total_size_bytes,
        COALESCE(indexes.index_count, 0)::TEXT AS index_count,
        COALESCE(indexes.invalid_index_count, 0)::TEXT AS invalid_index_count,
        stats.last_vacuum,
        stats.last_autovacuum,
        stats.last_analyze,
        stats.last_autoanalyze
      FROM pg_stat_user_tables stats
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS index_count,
          COUNT(*) FILTER (
            WHERE
              NOT index_state.indisvalid
              OR NOT index_state.indisready
          ) AS invalid_index_count
        FROM pg_index index_state
        WHERE index_state.indrelid = stats.relid
      ) indexes
        ON TRUE
      WHERE stats.schemaname = 'public'
      ORDER BY
        pg_total_relation_size(stats.relid) DESC,
        stats.relname
    `,
  );
  const info = infoResult.rows[0];
  if (!info) {
    throw new Error('PostgreSQL did not return database information');
  }
  const tables = tableResult.rows.map<AdminDatabaseTableOverview>((row) => ({
    name: row.table_name,
    estimatedRows: toNumber(row.estimated_rows),
    deadRows: toNumber(row.dead_rows),
    tableSizeBytes: toNumber(row.table_size_bytes),
    indexSizeBytes: toNumber(row.index_size_bytes),
    totalSizeBytes: toNumber(row.total_size_bytes),
    indexCount: toNumber(row.index_count),
    invalidIndexCount: toNumber(row.invalid_index_count),
    lastVacuumAt: toIsoString(row.last_vacuum),
    lastAutovacuumAt: toIsoString(row.last_autovacuum),
    lastAnalyzeAt: toIsoString(row.last_analyze),
    lastAutoanalyzeAt: toIsoString(row.last_autoanalyze),
  }));
  const relationships = await getAdminDatabaseRelationships(client);
  return {
    database: {
      name: info.database_name,
      serverVersion: info.server_version,
      sizeBytes: toNumber(info.database_size_bytes),
    },
    totals: {
      tables: tables.length,
      indexes: tables.reduce((total, table) => total + table.indexCount, 0),
      invalidIndexes: tables.reduce((total, table) => total + table.invalidIndexCount, 0),
      estimatedRows: tables.reduce((total, table) => total + table.estimatedRows, 0),
      deadRows: tables.reduce((total, table) => total + table.deadRows, 0),
      tableSizeBytes: tables.reduce((total, table) => total + table.tableSizeBytes, 0),
      indexSizeBytes: tables.reduce((total, table) => total + table.indexSizeBytes, 0),
      totalSizeBytes: tables.reduce((total, table) => total + table.totalSizeBytes, 0),
    },
    tables,
    relationships,
  };
}
