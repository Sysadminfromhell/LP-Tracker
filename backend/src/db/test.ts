import { closeDatabase, testDatabaseConnection } from './client';
import { runMigrations } from './migrations';
import { log } from '../utils/logging';

let caller = 'CACHE';
async function main(): Promise<void> {
  await testDatabaseConnection();
  await runMigrations();
  await closeDatabase();
}

main().catch(async (error) => {
  log(caller,'error',`Test failed:`);
  log(caller,'error',error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
