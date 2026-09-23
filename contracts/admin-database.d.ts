export interface AdminDatabaseTableOverview {
  name: string;
  estimatedRows: number;
  deadRows: number;
  tableSizeBytes: number;
  indexSizeBytes: number;
  totalSizeBytes: number;
  indexCount: number;
  invalidIndexCount: number;
  lastVacuumAt: string | null;
  lastAutovacuumAt: string | null;
  lastAnalyzeAt: string | null;
  lastAutoanalyzeAt: string | null;
}
export type AdminDatabaseForeignKeyAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';
export interface AdminDatabaseRelationship {
  constraintName: string;
  sourceTable: string;
  sourceColumns: string[];
  targetTable: string;
  targetColumns: string[];
  onUpdate: AdminDatabaseForeignKeyAction;
  onDelete: AdminDatabaseForeignKeyAction;
}
export interface AdminDatabaseOverviewResponse {
  database: {
    name: string;
    serverVersion: string;
    sizeBytes: number;
  };
  totals: {
    tables: number;
    indexes: number;
    invalidIndexes: number;
    estimatedRows: number;
    deadRows: number;
    tableSizeBytes: number;
    indexSizeBytes: number;
    totalSizeBytes: number;
  };
  tables: AdminDatabaseTableOverview[];
  relationships: AdminDatabaseRelationship[];
}
export type AdminDatabaseTableGroup = 'core' | 'events' | 'matches' | 'reconciliation' | 'system';
export interface AdminDatabaseColumn {
  name: string;
  ordinalPosition: number;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
}
export type AdminDatabaseConstraintType = 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
export interface AdminDatabaseConstraint {
  name: string;
  type: AdminDatabaseConstraintType;
  columns: string[];
  definition: string;
}
export interface AdminDatabaseIndex {
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
  valid: boolean;
  ready: boolean;
  sizeBytes: number;
  definition: string;
}
export interface AdminDatabaseTableDetailsResponse {
  table: {
    name: string;
    schema: string;
    label: string;
    group: AdminDatabaseTableGroup;
    sensitive: boolean;
    maintenance: boolean;
  };
  statistics: AdminDatabaseTableOverview;
  columns: AdminDatabaseColumn[];
  constraints: AdminDatabaseConstraint[];
  indexes: AdminDatabaseIndex[];
  relationships: {
    outgoing: AdminDatabaseRelationship[];
    incoming: AdminDatabaseRelationship[];
  };
}
export type AdminDatabaseMaintenanceOperation =
  | 'analyze'
  | 'vacuum_analyze'
  | 'reindex_concurrently';
export interface AdminDatabaseMaintenanceRequest {
  operation: AdminDatabaseMaintenanceOperation;
}
export interface AdminDatabaseMaintenanceResponse {
  tableName: string;
  operation: AdminDatabaseMaintenanceOperation;
  completedAt: string;
}
export interface AdminDatabaseResetRequest {
  confirmation: 'RESET_APPLICATION';
  acknowledgement: 'I understand';
}
export interface AdminDatabaseResetResponse {
  resetAt: string;
  restartRequired: true;
}
export interface AdminDatabaseMaintenanceAllResult {
  tableName: string;
  completed: boolean;
  error: string | null;
}
export interface AdminDatabaseMaintenanceAllResponse {
  operation: AdminDatabaseMaintenanceOperation;
  completedAt: string;
  results: AdminDatabaseMaintenanceAllResult[];
}
export interface AdminDatabasePlayerCacheCleanupResponse {
  clearedEntries: number;
  completedAt: string;
}
export interface AdminDatabaseMatchDetailsPruneRequest {
  olderThanDays: number;
}
export interface AdminDatabaseMatchDetailsPruneResponse {
  olderThanDays: number;
  cutoffAt: string;
  deletedMatchDetails: number;
  deletedMatchParticipants: number;
  completedAt: string;
}
export interface AdminDatabaseDeleteEndedEventRequest {
  confirmation: 'DELETE_ENDED_EVENT';
}
export interface AdminDatabaseDeleteEndedEventResponse {
  eventId: number;
  eventName: string;
  deletedAt: string;
}
export interface AdminDatabasePlayerDeleteDependencies {
  playerId: number;
  playerName: string;
  eventSelections: number;
  eventParticipations: number;
  activeEventParticipations: number;
  endedEventParticipations: number;
  canDelete: boolean;
}
export interface AdminDatabaseDeletePlayerRequest {
  confirmation: 'DELETE_PLAYER';
}
export interface AdminDatabaseDeletePlayerResponse {
  playerId: number;
  playerName: string;
  deletedAt: string;
}
