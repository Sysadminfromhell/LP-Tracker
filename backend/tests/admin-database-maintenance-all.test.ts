import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  runAdminDatabaseMaintenance: vi.fn(),
  getAdminDatabaseTableDefinitions: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));
vi.mock('../src/db/admin-database-maintenance', () => ({
  runAdminDatabaseMaintenance: mocks.runAdminDatabaseMaintenance,
}));
vi.mock('../src/db/admin-database-registry', () => ({
  getAdminDatabaseTableDefinitions: mocks.getAdminDatabaseTableDefinitions,
}));

import { runAdminDatabaseMaintenanceAll } from '../src/db/admin-database-maintenance-all';

describe('admin database maintenance all', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.runAdminDatabaseMaintenance.mockReset();
    mocks.getAdminDatabaseTableDefinitions.mockReset();
    mocks.getAdminDatabaseTableDefinitions.mockReturnValue([
      {
        name: 'players',
        schema: 'public',
        label: 'Players',
        group: 'core',
        sensitive: false,
        maintenance: true,
      },
      {
        name: 'event_matches',
        schema: 'public',
        label: 'Event Matches',
        group: 'matches',
        sensitive: false,
        maintenance: true,
      },
      {
        name: 'admin_sessions',
        schema: 'public',
        label: 'Admin Sessions',
        group: 'system',
        sensitive: true,
        maintenance: true,
      },
      {
        name: 'schema_migrations',
        schema: 'public',
        label: 'Schema Migrations',
        group: 'system',
        sensitive: true,
        maintenance: false,
      },
    ]);
    mocks.runAdminDatabaseMaintenance.mockImplementation(
      async (tableName: string, operation: string) => ({
        tableName,
        operation,
        completedAt: '2026-09-22T14:00:00.000Z',
      }),
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T14:30:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('runs maintenance for every enabled table and skips disabled tables', async () => {
    const result = await runAdminDatabaseMaintenanceAll('analyze');
    expect(mocks.runAdminDatabaseMaintenance).toHaveBeenCalledTimes(3);
    expect(mocks.runAdminDatabaseMaintenance.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      ['players', 'analyze'],
      ['event_matches', 'analyze'],
      ['admin_sessions', 'analyze'],
    ]);
    expect(
      mocks.runAdminDatabaseMaintenance.mock.calls.some((call) => call[0] === 'schema_migrations'),
    ).toBe(false);
    expect(result).toEqual({
      operation: 'analyze',
      completedAt: '2026-09-22T14:30:00.000Z',
      results: [
        {
          tableName: 'players',
          completed: true,
          error: null,
        },
        {
          tableName: 'event_matches',
          completed: true,
          error: null,
        },
        {
          tableName: 'admin_sessions',
          completed: true,
          error: null,
        },
      ],
    });
  });
  it('runs table maintenance sequentially', async () => {
    let active = 0;
    let maxActive = 0;
    mocks.runAdminDatabaseMaintenance.mockImplementation(
      async (tableName: string, operation: string) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active -= 1;
        return {
          tableName,
          operation,
          completedAt: '2026-09-22T14:00:00.000Z',
        };
      },
    );
    await runAdminDatabaseMaintenanceAll('vacuum_analyze');
    expect(maxActive).toBe(1);
  });
  it('continues with remaining tables when one table fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.runAdminDatabaseMaintenance
      .mockResolvedValueOnce({
        tableName: 'players',
        operation: 'reindex_concurrently',
        completedAt: '2026-09-22T14:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('REINDEX failed'))
      .mockResolvedValueOnce({
        tableName: 'admin_sessions',
        operation: 'reindex_concurrently',
        completedAt: '2026-09-22T14:00:00.000Z',
      });
    const result = await runAdminDatabaseMaintenanceAll('reindex_concurrently');
    expect(mocks.runAdminDatabaseMaintenance).toHaveBeenCalledTimes(3);
    expect(result.results).toEqual([
      {
        tableName: 'players',
        completed: true,
        error: null,
      },
      {
        tableName: 'event_matches',
        completed: false,
        error: 'Maintenance operation failed',
      },
      {
        tableName: 'admin_sessions',
        completed: true,
        error: null,
      },
    ]);
  });
  it('marks a rejected maintenance result as failed', async () => {
    mocks.runAdminDatabaseMaintenance
      .mockResolvedValueOnce({
        tableName: 'players',
        operation: 'analyze',
        completedAt: '2026-09-22T14:00:00.000Z',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        tableName: 'admin_sessions',
        operation: 'analyze',
        completedAt: '2026-09-22T14:00:00.000Z',
      });
    const result = await runAdminDatabaseMaintenanceAll('analyze');
    expect(result.results[1]).toEqual({
      tableName: 'event_matches',
      completed: false,
      error: 'Maintenance operation not allowed',
    });
    expect(mocks.runAdminDatabaseMaintenance).toHaveBeenCalledTimes(3);
  });
});
