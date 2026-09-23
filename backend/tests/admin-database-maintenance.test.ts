import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import {
  isAdminDatabaseMaintenanceOperation,
  runAdminDatabaseMaintenance,
} from '../src/db/admin-database-maintenance';

describe('admin database maintenance', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.query.mockResolvedValue({ rows: [] });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('runs ANALYZE for an allowed table', async () => {
    const result = await runAdminDatabaseMaintenance('event_matches', 'analyze');
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith('ANALYZE "public"."event_matches"');
    expect(result).toEqual({
      tableName: 'event_matches',
      operation: 'analyze',
      completedAt: '2026-09-22T12:00:00.000Z',
    });
  });
  it('runs VACUUM ANALYZE for an allowed table', async () => {
    const result = await runAdminDatabaseMaintenance('event_matches', 'vacuum_analyze');
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith('VACUUM (ANALYZE) "public"."event_matches"');
    expect(result).toEqual({
      tableName: 'event_matches',
      operation: 'vacuum_analyze',
      completedAt: '2026-09-22T12:00:00.000Z',
    });
  });
  it('runs REINDEX TABLE CONCURRENTLY for an allowed table', async () => {
    const result = await runAdminDatabaseMaintenance('event_matches', 'reindex_concurrently');
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith('REINDEX TABLE CONCURRENTLY "public"."event_matches"');
    expect(result).toEqual({
      tableName: 'event_matches',
      operation: 'reindex_concurrently',
      completedAt: '2026-09-22T12:00:00.000Z',
    });
  });
  it('rejects table names outside the registry without executing SQL', async () => {
    const result = await runAdminDatabaseMaintenance('pg_authid', 'analyze');
    expect(result).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects SQL injection attempts without executing SQL', async () => {
    const result = await runAdminDatabaseMaintenance(
      'event_matches; DROP TABLE players',
      'analyze',
    );
    expect(result).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects tables with maintenance disabled', async () => {
    const result = await runAdminDatabaseMaintenance('schema_migrations', 'analyze');
    expect(result).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects unsupported maintenance operations without executing SQL', async () => {
    const result = await runAdminDatabaseMaintenance('event_matches', 'vacuum_full');
    expect(result).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each(['analyze', 'vacuum_analyze', 'reindex_concurrently'] as const)(
    'accepts maintenance operation %s',
    (operation) => {
      expect(isAdminDatabaseMaintenanceOperation(operation)).toBe(true);
    },
  );
  it('rejects unknown maintenance operations', () => {
    expect(isAdminDatabaseMaintenanceOperation('truncate')).toBe(false);
    expect(isAdminDatabaseMaintenanceOperation('drop')).toBe(false);
    expect(isAdminDatabaseMaintenanceOperation('vacuum_full')).toBe(false);
  });
  it('propagates PostgreSQL maintenance failures', async () => {
    mocks.query.mockRejectedValueOnce(new Error('PostgreSQL maintenance failed'));
    await expect(runAdminDatabaseMaintenance('event_matches', 'analyze')).rejects.toThrow(
      'PostgreSQL maintenance failed',
    );
  });
});
