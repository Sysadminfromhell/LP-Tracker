import type { Pool } from 'pg';
import type {
  AdminDatabaseColumn,
  AdminDatabaseConstraint,
  AdminDatabaseConstraintType,
  AdminDatabaseIndex,
  AdminDatabaseTableDetailsResponse,
  AdminDatabaseTableOverview,
} from '@lp-tracker/contracts';
import { db } from './client';
import { getAdminDatabaseRelationships } from './admin-database-relationships';
import {
  getAdminDatabaseTableDefinition,
  isAdminDatabaseTableName,
} from './admin-database-registry';

type QueryClient = Pick<Pool, 'query'>;

interface TableStatisticsRow {
  table_name: string;
  estimated_rows: string;
  dead_rows: string;
  table_size_bytes: string;
  index_size_bytes: string;
  total_size_bytes: string;
  index_count: string;
  invalid_index_count: string;
  last_vacuum: Date | null;
  last_autovacuum: Date | null;
  last_analyze: Date | null;
  last_autoanalyze: Date | null;
}
interface TableColumnRow {
  column_name: string;
  ordinal_position: number;
  data_type: string;
  nullable: boolean;
  default_value: string | null;
}
interface TableConstraintRow {
  constraint_name: string;
  constraint_type: string;
  columns: string[];
  definition: string;
}
interface TableIndexRow {
  index_name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
  is_valid: boolean;
  is_ready: boolean;
  size_bytes: string;
  definition: string;
}

function toNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid PostgreSQL statistic: ${value}`);
  }

  return parsed;
}
function toIsoString(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}
function mapConstraintType(value: string): AdminDatabaseConstraintType {
  switch (value) {
    case 'p':
      return 'PRIMARY KEY';
    case 'f':
      return 'FOREIGN KEY';
    case 'u':
      return 'UNIQUE';
    case 'c':
      return 'CHECK';
    default:
      throw new Error(`Unsupported PostgreSQL constraint type: ${value}`);
  }
}
export async function getAdminDatabaseTableDetails(
  tableName: string,
  client: QueryClient = db,
): Promise<AdminDatabaseTableDetailsResponse | null> {
  if (!isAdminDatabaseTableName(tableName)) {
    return null;
  }
  const definition = getAdminDatabaseTableDefinition(tableName);
  const statisticsResult = await client.query<TableStatisticsRow>(
    `
      SELECT
        stats.relname AS table_name,
        stats.n_live_tup::TEXT AS estimated_rows,
        stats.n_dead_tup::TEXT AS dead_rows,
        pg_relation_size(stats.relid)::TEXT AS table_size_bytes,
        pg_indexes_size(stats.relid)::TEXT AS index_size_bytes,
        pg_total_relation_size(stats.relid)::TEXT AS total_size_bytes,
        COALESCE(indexes.index_count, 0)::TEXT AS index_count,
        COALESCE(indexes.invalid_index_count, 0)::TEXT AS invalid_index_count,
        stats.last_vacuum,
        stats.last_autovacuum,
        stats.last_analyze,
        stats.last_autoanalyze
      FROM pg_stat_user_tables stats
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS index_count,
          COUNT(*) FILTER (
            WHERE
              NOT index_state.indisvalid
              OR NOT index_state.indisready
          ) AS invalid_index_count
        FROM pg_index index_state
        WHERE index_state.indrelid = stats.relid
      ) indexes
        ON TRUE
      WHERE
        stats.schemaname = 'public'
        AND stats.relname = $1
    `,
    [tableName],
  );
  const statisticsRow = statisticsResult.rows[0];
  if (!statisticsRow) {
    return null;
  }
  const columnsResult = await client.query<TableColumnRow>(
    `
      SELECT
        attribute.attname AS column_name,
        attribute.attnum AS ordinal_position,
        pg_catalog.format_type(
          attribute.atttypid,
          attribute.atttypmod
        ) AS data_type,
        NOT attribute.attnotnull AS nullable,
        pg_get_expr(
          attribute_default.adbin,
          attribute_default.adrelid
        ) AS default_value
      FROM pg_attribute attribute
      JOIN pg_class table_state
        ON table_state.oid = attribute.attrelid
      JOIN pg_namespace table_schema
        ON table_schema.oid = table_state.relnamespace
      LEFT JOIN pg_attrdef attribute_default
        ON attribute_default.adrelid = attribute.attrelid
        AND attribute_default.adnum = attribute.attnum
      WHERE
        table_schema.nspname = 'public'
        AND table_state.relname = $1
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum
    `,
    [tableName],
  );
  const constraintsResult = await client.query<TableConstraintRow>(
    `
      SELECT
        constraint_state.conname AS constraint_name,
        constraint_state.contype::TEXT AS constraint_type,
        COALESCE(
          ARRAY(
            SELECT attribute.attname::TEXT
            FROM UNNEST(constraint_state.conkey)
              WITH ORDINALITY AS constraint_column(attnum, ordinality)
            JOIN pg_attribute attribute
              ON attribute.attrelid = constraint_state.conrelid
              AND attribute.attnum = constraint_column.attnum
            ORDER BY constraint_column.ordinality
          ),
          ARRAY[]::TEXT[]
        ) AS columns,
        pg_get_constraintdef(
          constraint_state.oid,
          TRUE
        ) AS definition
      FROM pg_constraint constraint_state
      JOIN pg_class table_state
        ON table_state.oid = constraint_state.conrelid
      JOIN pg_namespace table_schema
        ON table_schema.oid = table_state.relnamespace
      WHERE
        table_schema.nspname = 'public'
        AND table_state.relname = $1
        AND constraint_state.contype IN ('p', 'f', 'u', 'c')
      ORDER BY
        constraint_state.contype,
        constraint_state.conname
    `,
    [tableName],
  );
  const indexesResult = await client.query<TableIndexRow>(
    `
      SELECT
        index_table.relname AS index_name,
        ARRAY(
          SELECT pg_get_indexdef(
            index_state.indexrelid,
            position,
            TRUE
          )
          FROM generate_series(
            1,
            index_state.indnkeyatts
          ) AS position
        ) AS columns,
        index_state.indisunique AS is_unique,
        index_state.indisprimary AS is_primary,
        index_state.indisvalid AS is_valid,
        index_state.indisready AS is_ready,
        pg_relation_size(index_state.indexrelid)::TEXT AS size_bytes,
        pg_get_indexdef(index_state.indexrelid) AS definition
      FROM pg_index index_state
      JOIN pg_class table_state
        ON table_state.oid = index_state.indrelid
      JOIN pg_namespace table_schema
        ON table_schema.oid = table_state.relnamespace
      JOIN pg_class index_table
        ON index_table.oid = index_state.indexrelid
      WHERE
        table_schema.nspname = 'public'
        AND table_state.relname = $1
      ORDER BY
        index_state.indisprimary DESC,
        index_state.indisunique DESC,
        index_table.relname
    `,
    [tableName],
  );
  const relationships = await getAdminDatabaseRelationships(client);
  const statistics: AdminDatabaseTableOverview = {
    name: statisticsRow.table_name,
    estimatedRows: toNumber(statisticsRow.estimated_rows),
    deadRows: toNumber(statisticsRow.dead_rows),
    tableSizeBytes: toNumber(statisticsRow.table_size_bytes),
    indexSizeBytes: toNumber(statisticsRow.index_size_bytes),
    totalSizeBytes: toNumber(statisticsRow.total_size_bytes),
    indexCount: toNumber(statisticsRow.index_count),
    invalidIndexCount: toNumber(statisticsRow.invalid_index_count),
    lastVacuumAt: toIsoString(statisticsRow.last_vacuum),
    lastAutovacuumAt: toIsoString(statisticsRow.last_autovacuum),
    lastAnalyzeAt: toIsoString(statisticsRow.last_analyze),
    lastAutoanalyzeAt: toIsoString(statisticsRow.last_autoanalyze),
  };
  const columns: AdminDatabaseColumn[] = columnsResult.rows.map((row) => ({
    name: row.column_name,
    ordinalPosition: row.ordinal_position,
    dataType: row.data_type,
    nullable: row.nullable,
    defaultValue: row.default_value,
  }));
  const constraints: AdminDatabaseConstraint[] = constraintsResult.rows.map((row) => ({
    name: row.constraint_name,
    type: mapConstraintType(row.constraint_type),
    columns: row.columns,
    definition: row.definition,
  }));
  const indexes: AdminDatabaseIndex[] = indexesResult.rows.map((row) => ({
    name: row.index_name,
    columns: row.columns,
    unique: row.is_unique,
    primary: row.is_primary,
    valid: row.is_valid,
    ready: row.is_ready,
    sizeBytes: toNumber(row.size_bytes),
    definition: row.definition,
  }));
  return {
    table: definition,
    statistics,
    columns,
    constraints,
    indexes,
    relationships: {
      outgoing: relationships.filter((relationship) => relationship.sourceTable === tableName),
      incoming: relationships.filter((relationship) => relationship.targetTable === tableName),
    },
  };
}
