import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

import { getAdminDatabasePlayerDeleteDependencies } from '../src/db/admin-database-player-delete-dependencies';

describe('admin database player delete dependencies', () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });
  it('allows deleting a player with no event participations', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: '42',
          game_name: 'Mante',
          tag_line: 'Pog',
          event_selections: '2',
          event_participations: '0',
          active_event_participations: '0',
          ended_event_participations: '0',
        },
      ],
    });
    const result = await getAdminDatabasePlayerDeleteDependencies(42);
    expect(result).toEqual({
      playerId: 42,
      playerName: 'Mante#Pog',
      eventSelections: 2,
      eventParticipations: 0,
      activeEventParticipations: 0,
      endedEventParticipations: 0,
      canDelete: true,
    });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0]?.[1]).toEqual([42]);
  });
  it('blocks deleting a player with ended event history', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: '42',
          game_name: 'Mante',
          tag_line: 'Pog',
          event_selections: '0',
          event_participations: '3',
          active_event_participations: '0',
          ended_event_participations: '3',
        },
      ],
    });
    const result = await getAdminDatabasePlayerDeleteDependencies(42);
    expect(result?.canDelete).toBe(false);
    expect(result?.eventParticipations).toBe(3);
    expect(result?.endedEventParticipations).toBe(3);
  });
  it('blocks deleting a player participating in an active event', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: '42',
          game_name: 'Mante',
          tag_line: 'Pog',
          event_selections: '1',
          event_participations: '1',
          active_event_participations: '1',
          ended_event_participations: '0',
        },
      ],
    });
    const result = await getAdminDatabasePlayerDeleteDependencies(42);
    expect(result?.canDelete).toBe(false);
    expect(result?.activeEventParticipations).toBe(1);
  });
  it('allows scheduled event selections without participations', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: '42',
          game_name: 'Mante',
          tag_line: 'Pog',
          event_selections: '5',
          event_participations: '0',
          active_event_participations: '0',
          ended_event_participations: '0',
        },
      ],
    });
    const result = await getAdminDatabasePlayerDeleteDependencies(42);
    expect(result?.eventSelections).toBe(5);
    expect(result?.canDelete).toBe(true);
  });
  it('returns null when the player does not exist', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [],
    });
    const result = await getAdminDatabasePlayerDeleteDependencies(42);
    expect(result).toBeNull();
  });
  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid player id %s before querying',
    async (playerId) => {
      await expect(getAdminDatabasePlayerDeleteDependencies(playerId)).rejects.toThrow(
        'INVALID_PLAYER_ID',
      );
      expect(mocks.query).not.toHaveBeenCalled();
    },
  );
  it.each([
    'event_selections',
    'event_participations',
    'active_event_participations',
    'ended_event_participations',
  ])('rejects an invalid %s count', async (field) => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: '42',
          game_name: 'Mante',
          tag_line: 'Pog',
          event_selections: '0',
          event_participations: '0',
          active_event_participations: '0',
          ended_event_participations: '0',
          [field]: '-1',
        },
      ],
    });
    await expect(getAdminDatabasePlayerDeleteDependencies(42)).rejects.toThrow(
      'INVALID_PLAYER_DEPENDENCY_COUNT',
    );
  });
  it('counts selections and participations independently', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: '42',
          game_name: 'Mante',
          tag_line: 'Pog',
          event_selections: '4',
          event_participations: '2',
          active_event_participations: '1',
          ended_event_participations: '1',
        },
      ],
    });
    const result = await getAdminDatabasePlayerDeleteDependencies(42);
    expect(result).toEqual({
      playerId: 42,
      playerName: 'Mante#Pog',
      eventSelections: 4,
      eventParticipations: 2,
      activeEventParticipations: 1,
      endedEventParticipations: 1,
      canDelete: false,
    });
  });
});
