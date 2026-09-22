import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    connect: mocks.connect,
  },
}));

import { ADMIN_DATABASE_RESET_TABLES, resetAdminDatabase } from '../src/db/admin-database-reset';

describe('admin database reset', () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: mocks.release,
    });
    mocks.query.mockResolvedValue({
      rows: [],
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T13:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('resets all application tables in one transaction', async () => {
    const result = await resetAdminDatabase();
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(mocks.query.mock.calls[2]?.[0]).toBe('COMMIT');
    const truncateSql = String(mocks.query.mock.calls[1]?.[0]);
    for (const table of ADMIN_DATABASE_RESET_TABLES) {
      expect(truncateSql).toContain(`"public"."${table}"`);
    }
    expect(truncateSql).toContain('TRUNCATE TABLE');
    expect(truncateSql).toContain('RESTART IDENTITY');
    expect(truncateSql).toContain('CASCADE');
    expect(result).toEqual({
      resetAt: '2026-09-22T13:00:00.000Z',
      restartRequired: true,
    });
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('never resets schema_migrations', async () => {
    await resetAdminDatabase();
    const truncateSql = String(mocks.query.mock.calls[1]?.[0]);
    expect(ADMIN_DATABASE_RESET_TABLES).not.toContain('schema_migrations');
    expect(truncateSql).not.toContain('"public"."schema_migrations"');
  });
  it('contains the complete expected application table set', () => {
    expect([...ADMIN_DATABASE_RESET_TABLES].sort()).toEqual(
      [
        'admin_sessions',
        'admins',
        'event_match_details',
        'event_match_participants',
        'event_matches',
        'event_participants',
        'event_player_selections',
        'events',
        'lp_rank_observations',
        'lp_reconciliation_queue',
        'player_cache',
        'players',
      ].sort(),
    );
  });
  it('rolls back when the reset fails', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('TRUNCATE failed'))
      .mockResolvedValueOnce({ rows: [] });
    await expect(resetAdminDatabase()).rejects.toThrow('TRUNCATE failed');
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('releases the database connection when rollback also fails', async () => {
    const error = new Error('TRUNCATE failed');
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(new Error('ROLLBACK failed'));
    await expect(resetAdminDatabase()).rejects.toBe(error);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
