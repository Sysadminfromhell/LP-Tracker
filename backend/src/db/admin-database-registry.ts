export const ADMIN_DATABASE_TABLES = {
  players: {
    label: 'Players',
    group: 'core',
    sensitive: false,
    maintenance: true,
  },
  player_cache: {
    label: 'Player Cache',
    group: 'core',
    sensitive: false,
    maintenance: true,
  },
  events: {
    label: 'Events',
    group: 'events',
    sensitive: false,
    maintenance: true,
  },
  event_player_selections: {
    label: 'Event Player Selections',
    group: 'events',
    sensitive: false,
    maintenance: true,
  },
  event_participants: {
    label: 'Event Participants',
    group: 'events',
    sensitive: false,
    maintenance: true,
  },
  event_matches: {
    label: 'Event Matches',
    group: 'matches',
    sensitive: false,
    maintenance: true,
  },
  event_match_details: {
    label: 'Event Match Details',
    group: 'matches',
    sensitive: false,
    maintenance: true,
  },
  event_match_participants: {
    label: 'Event Match Participants',
    group: 'matches',
    sensitive: false,
    maintenance: true,
  },
  lp_rank_observations: {
    label: 'LP Rank Observations',
    group: 'reconciliation',
    sensitive: false,
    maintenance: true,
  },
  lp_reconciliation_queue: {
    label: 'LP Reconciliation Queue',
    group: 'reconciliation',
    sensitive: false,
    maintenance: true,
  },
  admins: {
    label: 'Admins',
    group: 'system',
    sensitive: true,
    maintenance: true,
  },
  admin_sessions: {
    label: 'Admin Sessions',
    group: 'system',
    sensitive: true,
    maintenance: true,
  },
  schema_migrations: {
    label: 'Schema Migrations',
    group: 'system',
    sensitive: true,
    maintenance: false,
  },
} as const;
export type AdminDatabaseTableName = keyof typeof ADMIN_DATABASE_TABLES;
export type AdminDatabaseTableGroup =
  (typeof ADMIN_DATABASE_TABLES)[AdminDatabaseTableName]['group'];
export interface AdminDatabaseTableDefinition {
  name: AdminDatabaseTableName;
  schema: 'public';
  label: string;
  group: AdminDatabaseTableGroup;
  sensitive: boolean;
  maintenance: boolean;
}
export function isAdminDatabaseTableName(value: string): value is AdminDatabaseTableName {
  return Object.hasOwn(ADMIN_DATABASE_TABLES, value);
}
export function getAdminDatabaseTableDefinition(
  name: AdminDatabaseTableName,
): AdminDatabaseTableDefinition {
  const definition = ADMIN_DATABASE_TABLES[name];
  return {
    name,
    schema: 'public',
    label: definition.label,
    group: definition.group,
    sensitive: definition.sensitive,
    maintenance: definition.maintenance,
  };
}
export function getAdminDatabaseTableDefinitions(): AdminDatabaseTableDefinition[] {
  return Object.keys(ADMIN_DATABASE_TABLES).map((name) =>
    getAdminDatabaseTableDefinition(name as AdminDatabaseTableName),
  );
}
