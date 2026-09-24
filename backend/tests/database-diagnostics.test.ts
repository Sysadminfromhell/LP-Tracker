import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import { runDatabaseDiagnostics } from '../src/diagnostics/database';

const requiredTables = [
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
];

const localMigrations = ['001_initial.sql', '002_admin.sql', '003_example.sql'];

function mockDatabaseInfo(): void {
  mocks.query.mockResolvedValueOnce({
    rows: [
      {
        database_name: 'lp_tracker',
        database_user: 'lp_tracker',
        server_version: '18.6',
        server_version_num: '180006',
      },
    ],
  });
}

describe('database diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns a clean report for a healthy database', async () => {
    mockDatabaseInfo();
    mocks.query
      .mockResolvedValueOnce({
        rows: requiredTables.map((tablename) => ({ tablename })),
      })
      .mockResolvedValueOnce({
        rows: localMigrations.map((name) => ({ name })),
      });
    const report = await runDatabaseDiagnostics(mocks, localMigrations);
    expect(report.scope).toBe('database');
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual([
      {
        code: 'DATABASE_CONNECTION',
        status: 'ok',
        message: 'Connected to PostgreSQL 18.6',
        details: {
          database: 'lp_tracker',
          user: 'lp_tracker',
          serverVersion: '18.6',
          serverVersionNumber: 180006,
        },
      },
      {
        code: 'DATABASE_SCHEMA',
        status: 'ok',
        message: 'All required database tables exist',
        details: undefined,
      },
      {
        code: 'DATABASE_MIGRATIONS',
        status: 'ok',
        message: 'Database migrations are up to date',
        details: {
          local: 3,
          applied: 3,
          pending: [],
          unknown: [],
        },
      },
    ]);
  });
  it('reports missing required tables as an error', async () => {
    mockDatabaseInfo();
    mocks.query
      .mockResolvedValueOnce({
        rows: requiredTables
          .filter((table) => table !== 'event_matches')
          .map((tablename) => ({ tablename })),
      })
      .mockResolvedValueOnce({
        rows: localMigrations.map((name) => ({ name })),
      });
    const report = await runDatabaseDiagnostics(mocks, localMigrations);
    expect(report.status).toBe('error');
    expect(report.checks).toContainEqual({
      code: 'DATABASE_SCHEMA',
      status: 'error',
      message: '1 required table(s) are missing',
      details: {
        missing: ['event_matches'],
      },
    });
  });
  it('stops migration inspection when schema_migrations is missing', async () => {
    mockDatabaseInfo();
    mocks.query.mockResolvedValueOnce({
      rows: requiredTables
        .filter((table) => table !== 'schema_migrations')
        .map((tablename) => ({ tablename })),
    });
    const report = await runDatabaseDiagnostics(mocks, localMigrations);
    expect(report.status).toBe('error');
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(report.checks.some((check) => check.code === 'DATABASE_MIGRATIONS')).toBe(false);
  });
  it('warns when local migrations have not been applied', async () => {
    mockDatabaseInfo();
    mocks.query
      .mockResolvedValueOnce({
        rows: requiredTables.map((tablename) => ({ tablename })),
      })
      .mockResolvedValueOnce({
        rows: [{ name: '001_initial.sql' }, { name: '002_admin.sql' }],
      });
    const report = await runDatabaseDiagnostics(mocks, localMigrations);
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'DATABASE_MIGRATIONS',
      status: 'warning',
      message: '1 local migration(s) have not been applied',
      details: {
        local: 3,
        applied: 2,
        pending: ['003_example.sql'],
        unknown: [],
      },
    });
  });
  it('warns when the database contains an unknown migration', async () => {
    mockDatabaseInfo();
    mocks.query
      .mockResolvedValueOnce({
        rows: requiredTables.map((tablename) => ({ tablename })),
      })
      .mockResolvedValueOnce({
        rows: [...localMigrations.map((name) => ({ name })), { name: '999_manual.sql' }],
      });
    const report = await runDatabaseDiagnostics(mocks, localMigrations);
    expect(report.status).toBe('warning');
    expect(report.checks).toContainEqual({
      code: 'DATABASE_MIGRATIONS',
      status: 'warning',
      message: '1 applied migration(s) are not present in this build',
      details: {
        local: 3,
        applied: 4,
        pending: [],
        unknown: ['999_manual.sql'],
      },
    });
  });
});
