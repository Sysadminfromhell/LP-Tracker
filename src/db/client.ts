import 'dotenv/config';
import { Pool } from 'pg';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const port = Number(process.env.DATABASE_PORT ?? '5432');

if (!Number.isInteger(port) || port <= 0) {
  throw new Error('Invalid DATABASE_PORT');
}

export const db = new Pool({
  host: requireEnv('DATABASE_HOST'),
  port,
  database: requireEnv('DATABASE_NAME'),
  user: requireEnv('DATABASE_USER'),
  password: requireEnv('DATABASE_PASSWORD'),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on('error', (error) => {
  console.error('[DB] Unexpected pool error:', error);
});

export async function testDatabaseConnection(): Promise<void> {
  const client = await db.connect();

  try {
    const result = await client.query<{
      current_database: string;
      current_user: string;
    }>(
      `
                SELECT
                    current_database(),
                    current_user
                `,
    );

    const row = result.rows[0];

    console.log(`[DB] Connected as "${row.current_user}" to "${row.current_database}" ✓`);
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await db.end();
}
