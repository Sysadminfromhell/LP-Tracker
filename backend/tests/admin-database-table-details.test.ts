import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminDatabaseTableDetails } from '../src/db/admin-database-table-details';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getAdminDatabaseRelationships: vi.fn(),
}));
vi.mock('../src/db/client', () => ({
  db: {
    query: mocks.query,
  },
}));
vi.mock('../src/db/admin-database-relationships', () => ({
  getAdminDatabaseRelationships: mocks.getAdminDatabaseRelationships,
}));

describe('admin database table details', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.getAdminDatabaseRelationships.mockReset();
    mocks.getAdminDatabaseRelationships.mockResolvedValue([]);
  });
  it('returns table metadata, statistics, columns, constraints, indexes and relationships', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'event_matches',
            estimated_rows: '1250',
            dead_rows: '12',
            table_size_bytes: '1048576',
            index_size_bytes: '524288',
            total_size_bytes: '1572864',
            index_count: '4',
            invalid_index_count: '0',
            last_vacuum: new Date('2026-09-20T10:00:00.000Z'),
            last_autovacuum: null,
            last_analyze: null,
            last_autoanalyze: new Date('2026-09-21T11:30:00.000Z'),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            ordinal_position: 1,
            data_type: 'bigint',
            nullable: false,
            default_value: "nextval('event_matches_id_seq'::regclass)",
          },
          {
            column_name: 'event_participant_id',
            ordinal_position: 2,
            data_type: 'bigint',
            nullable: false,
            default_value: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            constraint_name: 'event_matches_pkey',
            constraint_type: 'p',
            columns: ['id'],
            definition: 'PRIMARY KEY (id)',
          },
          {
            constraint_name: 'event_matches_event_participant_id_fkey',
            constraint_type: 'f',
            columns: ['event_participant_id'],
            definition:
              'FOREIGN KEY (event_participant_id) REFERENCES event_participants(id) ON DELETE CASCADE',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            index_name: 'event_matches_pkey',
            columns: ['id'],
            is_unique: true,
            is_primary: true,
            is_valid: true,
            is_ready: true,
            size_bytes: '16384',
            definition:
              'CREATE UNIQUE INDEX event_matches_pkey ON public.event_matches USING btree (id)',
          },
        ],
      });
    mocks.getAdminDatabaseRelationships.mockResolvedValue([
      {
        constraintName: 'event_matches_event_participant_id_fkey',
        sourceTable: 'event_matches',
        sourceColumns: ['event_participant_id'],
        targetTable: 'event_participants',
        targetColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
      {
        constraintName: 'event_match_details_event_match_id_fkey',
        sourceTable: 'event_match_details',
        sourceColumns: ['event_match_id'],
        targetTable: 'event_matches',
        targetColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
      {
        constraintName: 'players_cache_fkey',
        sourceTable: 'player_cache',
        sourceColumns: ['player_id'],
        targetTable: 'players',
        targetColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
    ]);
    const result = await getAdminDatabaseTableDetails('event_matches');
    expect(result).toEqual({
      table: {
        name: 'event_matches',
        schema: 'public',
        label: 'Event Matches',
        group: 'matches',
        sensitive: false,
        maintenance: true,
      },
      statistics: {
        name: 'event_matches',
        estimatedRows: 1250,
        deadRows: 12,
        tableSizeBytes: 1048576,
        indexSizeBytes: 524288,
        totalSizeBytes: 1572864,
        indexCount: 4,
        invalidIndexCount: 0,
        lastVacuumAt: '2026-09-20T10:00:00.000Z',
        lastAutovacuumAt: null,
        lastAnalyzeAt: null,
        lastAutoanalyzeAt: '2026-09-21T11:30:00.000Z',
      },
      columns: [
        {
          name: 'id',
          ordinalPosition: 1,
          dataType: 'bigint',
          nullable: false,
          defaultValue: "nextval('event_matches_id_seq'::regclass)",
        },
        {
          name: 'event_participant_id',
          ordinalPosition: 2,
          dataType: 'bigint',
          nullable: false,
          defaultValue: null,
        },
      ],
      constraints: [
        {
          name: 'event_matches_pkey',
          type: 'PRIMARY KEY',
          columns: ['id'],
          definition: 'PRIMARY KEY (id)',
        },
        {
          name: 'event_matches_event_participant_id_fkey',
          type: 'FOREIGN KEY',
          columns: ['event_participant_id'],
          definition:
            'FOREIGN KEY (event_participant_id) REFERENCES event_participants(id) ON DELETE CASCADE',
        },
      ],
      indexes: [
        {
          name: 'event_matches_pkey',
          columns: ['id'],
          unique: true,
          primary: true,
          valid: true,
          ready: true,
          sizeBytes: 16384,
          definition:
            'CREATE UNIQUE INDEX event_matches_pkey ON public.event_matches USING btree (id)',
        },
      ],
      relationships: {
        outgoing: [
          {
            constraintName: 'event_matches_event_participant_id_fkey',
            sourceTable: 'event_matches',
            sourceColumns: ['event_participant_id'],
            targetTable: 'event_participants',
            targetColumns: ['id'],
            onUpdate: 'NO ACTION',
            onDelete: 'CASCADE',
          },
        ],
        incoming: [
          {
            constraintName: 'event_match_details_event_match_id_fkey',
            sourceTable: 'event_match_details',
            sourceColumns: ['event_match_id'],
            targetTable: 'event_matches',
            targetColumns: ['id'],
            onUpdate: 'NO ACTION',
            onDelete: 'CASCADE',
          },
        ],
      },
    });
    expect(mocks.query).toHaveBeenCalledTimes(4);
    for (const call of mocks.query.mock.calls) {
      expect(call[1]).toEqual(['event_matches']);
    }
    expect(mocks.getAdminDatabaseRelationships).toHaveBeenCalledTimes(1);
  });
  it('rejects table names outside the registry without querying PostgreSQL', async () => {
    const result = await getAdminDatabaseTableDetails('pg_authid');
    expect(result).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.getAdminDatabaseRelationships).not.toHaveBeenCalled();
  });
  it('returns null when a registered table does not exist in PostgreSQL', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [],
    });
    const result = await getAdminDatabaseTableDetails('event_matches');
    expect(result).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminDatabaseRelationships).not.toHaveBeenCalled();
  });
  it.each([
    ['p', 'PRIMARY KEY'],
    ['f', 'FOREIGN KEY'],
    ['u', 'UNIQUE'],
    ['c', 'CHECK'],
  ] as const)('maps PostgreSQL constraint %s to %s', async (type, expected) => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'players',
            estimated_rows: '1',
            dead_rows: '0',
            table_size_bytes: '1',
            index_size_bytes: '1',
            total_size_bytes: '2',
            index_count: '1',
            invalid_index_count: '0',
            last_vacuum: null,
            last_autovacuum: null,
            last_analyze: null,
            last_autoanalyze: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            constraint_name: 'test_constraint',
            constraint_type: type,
            columns: ['id'],
            definition: 'test',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await getAdminDatabaseTableDetails('players');
    expect(result?.constraints[0]?.type).toBe(expected);
  });
  it('rejects unsupported PostgreSQL constraint types', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'players',
            estimated_rows: '1',
            dead_rows: '0',
            table_size_bytes: '1',
            index_size_bytes: '1',
            total_size_bytes: '2',
            index_count: '1',
            invalid_index_count: '0',
            last_vacuum: null,
            last_autovacuum: null,
            last_analyze: null,
            last_autoanalyze: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            constraint_name: 'unsupported_constraint',
            constraint_type: 'x',
            columns: [],
            definition: 'unsupported',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(getAdminDatabaseTableDetails('players')).rejects.toThrow(
      'Unsupported PostgreSQL constraint type: x',
    );
  });
  it('rejects invalid PostgreSQL statistics', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'players',
            estimated_rows: '-1',
            dead_rows: '0',
            table_size_bytes: '1',
            index_size_bytes: '1',
            total_size_bytes: '2',
            index_count: '1',
            invalid_index_count: '0',
            last_vacuum: null,
            last_autovacuum: null,
            last_analyze: null,
            last_autoanalyze: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(getAdminDatabaseTableDetails('players')).rejects.toThrow(
      'Invalid PostgreSQL statistic: -1',
    );
  });
});
