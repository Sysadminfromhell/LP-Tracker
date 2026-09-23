import type { Pool } from 'pg';
import { db } from './client';
import { isAdminDatabaseTableName, type AdminDatabaseTableName } from './admin-database-registry';

type QueryClient = Pick<Pool, 'query'>;

export type AdminDatabaseForeignKeyAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';
export interface AdminDatabaseRelationship {
  constraintName: string;
  sourceTable: AdminDatabaseTableName;
  sourceColumns: string[];
  targetTable: AdminDatabaseTableName;
  targetColumns: string[];
  onUpdate: AdminDatabaseForeignKeyAction;
  onDelete: AdminDatabaseForeignKeyAction;
}
interface DatabaseRelationshipRow {
  constraint_name: string;
  source_table: string;
  source_columns: string[];
  target_table: string;
  target_columns: string[];
  update_action: string;
  delete_action: string;
}

function mapForeignKeyAction(value: string): AdminDatabaseForeignKeyAction {
  switch (value) {
    case 'a':
      return 'NO ACTION';
    case 'r':
      return 'RESTRICT';
    case 'c':
      return 'CASCADE';
    case 'n':
      return 'SET NULL';
    case 'd':
      return 'SET DEFAULT';
    default:
      throw new Error(`Unsupported PostgreSQL foreign key action: ${value}`);
  }
}
export async function getAdminDatabaseRelationships(
  client: QueryClient = db,
): Promise<AdminDatabaseRelationship[]> {
  const result = await client.query<DatabaseRelationshipRow>(
    `
      SELECT
        constraint_state.conname AS constraint_name,
        source_table.relname AS source_table,
        ARRAY_AGG(
          source_attribute.attname::TEXT
          ORDER BY source_key.ordinality
        ) AS source_columns,
        target_table.relname AS target_table,
        ARRAY_AGG(
          target_attribute.attname::TEXT
          ORDER BY source_key.ordinality
        ) AS target_columns,
        constraint_state.confupdtype::TEXT AS update_action,
        constraint_state.confdeltype::TEXT AS delete_action
      FROM pg_constraint constraint_state
      JOIN pg_class source_table
        ON source_table.oid = constraint_state.conrelid
      JOIN pg_namespace source_schema
        ON source_schema.oid = source_table.relnamespace
      JOIN pg_class target_table
        ON target_table.oid = constraint_state.confrelid
      JOIN pg_namespace target_schema
        ON target_schema.oid = target_table.relnamespace
      JOIN LATERAL UNNEST(constraint_state.conkey)
        WITH ORDINALITY AS source_key(attnum, ordinality)
        ON TRUE
      JOIN LATERAL UNNEST(constraint_state.confkey)
        WITH ORDINALITY AS target_key(attnum, ordinality)
        ON target_key.ordinality = source_key.ordinality
      JOIN pg_attribute source_attribute
        ON source_attribute.attrelid = constraint_state.conrelid
        AND source_attribute.attnum = source_key.attnum
      JOIN pg_attribute target_attribute
        ON target_attribute.attrelid = constraint_state.confrelid
        AND target_attribute.attnum = target_key.attnum
      WHERE
        constraint_state.contype = 'f'
        AND source_schema.nspname = 'public'
        AND target_schema.nspname = 'public'
      GROUP BY
        constraint_state.oid,
        constraint_state.conname,
        source_table.relname,
        target_table.relname,
        constraint_state.confupdtype,
        constraint_state.confdeltype
      ORDER BY
        source_table.relname,
        constraint_state.conname
    `,
  );
  return result.rows.flatMap<AdminDatabaseRelationship>((row) => {
    if (
      !isAdminDatabaseTableName(row.source_table) ||
      !isAdminDatabaseTableName(row.target_table)
    ) {
      return [];
    }
    return [
      {
        constraintName: row.constraint_name,
        sourceTable: row.source_table,
        sourceColumns: row.source_columns,
        targetTable: row.target_table,
        targetColumns: row.target_columns,
        onUpdate: mapForeignKeyAction(row.update_action),
        onDelete: mapForeignKeyAction(row.delete_action),
      },
    ];
  });
}
