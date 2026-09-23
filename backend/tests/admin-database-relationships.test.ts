import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { getAdminDatabaseRelationships } from '../src/db/admin-database-relationships';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));

type QueryClient = Pick<Pool, 'query'>;

function createClient(rows: unknown[]): QueryClient {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as QueryClient;
}

describe('admin database relationships', () => {
  it('returns registered foreign key relationships', async () => {
    const client = createClient([
      {
        constraint_name: 'event_matches_event_participant_id_fkey',
        source_table: 'event_matches',
        source_columns: ['event_participant_id'],
        target_table: 'event_participants',
        target_columns: ['id'],
        update_action: 'a',
        delete_action: 'c',
      },
    ]);
    await expect(getAdminDatabaseRelationships(client)).resolves.toEqual([
      {
        constraintName: 'event_matches_event_participant_id_fkey',
        sourceTable: 'event_matches',
        sourceColumns: ['event_participant_id'],
        targetTable: 'event_participants',
        targetColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
    ]);
  });
  it('preserves composite foreign key columns', async () => {
    const client = createClient([
      {
        constraint_name: 'example_composite_fkey',
        source_table: 'event_player_selections',
        source_columns: ['event_id', 'player_id'],
        target_table: 'event_participants',
        target_columns: ['event_id', 'player_id'],
        update_action: 'r',
        delete_action: 'c',
      },
    ]);
    const relationships = await getAdminDatabaseRelationships(client);
    expect(relationships[0]).toMatchObject({
      sourceColumns: ['event_id', 'player_id'],
      targetColumns: ['event_id', 'player_id'],
      onUpdate: 'RESTRICT',
      onDelete: 'CASCADE',
    });
  });
  it('filters relationships containing unregistered tables', async () => {
    const client = createClient([
      {
        constraint_name: 'foreign_table_fkey',
        source_table: 'foreign_table',
        source_columns: ['player_id'],
        target_table: 'players',
        target_columns: ['id'],
        update_action: 'a',
        delete_action: 'c',
      },
      {
        constraint_name: 'players_foreign_table_fkey',
        source_table: 'players',
        source_columns: ['id'],
        target_table: 'foreign_table',
        target_columns: ['player_id'],
        update_action: 'a',
        delete_action: 'c',
      },
    ]);
    await expect(getAdminDatabaseRelationships(client)).resolves.toEqual([]);
  });
  it.each([
    ['a', 'NO ACTION'],
    ['r', 'RESTRICT'],
    ['c', 'CASCADE'],
    ['n', 'SET NULL'],
    ['d', 'SET DEFAULT'],
  ] as const)('maps PostgreSQL action %s to %s', async (action, expected) => {
    const client = createClient([
      {
        constraint_name: 'event_matches_event_participant_id_fkey',
        source_table: 'event_matches',
        source_columns: ['event_participant_id'],
        target_table: 'event_participants',
        target_columns: ['id'],
        update_action: action,
        delete_action: action,
      },
    ]);
    const relationships = await getAdminDatabaseRelationships(client);
    expect(relationships[0]?.onUpdate).toBe(expected);
    expect(relationships[0]?.onDelete).toBe(expected);
  });
  it('rejects unsupported PostgreSQL foreign key actions', async () => {
    const client = createClient([
      {
        constraint_name: 'event_matches_event_participant_id_fkey',
        source_table: 'event_matches',
        source_columns: ['event_participant_id'],
        target_table: 'event_participants',
        target_columns: ['id'],
        update_action: 'x',
        delete_action: 'c',
      },
    ]);
    await expect(getAdminDatabaseRelationships(client)).rejects.toThrow(
      'Unsupported PostgreSQL foreign key action: x',
    );
  });
});
