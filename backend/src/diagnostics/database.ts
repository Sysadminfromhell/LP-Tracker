import fs from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';
import { db } from '../db/client';
import type { DiagnosticCheck, DiagnosticReport, DiagnosticStatus } from './types';

type QueryClient = Pick<Pool, 'query'>;

interface DatabaseInfoRow {
  database_name: string;
  database_user: string;
  server_version: string;
  server_version_num: string;
}
interface TableRow {
  tablename: string;
}
interface MigrationRow {
  name: string;
}

const REQUIRED_TABLES = [
  'legal_pages',
  'admins',
  'admin_sessions',
  'event_match_details',
  'event_matches',
  'event_participants',
  'event_player_selections',
  'events',
  'lp_rank_observations',
  'lp_reconciliation_queue',
  'player_cache',
  'players',
  'schema_migrations',
] as const;

function getReportStatus(checks: DiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === 'error')) {
    return 'error';
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }
  return 'ok';
}
export function getLocalMigrationFiles(): string[] {
  const directory = path.resolve(__dirname, '../../migrations');
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

export async function runDatabaseDiagnostics(
  client: QueryClient = db,
  localMigrationFiles = getLocalMigrationFiles(),
): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];
  const infoResult = await client.query<DatabaseInfoRow>(
    `
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        current_setting('server_version') AS server_version,
        current_setting('server_version_num') AS server_version_num
    `,
  );
  const info = infoResult.rows[0];
  checks.push({
    code: 'DATABASE_CONNECTION',
    status: 'ok',
    message: `Connected to PostgreSQL ${info.server_version}`,
    details: {
      database: info.database_name,
      user: info.database_user,
      serverVersion: info.server_version,
      serverVersionNumber: Number(info.server_version_num),
    },
  });
  const tablesResult = await client.query<TableRow>(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `,
  );
  const existingTables = new Set(tablesResult.rows.map((row) => row.tablename));
  const missingTables = REQUIRED_TABLES.filter((table) => !existingTables.has(table));
  checks.push({
    code: 'DATABASE_SCHEMA',
    status: missingTables.length > 0 ? 'error' : 'ok',
    message:
      missingTables.length > 0
        ? `${missingTables.length} required table(s) are missing`
        : 'All required database tables exist',
    details:
      missingTables.length > 0
        ? {
            missing: missingTables,
          }
        : undefined,
  });
  if (!existingTables.has('schema_migrations')) {
    return {
      scope: 'database',
      generatedAt: new Date().toISOString(),
      status: getReportStatus(checks),
      checks,
    };
  }
  const migrationsResult = await client.query<MigrationRow>(
    `
      SELECT name
      FROM schema_migrations
      ORDER BY name
    `,
  );
  const appliedMigrations = new Set(migrationsResult.rows.map((row) => row.name));
  const pendingMigrations = localMigrationFiles.filter(
    (migration) => !appliedMigrations.has(migration),
  );
  const unknownMigrations = migrationsResult.rows
    .map((row) => row.name)
    .filter((migration) => !localMigrationFiles.includes(migration));
  checks.push({
    code: 'DATABASE_MIGRATIONS',
    status: pendingMigrations.length > 0 || unknownMigrations.length > 0 ? 'warning' : 'ok',
    message:
      pendingMigrations.length > 0
        ? `${pendingMigrations.length} local migration(s) have not been applied`
        : unknownMigrations.length > 0
          ? `${unknownMigrations.length} applied migration(s) are not present in this build`
          : 'Database migrations are up to date',
    details: {
      local: localMigrationFiles.length,
      applied: migrationsResult.rows.length,
      pending: pendingMigrations,
      unknown: unknownMigrations,
    },
  });
  return {
    scope: 'database',
    generatedAt: new Date().toISOString(),
    status: getReportStatus(checks),
    checks,
  };
}
