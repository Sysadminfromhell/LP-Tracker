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

import { deleteAdminDatabaseEndedEvent } from '../src/db/admin-database-delete-ended-event';

describe('admin database delete ended event', () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: mocks.release,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T13:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('deletes an ended event in one transaction', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            name: 'August LP Event',
            status: 'ended',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await deleteAdminDatabaseEndedEvent(42);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls[0]?.[0]).toBe('BEGIN');
    const selectSql = String(mocks.query.mock.calls[1]?.[0]);
    const deleteSql = String(mocks.query.mock.calls[2]?.[0]);
    expect(selectSql).toContain('FROM "public"."events"');
    expect(selectSql).toContain('FOR UPDATE');
    expect(deleteSql).toContain('DELETE FROM "public"."events"');
    expect(deleteSql).toContain("status = 'ended'");
    expect(mocks.query.mock.calls[1]?.[1]).toEqual([42]);
    expect(mocks.query.mock.calls[2]?.[1]).toEqual([42]);
    expect(mocks.query.mock.calls[3]?.[0]).toBe('COMMIT');
    expect(result).toEqual({
      eventId: 42,
      eventName: 'August LP Event',
      deletedAt: '2026-09-23T13:00:00.000Z',
    });
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid event id %s before connecting',
    async (eventId) => {
      await expect(deleteAdminDatabaseEndedEvent(eventId)).rejects.toThrow('INVALID_EVENT_ID');
      expect(mocks.connect).not.toHaveBeenCalled();
    },
  );
  it('rejects an unknown event and rolls back', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabaseEndedEvent(42)).rejects.toThrow('EVENT_NOT_FOUND');
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it.each(['draft', 'scheduled', 'active'])('rejects a %s event and rolls back', async (status) => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            name: 'Protected Event',
            status,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabaseEndedEvent(42)).rejects.toThrow('EVENT_NOT_ENDED');
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back when the ended event was not deleted', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            name: 'August LP Event',
            status: 'ended',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabaseEndedEvent(42)).rejects.toThrow('EVENT_DELETE_FAILED');
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls[3]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back when deleting the event fails', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            name: 'August LP Event',
            status: 'ended',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('DELETE failed'))
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabaseEndedEvent(42)).rejects.toThrow('DELETE failed');
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
            id: '42',
            name: 'August LP Event',
            status: 'ended',
          },
        ],
      })
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(new Error('ROLLBACK failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(deleteAdminDatabaseEndedEvent(42)).rejects.toBe(error);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
