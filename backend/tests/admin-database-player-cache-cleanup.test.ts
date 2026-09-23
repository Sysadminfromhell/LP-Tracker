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

import { clearAdminDatabasePlayerCache } from '../src/db/admin-database-player-cache-cleanup';

describe('admin database player cache cleanup', () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: mocks.release,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T11:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('counts and clears player cache entries in one transaction', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            entry_count: '42',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await clearAdminDatabasePlayerCache();
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(String(mocks.query.mock.calls[1]?.[0])).toContain('FROM "public"."player_cache"');
    expect(mocks.query.mock.calls[2]?.[0]).toBe('TRUNCATE TABLE "public"."player_cache"');
    expect(mocks.query.mock.calls[3]?.[0]).toBe('COMMIT');
    expect(result).toEqual({
      clearedEntries: 42,
      completedAt: '2026-09-23T11:00:00.000Z',
    });
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('successfully clears an empty player cache', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            entry_count: '0',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await clearAdminDatabasePlayerCache();
    expect(result).toEqual({
      clearedEntries: 0,
      completedAt: '2026-09-23T11:00:00.000Z',
    });
    expect(mocks.query.mock.calls[2]?.[0]).toBe('TRUNCATE TABLE "public"."player_cache"');
  });
  it('rejects invalid player cache counts', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            entry_count: '-1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(clearAdminDatabasePlayerCache()).rejects.toThrow(
      'Invalid player cache entry count: -1',
    );
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rejects missing count results', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(clearAdminDatabasePlayerCache()).rejects.toThrow(
      'Failed to count player cache entries',
    );
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back when truncating the player cache fails', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            entry_count: '12',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('TRUNCATE failed'))
      .mockResolvedValueOnce({ rows: [] });
    await expect(clearAdminDatabasePlayerCache()).rejects.toThrow('TRUNCATE failed');
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls[3]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('releases the connection when rollback also fails', async () => {
    const error = new Error('TRUNCATE failed');
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            entry_count: '12',
          },
        ],
      })
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(new Error('ROLLBACK failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(clearAdminDatabasePlayerCache()).rejects.toBe(error);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
