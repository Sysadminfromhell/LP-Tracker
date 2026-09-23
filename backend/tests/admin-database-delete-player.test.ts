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

import { deleteAdminDatabasePlayer } from '../src/db/admin-database-delete-player';

describe('admin database delete player', () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: mocks.release,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T14:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('deletes a player without event participations', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            game_name: 'Mante',
            tag_line: 'Pog',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            participation_count: '0',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await deleteAdminDatabasePlayer(42);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledTimes(5);
    expect(mocks.query.mock.calls[0]?.[0]).toBe('BEGIN');
    const playerSql = String(mocks.query.mock.calls[1]?.[0]);
    const dependencySql = String(mocks.query.mock.calls[2]?.[0]);
    const deleteSql = String(mocks.query.mock.calls[3]?.[0]);
    expect(playerSql).toContain('FROM "public"."players"');
    expect(playerSql).toContain('FOR UPDATE');
    expect(dependencySql).toContain('FROM "public"."event_participants"');
    expect(deleteSql).toContain('DELETE FROM "public"."players"');
    expect(mocks.query.mock.calls[1]?.[1]).toEqual([42]);
    expect(mocks.query.mock.calls[2]?.[1]).toEqual([42]);
    expect(mocks.query.mock.calls[3]?.[1]).toEqual([42]);
    expect(mocks.query.mock.calls[4]?.[0]).toBe('COMMIT');
    expect(result).toEqual({
      playerId: 42,
      playerName: 'Mante#Pog',
      deletedAt: '2026-09-23T14:00:00.000Z',
    });
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('does not inspect or block event selections', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            game_name: 'Mante',
            tag_line: 'Pog',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            participation_count: '0',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [] });
    await deleteAdminDatabasePlayer(42);
    const allSql = mocks.query.mock.calls.map((call) => String(call[0])).join('\n');
    expect(allSql).not.toContain('FROM "public"."event_player_selections"');
    expect(allSql).toContain('DELETE FROM "public"."players"');
  });
  it('blocks deleting a player with event history', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            game_name: 'Mante',
            tag_line: 'Pog',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            participation_count: '1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabasePlayer(42)).rejects.toThrow('PLAYER_HAS_EVENT_HISTORY');
    expect(mocks.query).toHaveBeenCalledTimes(4);
    const allSql = mocks.query.mock.calls.map((call) => String(call[0])).join('\n');
    expect(allSql).not.toContain('DELETE FROM "public"."players"');
    expect(mocks.query.mock.calls[3]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('returns not found for an unknown player', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabasePlayer(42)).rejects.toThrow('PLAYER_NOT_FOUND');
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[2]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid player id %s before connecting',
    async (playerId) => {
      await expect(deleteAdminDatabasePlayer(playerId)).rejects.toThrow('INVALID_PLAYER_ID');
      expect(mocks.connect).not.toHaveBeenCalled();
    },
  );
  it('rejects an invalid participation count', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            game_name: 'Mante',
            tag_line: 'Pog',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            participation_count: '-1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabasePlayer(42)).rejects.toThrow('INVALID_PLAYER_DEPENDENCY_COUNT');
    expect(mocks.query.mock.calls[3]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back when the player was not deleted', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            game_name: 'Mante',
            tag_line: 'Pog',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            participation_count: '0',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabasePlayer(42)).rejects.toThrow('PLAYER_DELETE_FAILED');
    expect(mocks.query.mock.calls[4]?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back when deleting the player fails', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '42',
            game_name: 'Mante',
            tag_line: 'Pog',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            participation_count: '0',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('DELETE failed'))
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteAdminDatabasePlayer(42)).rejects.toThrow('DELETE failed');
    expect(mocks.query.mock.calls[4]?.[0]).toBe('ROLLBACK');
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
            game_name: 'Mante',
            tag_line: 'Pog',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            participation_count: '0',
          },
        ],
      })
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(new Error('ROLLBACK failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(deleteAdminDatabasePlayer(42)).rejects.toBe(error);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
