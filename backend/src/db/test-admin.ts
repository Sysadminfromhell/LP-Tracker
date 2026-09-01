import 'dotenv/config';
import { closeDatabase } from './client';
import { ensureInitialAdmin, getAdminCount } from './admins';

async function main(): Promise<void> {
  await ensureInitialAdmin();
  const count = await getAdminCount();
  console.log(`[ADMIN] Admins in database: ${count}`);
}

main()
  .catch((error) => {
    console.error();
    console.error('[ADMIN] Test failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
