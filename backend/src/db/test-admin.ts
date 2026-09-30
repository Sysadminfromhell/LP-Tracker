import 'dotenv/config';
import { closeDatabase } from './client';
import { ensureInitialAdmin, getAdminCount } from './admins';
import { log } from '../utils/logging';

let caller = "ADMIN";

async function main(): Promise<void> {
  await ensureInitialAdmin();
  const count = await getAdminCount();
  log(caller,'info', `Admins in database: ${count}`);
}

main()
  .catch((error) => {
    log(caller,'error', ``);
    log(caller,'error', `Test failed:`);
    log(caller,'error', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
