import 'dotenv/config';
import { Client, escapeIdentifier, escapeLiteral } from 'pg';
import { log } from '../utils/logging';

let caller = 'DB';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}
function getPort(): number {
  const raw = process.env.DATABASE_PORT ?? '5432';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid DATABASE_PORT: ${raw}`);
  }
  return port;
}

export interface DatabaseBootstrapResult {
  databaseCreated: boolean;
  userCreated: boolean;
}

export async function bootstrapDatabase(): Promise<DatabaseBootstrapResult> {
  const host = requireEnv('DATABASE_HOST');
  const port = getPort();
  const databaseName = requireEnv('DATABASE_NAME');
  const databaseUser = requireEnv('DATABASE_USER');
  const databasePassword = requireEnv('DATABASE_PASSWORD');
  const adminUser = requireEnv('DATABASE_ADMIN_USER');
  const adminPassword = requireEnv('DATABASE_ADMIN_PASSWORD');

  log(caller, 'info', `Connecting to PostgreSQL...`);

  const admin = new Client({
    host,
    port,
    database: 'postgres',
    user: adminUser,
    password: adminPassword,
  });

  let userCreated = false;
  let databaseCreated = false;

  try {
    log(
      caller,
      'dbg',
      `Connecting with ${databaseUser} to host ${host} via Port ${port} to Database ${databaseName}`,
    );
    await admin.connect();
    log(caller, 'info', `Successfully connected to PostgreSQL...`);
    const versionResult = await admin.query<{
      server_version: string;
    }>('SHOW server_version');
    log(caller, 'info', `PostgreSQL ${versionResult.rows[0].server_version}`);
    const roleResult = await admin.query(
      `
                SELECT 1
                FROM pg_roles
                WHERE rolname = $1
                `,
      [databaseUser],
    );
    if (roleResult.rowCount === 0) {
      log(caller, 'info', `Creating user "${databaseUser}"...`);
      await admin.query(
        `
                CREATE ROLE
                ${escapeIdentifier(databaseUser)}
                WITH
                LOGIN
                PASSWORD ${escapeLiteral(databasePassword)}
                `,
      );
      userCreated = true;
      log(caller, 'info', `User "${databaseUser}" created`);
    } else {
      log(caller, 'info', `User "${databaseUser}" already exists`);
      await admin.query(
        `
                ALTER ROLE
                ${escapeIdentifier(databaseUser)}
                WITH
                LOGIN
                PASSWORD ${escapeLiteral(databasePassword)}
                `,
      );
    }
    const databaseResult = await admin.query(
      `
                SELECT 1
                FROM pg_database
                WHERE datname = $1
                `,
      [databaseName],
    );
    if (databaseResult.rowCount === 0) {
      log(caller, 'info', `Creating database "${databaseName}"...`);
      await admin.query(
        `
                CREATE DATABASE
                ${escapeIdentifier(databaseName)}
                OWNER
                ${escapeIdentifier(databaseUser)}
                `,
      );
      databaseCreated = true;
      log(caller, 'info', `Database "${databaseName}" created`);
    } else {
      log(caller, 'info', `Database "${databaseName}" already exists`);
      await admin.query(
        `
                ALTER DATABASE
                ${escapeIdentifier(databaseName)}
                OWNER TO
                ${escapeIdentifier(databaseUser)}
                `,
      );
    }
    log(caller, 'info', `Bootstrap complete`);
    return {
      databaseCreated,
      userCreated,
    };
  } finally {
    await admin.end().catch(() => {});
  }
}
