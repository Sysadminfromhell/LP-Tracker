import { closeDatabase, testDatabaseConnection } from './client';
import { runMigrations } from './migrations';

async function main(): Promise<void> {
  await testDatabaseConnection();
  await runMigrations();
}

main()
  .then(() => {
    console.log('[DB] Migration complete ✓');
  })
  .catch((error) => {
    console.error();
    console.error('[DB] Migration failed:');
    console.error(error instanceof Error ? error.message : error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
