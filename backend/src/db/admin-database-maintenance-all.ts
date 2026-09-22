import type { Pool } from 'pg';
import type {
  AdminDatabaseMaintenanceAllResponse,
  AdminDatabaseMaintenanceOperation,
} from '@lp-tracker/contracts';
import { db } from './client';
import { runAdminDatabaseMaintenance } from './admin-database-maintenance';
import { getAdminDatabaseTableDefinitions } from './admin-database-registry';

type QueryClient = Pick<Pool, 'query'>;

export async function runAdminDatabaseMaintenanceAll(
  operation: AdminDatabaseMaintenanceOperation,
  client: QueryClient = db,
): Promise<AdminDatabaseMaintenanceAllResponse> {
  const tables = getAdminDatabaseTableDefinitions().filter((table) => table.maintenance);
  const results: AdminDatabaseMaintenanceAllResponse['results'] = [];
  for (const table of tables) {
    try {
      const result = await runAdminDatabaseMaintenance(table.name, operation, client);
      results.push({
        tableName: table.name,
        completed: result !== null,
        error: result === null ? 'Maintenance operation not allowed' : null,
      });
    } catch (error) {
      console.error(`[ADMIN DATABASE] ${operation} failed for ${table.name}:`, error);
      results.push({
        tableName: table.name,
        completed: false,
        error: 'Maintenance operation failed',
      });
    }
  }
  return {
    operation,
    completedAt: new Date().toISOString(),
    results,
  };
}
