import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  end: vi.fn(),
  query: vi.fn(),
}));

vi.mock('pg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pg')>();
  class MockClient {
    connect = mocks.connect;
    end = mocks.end;
    query = mocks.query;
  }
  return {
    ...actual,
    Client: MockClient,
  };
});

import { escapeIdentifier, escapeLiteral } from 'pg';
import { bootstrapDatabase } from '../src/db/bootstrap';

const originalEnv = { ...process.env };

function setBootstrapEnv(): void {
  process.env.DATABASE_HOST = 'localhost';
  process.env.DATABASE_PORT = '5432';
  process.env.DATABASE_NAME = 'lp_db"; DROP DATABASE postgres; --';
  process.env.DATABASE_USER = 'lp_user"; DROP ROLE postgres; --';
  process.env.DATABASE_PASSWORD = "secret'; DROP ROLE postgres; --";
  process.env.DATABASE_ADMIN_USER = 'postgres';
  process.env.DATABASE_ADMIN_PASSWORD = 'admin-secret';
  process.env.LOG_LEVEL = 'error';
}

function getExecutedSql(): string[] {
  return mocks.query.mock.calls
    .map(([query]) => query)
    .filter((query): query is string => typeof query === 'string');
}

describe('database bootstrap SQL escaping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBootstrapEnv();
    mocks.connect.mockResolvedValue(undefined);
    mocks.end.mockResolvedValue(undefined);
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('identifiers', () => {
    it('escapes double quotes in database users', () => {
      const maliciousUser = 'lp_user"; DROP ROLE postgres; --';
      expect(escapeIdentifier(maliciousUser)).toBe('"lp_user""; DROP ROLE postgres; --"');
    });
    it('escapes double quotes in database names', () => {
      const maliciousDatabase = 'lp_tracker"; DROP DATABASE postgres; --';
      expect(escapeIdentifier(maliciousDatabase)).toBe(
        '"lp_tracker""; DROP DATABASE postgres; --"',
      );
    });
    it('keeps semicolons inside the quoted identifier', () => {
      const value = 'foo; DROP DATABASE postgres;';
      expect(escapeIdentifier(value)).toBe('"foo; DROP DATABASE postgres;"');
    });
  });

  describe('literals', () => {
    it('escapes single quotes in database passwords', () => {
      const maliciousPassword = "secret'; DROP ROLE postgres; --";
      expect(escapeLiteral(maliciousPassword)).toBe("'secret''; DROP ROLE postgres; --'");
    });
    it('escapes multiple single quotes', () => {
      expect(escapeLiteral("foo'bar'baz")).toBe("'foo''bar''baz'");
    });
  });

  describe('bootstrap queries', () => {
    it('escapes externally controlled values when creating the role and database', async () => {
      mocks.query
        .mockResolvedValueOnce({
          rows: [{ server_version: '18.6' }],
        })
        .mockResolvedValueOnce({
          rowCount: 0,
          rows: [],
        })
        .mockResolvedValueOnce({
          rowCount: null,
          rows: [],
        })
        .mockResolvedValueOnce({
          rowCount: 0,
          rows: [],
        })
        .mockResolvedValueOnce({
          rowCount: null,
          rows: [],
        });
      const result = await bootstrapDatabase();
      expect(result).toEqual({
        databaseCreated: true,
        userCreated: true,
      });
      const sql = getExecutedSql();
      const createRole = sql.find((query) => query.includes('CREATE ROLE'));
      const createDatabase = sql.find((query) => query.includes('CREATE DATABASE'));
      expect(createRole).toBeDefined();
      expect(createRole).toContain('"lp_user""; DROP ROLE postgres; --"');
      expect(createRole).toContain("'secret''; DROP ROLE postgres; --'");
      expect(createDatabase).toBeDefined();
      expect(createDatabase).toContain('"lp_db""; DROP DATABASE postgres; --"');
      expect(createDatabase).toContain('"lp_user""; DROP ROLE postgres; --"');
    });
    it('escapes externally controlled values when altering the role and database', async () => {
      mocks.query
        .mockResolvedValueOnce({
          rows: [{ server_version: '18.6' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ '?column?': 1 }],
        })
        .mockResolvedValueOnce({
          rowCount: null,
          rows: [],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ '?column?': 1 }],
        })
        .mockResolvedValueOnce({
          rowCount: null,
          rows: [],
        });
      const result = await bootstrapDatabase();
      expect(result).toEqual({
        databaseCreated: false,
        userCreated: false,
      });
      const sql = getExecutedSql();
      const alterRole = sql.find((query) => query.includes('ALTER ROLE'));
      const alterDatabase = sql.find((query) => query.includes('ALTER DATABASE'));
      expect(alterRole).toBeDefined();
      expect(alterRole).toContain('"lp_user""; DROP ROLE postgres; --"');
      expect(alterRole).toContain("'secret''; DROP ROLE postgres; --'");
      expect(alterDatabase).toBeDefined();
      expect(alterDatabase).toContain('"lp_db""; DROP DATABASE postgres; --"');
      expect(alterDatabase).toContain('"lp_user""; DROP ROLE postgres; --"');
    });
  });
});
