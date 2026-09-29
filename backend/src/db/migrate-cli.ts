import { closeDatabase, testDatabaseConnection } from './client';
import { runMigrations } from './migrations';
import { log } from '../utils/logging';

let caller = 'DB';

async function main(): Promise<void> {
  await testDatabaseConnection();
  await runMigrations();
}

main()
  .then(() => {
    log(caller, 'info', `Migration complete`);
  })
  .catch((error) => {
    log(caller, 'error', ``);
    log(caller, 'error', `Migration failed:`);
    log(caller, 'error', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
