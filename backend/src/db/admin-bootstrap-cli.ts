import { closeDatabase } from './client';
import { ensureInitialAdmin } from './admins';
import { log } from '../utils/logging';

let caller = 'ADMIN';

async function main(): Promise<void> {
  const admin = await ensureInitialAdmin();
  if (admin) {
    log(caller, 'info', `Bootstrap complete: "${admin.username}"`);
  } else {
    log(caller, 'info', `Bootstrap not required`);
  }
}
main()
  .catch((error) => {
    log(caller,'error','');
    log(caller,'error','Bootstrap failed:');
    log(caller,'error',error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
