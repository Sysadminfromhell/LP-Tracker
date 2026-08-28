import 'dotenv/config';
import { closeDatabase } from './client';
import { authenticateAdmin } from './admins';
import { createAdminSession, deleteAdminSession, getAdminBySessionToken } from './admin-sessions';

async function main(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME or ADMIN_PASSWORD missing');
  }
  console.log('[AUTH] Testing login...');
  const admin = await authenticateAdmin(username, password);
  if (!admin) {
    throw new Error('Login failed');
  }
  console.log(`[AUTH] Logged in as "${admin.username}" ✓`);
  console.log('[AUTH] Creating session...');
  const session = await createAdminSession(admin.id);
  console.log('[AUTH] Session created ✓');
  const sessionAdmin = await getAdminBySessionToken(session.token);
  if (!sessionAdmin) {
    throw new Error('Could not resolve created session');
  }
  console.log(`[AUTH] Session belongs to "${sessionAdmin.username}" ✓`);
  await deleteAdminSession(session.token);
  console.log('[AUTH] Session deleted ✓');
  const afterDelete = await getAdminBySessionToken(session.token);
  if (afterDelete !== null) {
    throw new Error('Deleted session is still valid');
  }
  console.log('[AUTH] Deleted session rejected ✓');
}

main()
  .catch((error) => {
    console.error();
    console.error('[AUTH] Test failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
