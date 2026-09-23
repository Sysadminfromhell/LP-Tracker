import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { getAdminDatabaseOverview } from '../src/db/admin-database';

describe('admin database overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockReset();
    mocks.getAdminDatabaseRelationships.mockReset();
    mocks.getAdminDatabaseRelationships.mockResolvedValue([]);
  });
  it('returns database and table statistics', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            database_name: 'lp_tracker',
            server_version: '18.6',
            database_size_bytes: '104857600',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'event_matches',
            estimated_rows: '1200',
            dead_rows: '25',
            table_size_bytes: '5242880',
            index_size_bytes: '2097152',
            total_size_bytes: '7340032',
            index_count: '4',
            invalid_index_count: '0',
            last_vacuum: null,
            last_autovacuum: new Date('2026-09-22T06:00:00.000Z'),
            last_analyze: null,
            last_autoanalyze: new Date('2026-09-22T06:05:00.000Z'),
          },
          {
            table_name: 'players',
            estimated_rows: '20',
            dead_rows: '2',
            table_size_bytes: '65536',
            index_size_bytes: '98304',
            total_size_bytes: '163840',
            index_count: '3',
            invalid_index_count: '0',
            last_vacuum: new Date('2026-09-21T20:00:00.000Z'),
            last_autovacuum: null,
            last_analyze: new Date('2026-09-21T20:05:00.000Z'),
            last_autoanalyze: null,
          },
        ],
      });
    const result = await getAdminDatabaseOverview();
    expect(result).toEqual({
      database: {
        name: 'lp_tracker',
        serverVersion: '18.6',
        sizeBytes: 104857600,
      },
      totals: {
        tables: 2,
        indexes: 7,
        invalidIndexes: 0,
        estimatedRows: 1220,
        deadRows: 27,
        tableSizeBytes: 5308416,
        indexSizeBytes: 2195456,
        totalSizeBytes: 7503872,
      },
      tables: [
        {
          name: 'event_matches',
          estimatedRows: 1200,
          deadRows: 25,
          tableSizeBytes: 5242880,
          indexSizeBytes: 2097152,
          totalSizeBytes: 7340032,
          indexCount: 4,
          invalidIndexCount: 0,
          lastVacuumAt: null,
          lastAutovacuumAt: '2026-09-22T06:00:00.000Z',
          lastAnalyzeAt: null,
          lastAutoanalyzeAt: '2026-09-22T06:05:00.000Z',
        },
        {
          name: 'players',
          estimatedRows: 20,
          deadRows: 2,
          tableSizeBytes: 65536,
          indexSizeBytes: 98304,
          totalSizeBytes: 163840,
          indexCount: 3,
          invalidIndexCount: 0,
          lastVacuumAt: '2026-09-21T20:00:00.000Z',
          lastAutovacuumAt: null,
          lastAnalyzeAt: '2026-09-21T20:05:00.000Z',
          lastAutoanalyzeAt: null,
        },
      ],
      relationships: [],
    });
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it('includes invalid indexes in the totals', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            database_name: 'lp_tracker',
            server_version: '18.6',
            database_size_bytes: '1000',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'event_matches',
            estimated_rows: '100',
            dead_rows: '10',
            table_size_bytes: '500',
            index_size_bytes: '300',
            total_size_bytes: '800',
            index_count: '4',
            invalid_index_count: '2',
            last_vacuum: null,
            last_autovacuum: null,
            last_analyze: null,
            last_autoanalyze: null,
          },
        ],
      });
    const result = await getAdminDatabaseOverview();
    expect(result.totals.invalidIndexes).toBe(2);
    expect(result.tables[0].invalidIndexCount).toBe(2);
  });
  it('supports an empty public schema', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            database_name: 'lp_tracker',
            server_version: '18.6',
            database_size_bytes: '8192',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    const result = await getAdminDatabaseOverview();
    expect(result.totals).toEqual({
      tables: 0,
      indexes: 0,
      invalidIndexes: 0,
      estimatedRows: 0,
      deadRows: 0,
      tableSizeBytes: 0,
      indexSizeBytes: 0,
      totalSizeBytes: 0,
    });

    expect(result.tables).toEqual([]);
  });
  it('throws when PostgreSQL returns no database information', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    await expect(getAdminDatabaseOverview()).rejects.toThrow(
      'PostgreSQL did not return database information',
    );
  });
  it('rejects invalid PostgreSQL statistics', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            database_name: 'lp_tracker',
            server_version: '18.6',
            database_size_bytes: 'invalid',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    await expect(getAdminDatabaseOverview()).rejects.toThrow(
      'Invalid PostgreSQL statistic: invalid',
    );
  });
  it('rejects negative PostgreSQL statistics', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            database_name: 'lp_tracker',
            server_version: '18.6',
            database_size_bytes: '1000',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            table_name: 'event_matches',
            estimated_rows: '-1',
            dead_rows: '0',
            table_size_bytes: '100',
            index_size_bytes: '100',
            total_size_bytes: '200',
            index_count: '1',
            invalid_index_count: '0',
            last_vacuum: null,
            last_autovacuum: null,
            last_analyze: null,
            last_autoanalyze: null,
          },
        ],
      });
    await expect(getAdminDatabaseOverview()).rejects.toThrow('Invalid PostgreSQL statistic: -1');
  });
});
