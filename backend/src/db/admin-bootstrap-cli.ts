import { closeDatabase } from './client';
import { ensureInitialAdmin } from './admins';

async function main(): Promise<void> {
  const admin = await ensureInitialAdmin();
  if (admin) {
    console.log(`[ADMIN] Bootstrap complete: "${admin.username}"`);
  } else {
    console.log('[ADMIN] Bootstrap not required');
  }
}
main()
  .catch((error) => {
    console.error();
    console.error('[ADMIN] Bootstrap failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
