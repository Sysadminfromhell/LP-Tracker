import type { FromSchema } from 'json-schema-to-ts';
import type {
  AdminDatabaseColumn,
  AdminDatabaseConstraint,
  AdminDatabaseIndex,
  AdminDatabaseMaintenanceAllResponse,
  AdminDatabaseMaintenanceAllResult,
  AdminDatabaseMaintenanceOperation,
  AdminDatabaseMaintenanceRequest,
  AdminDatabaseMaintenanceResponse,
  AdminDatabaseOverviewResponse,
  AdminDatabaseRelationship,
  AdminDatabaseResetRequest,
  AdminDatabaseResetResponse,
  AdminDatabaseTableDetailsResponse,
  AdminDatabaseTableOverview,
} from '@lp-tracker/contracts';
import {
  adminDatabaseColumnSchema,
  adminDatabaseConstraintSchema,
  adminDatabaseIndexSchema,
  adminDatabaseMaintenanceAllResponseSchema,
  adminDatabaseMaintenanceAllResultSchema,
  adminDatabaseMaintenanceOperationSchema,
  adminDatabaseMaintenanceRequestSchema,
  adminDatabaseMaintenanceResponseSchema,
  adminDatabaseOverviewResponseSchema,
  adminDatabaseRelationshipSchema,
  adminDatabaseResetRequestSchema,
  adminDatabaseResetResponseSchema,
  adminDatabaseTableDetailsResponseSchema,
  adminDatabaseTableOverviewSchema,
} from '../../src/routes/schemas/admin-database.schemas';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Assert<T extends true> = T;
type TableOverviewSchema = FromSchema<typeof adminDatabaseTableOverviewSchema>;
type RelationshipSchema = FromSchema<typeof adminDatabaseRelationshipSchema>;
type OverviewResponseSchema = FromSchema<typeof adminDatabaseOverviewResponseSchema>;
type ColumnSchema = FromSchema<typeof adminDatabaseColumnSchema>;
type ConstraintSchema = FromSchema<typeof adminDatabaseConstraintSchema>;
type IndexSchema = FromSchema<typeof adminDatabaseIndexSchema>;
type TableDetailsResponseSchema = FromSchema<typeof adminDatabaseTableDetailsResponseSchema>;
type MaintenanceOperationSchema = FromSchema<typeof adminDatabaseMaintenanceOperationSchema>;
type MaintenanceRequestSchema = FromSchema<typeof adminDatabaseMaintenanceRequestSchema>;
type MaintenanceResponseSchema = FromSchema<typeof adminDatabaseMaintenanceResponseSchema>;
type ResetRequestSchema = FromSchema<typeof adminDatabaseResetRequestSchema>;
type ResetResponseSchema = FromSchema<typeof adminDatabaseResetResponseSchema>;
type MaintenanceAllResultSchema = FromSchema<typeof adminDatabaseMaintenanceAllResultSchema>;
type MaintenanceAllResponseSchema = FromSchema<typeof adminDatabaseMaintenanceAllResponseSchema>;
type _TableOverviewMatchesContract = Assert<Equal<TableOverviewSchema, AdminDatabaseTableOverview>>;
type _RelationshipMatchesContract = Assert<Equal<RelationshipSchema, AdminDatabaseRelationship>>;
type _OverviewResponseMatchesContract = Assert<
  Equal<OverviewResponseSchema, AdminDatabaseOverviewResponse>
>;
type _ColumnMatchesContract = Assert<Equal<ColumnSchema, AdminDatabaseColumn>>;
type _ConstraintMatchesContract = Assert<Equal<ConstraintSchema, AdminDatabaseConstraint>>;
type _IndexMatchesContract = Assert<Equal<IndexSchema, AdminDatabaseIndex>>;
type _TableDetailsResponseMatchesContract = Assert<
  Equal<TableDetailsResponseSchema, AdminDatabaseTableDetailsResponse>
>;
type _MaintenanceOperationMatchesContract = Assert<
  Equal<MaintenanceOperationSchema, AdminDatabaseMaintenanceOperation>
>;
type _MaintenanceRequestMatchesContract = Assert<
  Equal<MaintenanceRequestSchema, AdminDatabaseMaintenanceRequest>
>;
type _MaintenanceResponseMatchesContract = Assert<
  Equal<MaintenanceResponseSchema, AdminDatabaseMaintenanceResponse>
>;
type _ResetRequestMatchesContract = Assert<Equal<ResetRequestSchema, AdminDatabaseResetRequest>>;
type _ResetResponseMatchesContract = Assert<Equal<ResetResponseSchema, AdminDatabaseResetResponse>>;
type _MaintenanceAllResultMatchesContract = Assert<
  Equal<MaintenanceAllResultSchema, AdminDatabaseMaintenanceAllResult>
>;
type _MaintenanceAllResponseMatchesContract = Assert<
  Equal<MaintenanceAllResponseSchema, AdminDatabaseMaintenanceAllResponse>
>;
