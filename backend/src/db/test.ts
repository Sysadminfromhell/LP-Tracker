import { closeDatabase, testDatabaseConnection } from './client';
import { runMigrations } from './migrations';

async function main(): Promise<void> {
  await testDatabaseConnection();
  await runMigrations();
  await closeDatabase();
}

main().catch(async (error) => {
  console.error('[DB] Test failed:');
  console.error(error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
