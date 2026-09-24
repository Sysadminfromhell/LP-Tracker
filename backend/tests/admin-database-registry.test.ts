import { describe, expect, it } from 'vitest';
import {
  getAdminDatabaseTableDefinition,
  getAdminDatabaseTableDefinitions,
  isAdminDatabaseTableName,
} from '../src/db/admin-database-registry';

describe('admin database registry', () => {
  it('returns all registered LP-Tracker tables', () => {
    const definitions = getAdminDatabaseTableDefinitions();
    expect(definitions.map((table) => table.name)).toEqual([
      'players',
      'player_cache',
      'events',
      'event_player_selections',
      'event_participants',
      'event_matches',
      'event_match_details',
      'event_match_participants',
      'lp_rank_observations',
      'lp_reconciliation_queue',
      'legal_pages',
      'admins',
      'admin_sessions',
      'schema_migrations',
    ]);
  });
  it('accepts only registered table names', () => {
    expect(isAdminDatabaseTableName('players')).toBe(true);
    expect(isAdminDatabaseTableName('event_matches')).toBe(true);
    expect(isAdminDatabaseTableName('legal_pages')).toBe(true);
    expect(isAdminDatabaseTableName('schema_migrations')).toBe(true);
    expect(isAdminDatabaseTableName('pg_user')).toBe(false);
    expect(isAdminDatabaseTableName('information_schema')).toBe(false);
    expect(isAdminDatabaseTableName('players; DROP TABLE players')).toBe(false);
  });
  it('marks sensitive system tables correctly', () => {
    expect(getAdminDatabaseTableDefinition('admins').sensitive).toBe(true);
    expect(getAdminDatabaseTableDefinition('admin_sessions').sensitive).toBe(true);
    expect(getAdminDatabaseTableDefinition('players').sensitive).toBe(false);
  });
  it('disables maintenance for schema migrations', () => {
    expect(getAdminDatabaseTableDefinition('schema_migrations').maintenance).toBe(false);
    expect(getAdminDatabaseTableDefinition('event_matches').maintenance).toBe(true);
  });
  it('uses the public schema for all registered tables', () => {
    const definitions = getAdminDatabaseTableDefinitions();
    expect(definitions.every((table) => table.schema === 'public')).toBe(true);
  });
});
