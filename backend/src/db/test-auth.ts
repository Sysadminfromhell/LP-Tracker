import 'dotenv/config';
import { closeDatabase } from './client';
import { authenticateAdmin } from './admins';
import { createAdminSession, deleteAdminSession, getAdminBySessionToken } from './admin-sessions';
import { log } from '../utils/logging';

let caller = 'AUTH';

async function main(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME or ADMIN_PASSWORD missing');
  }
  log(caller, 'info', `Testing login...`);
  const admin = await authenticateAdmin(username, password);
  if (!admin) {
    throw new Error('Login failed');
  }
  log(caller, 'info', `Logged in as "${admin.username}"`);
  log(caller, 'info', `Creating session...`);
  const session = await createAdminSession(admin.id);
  log(caller, 'info', `Session created`);
  const sessionAdmin = await getAdminBySessionToken(session.token);
  if (!sessionAdmin) {
    throw new Error('Could not resolve created session');
  }
  log(caller, 'info', `Session belongs to "${sessionAdmin.username}"`);
  await deleteAdminSession(session.token);
  log(caller, 'info', `Session deleted`);
  const afterDelete = await getAdminBySessionToken(session.token);
  if (afterDelete !== null) {
    throw new Error('Deleted session is still valid');
  }
  log(caller, 'info', `Deleted session rejected`);
}

main()
  .catch((error) => {
    log(caller, 'error', ``);
    log(caller, 'error', `Test failed:`);
    log(caller, 'error', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
