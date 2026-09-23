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

import { pruneAdminDatabaseMatchDetails } from '../src/db/admin-database-match-details-prune';

describe('admin database match details prune', () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: mocks.release,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('prunes historical match details for ended events', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '12',
            participant_count: '120',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 12,
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await pruneAdminDatabaseMatchDetails(90);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(mocks.query.mock.calls[3]?.[0]).toBe('COMMIT');
    expect(result).toEqual({
      olderThanDays: 90,
      cutoffAt: '2026-06-25T12:00:00.000Z',
      deletedMatchDetails: 12,
      deletedMatchParticipants: 120,
      completedAt: '2026-09-23T12:00:00.000Z',
    });
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('uses the same cutoff for counting and deleting', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '1',
            participant_count: '10',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [] });
    await pruneAdminDatabaseMatchDetails(30);
    const countParams = mocks.query.mock.calls[1]?.[1];
    const deleteParams = mocks.query.mock.calls[2]?.[1];
    expect(countParams).toHaveLength(1);
    expect(deleteParams).toHaveLength(1);
    expect(countParams?.[0]).toEqual(new Date('2026-08-24T12:00:00.000Z'));
    expect(deleteParams?.[0]).toEqual(new Date('2026-08-24T12:00:00.000Z'));
  });
  it('restricts pruning to ended events with a completed end timestamp', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '0',
            participant_count: '0',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      })
      .mockResolvedValueOnce({ rows: [] });
    await pruneAdminDatabaseMatchDetails(90);
    const countSql = String(mocks.query.mock.calls[1]?.[0]);
    const deleteSql = String(mocks.query.mock.calls[2]?.[0]);
    for (const sql of [countSql, deleteSql]) {
      expect(sql).toContain("events.status = 'ended'");
      expect(sql).toContain('events.ends_at IS NOT NULL');
      expect(sql).toContain('events.ends_at < $1');
    }
  });
  it('does not delete event_matches themselves', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '2',
            participant_count: '20',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 2,
      })
      .mockResolvedValueOnce({ rows: [] });
    await pruneAdminDatabaseMatchDetails(90);
    const deleteSql = String(mocks.query.mock.calls[2]?.[0]);
    expect(deleteSql).toContain('DELETE FROM "public"."event_match_details"');
    expect(deleteSql).not.toContain('DELETE FROM "public"."event_matches"');
    expect(deleteSql).not.toContain('DELETE FROM "public"."events"');
  });
  it('successfully handles a prune with no matching rows', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '0',
            participant_count: '0',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await pruneAdminDatabaseMatchDetails(90);
    expect(result.deletedMatchDetails).toBe(0);
    expect(result.deletedMatchParticipants).toBe(0);
    expect(mocks.query.mock.calls[3]?.[0]).toBe('COMMIT');
  });
  it.each([0, 1, 6, -1, 3651, 90.5, Number.NaN])(
    'rejects invalid retention value %s',
    async (olderThanDays) => {
      await expect(pruneAdminDatabaseMatchDetails(olderThanDays)).rejects.toThrow(
        'olderThanDays must be an integer between 7 and 3650',
      );
      expect(mocks.connect).not.toHaveBeenCalled();
    },
  );
  it.each([7, 3650])('accepts retention boundary %s days', async (olderThanDays) => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '0',
            participant_count: '0',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(pruneAdminDatabaseMatchDetails(olderThanDays)).resolves.toBeDefined();
  });
  it('rejects invalid participant counts and rolls back', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '1',
            participant_count: '-1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(pruneAdminDatabaseMatchDetails(90)).rejects.toThrow('Invalid prune count: -1');
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rejects missing count results and rolls back', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(pruneAdminDatabaseMatchDetails(90)).rejects.toThrow(
      'Failed to count historical match details',
    );
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back when deleting match details fails', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '4',
            participant_count: '40',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('DELETE failed'))
      .mockResolvedValueOnce({ rows: [] });
    await expect(pruneAdminDatabaseMatchDetails(90)).rejects.toThrow('DELETE failed');
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls[3]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('releases the connection when rollback also fails', async () => {
    const error = new Error('DELETE failed');
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            detail_count: '4',
            participant_count: '40',
          },
        ],
      })
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(new Error('ROLLBACK failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(pruneAdminDatabaseMatchDetails(90)).rejects.toBe(error);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
