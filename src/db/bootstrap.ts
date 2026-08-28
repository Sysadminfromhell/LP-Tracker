import 'dotenv/config';
import { Client } from 'pg';

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

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}

function quoteLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
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

  console.log('[DB] Connecting to PostgreSQL...');

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
    await admin.connect();

    console.log('[DB] PostgreSQL reachable ✓');

    const versionResult = await admin.query<{
      server_version: string;
    }>('SHOW server_version');

    console.log(`[DB] PostgreSQL ${versionResult.rows[0].server_version}`);

    const roleResult = await admin.query(
      `
                SELECT 1
                FROM pg_roles
                WHERE rolname = $1
                `,
      [databaseUser],
    );

    if (roleResult.rowCount === 0) {
      console.log(`[DB] Creating user "${databaseUser}"...`);

      await admin.query(
        `
                CREATE ROLE
                ${quoteIdentifier(databaseUser)}
                WITH
                LOGIN
                PASSWORD ${quoteLiteral(databasePassword)}
                `,
      );

      userCreated = true;

      console.log(`[DB] User "${databaseUser}" created ✓`);
    } else {
      console.log(`[DB] User "${databaseUser}" already exists ✓`);

      await admin.query(
        `
                ALTER ROLE
                ${quoteIdentifier(databaseUser)}
                WITH
                LOGIN
                PASSWORD ${quoteLiteral(databasePassword)}
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
      console.log(`[DB] Creating database "${databaseName}"...`);

      await admin.query(
        `
                CREATE DATABASE
                ${quoteIdentifier(databaseName)}
                OWNER
                ${quoteIdentifier(databaseUser)}
                `,
      );

      databaseCreated = true;

      console.log(`[DB] Database "${databaseName}" created ✓`);
    } else {
      console.log(`[DB] Database "${databaseName}" already exists ✓`);

      await admin.query(
        `
                ALTER DATABASE
                ${quoteIdentifier(databaseName)}
                OWNER TO
                ${quoteIdentifier(databaseUser)}
                `,
      );
    }

    console.log('[DB] Bootstrap complete ✓');

    return {
      databaseCreated,
      userCreated,
    };
  } finally {
    await admin.end().catch(() => {});
  }
}
