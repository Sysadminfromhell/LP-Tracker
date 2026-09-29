import fs from 'node:fs';
import path from 'node:path';
import { db } from './client';
import { log } from '../utils/logging';

let caller = 'DB';

interface AppliedMigration {
  name: string;
}

const MIGRATIONS_DIR = path.resolve('migrations');

async function ensureMigrationTable(): Promise<void> {
  await db.query(
    `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        `,
  );
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await db.query<AppliedMigration>(
    `
            SELECT name
            FROM schema_migrations
            `,
  );
  return new Set(result.rows.map((row) => row.name));
}

export async function runMigrations(): Promise<void> {
  log(caller, 'info', `Checking migrations...`);
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migration directory does not exist: ${MIGRATIONS_DIR}`);
  }
  await ensureMigrationTable();
  const applied = await getAppliedMigrations();
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  let appliedCount = 0;
  for (const file of migrationFiles) {
    if (applied.has(file)) {
      log(caller, 'info', `${file} already applied`);
      continue;
    }
    log(caller, 'info', `Applying ${file}...`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `
                INSERT INTO schema_migrations (
                    name
                )
                VALUES ($1)
                `,
        [file],
      );
      await client.query('COMMIT');
      appliedCount++;
      log(caller, 'info', `${file} successfully applied`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  if (appliedCount === 0) {
    log(caller, 'info', `Schema up to date`);
  } else {
    if (appliedCount == 1) {
      log(caller, 'info', `Applied ${appliedCount} migration`);
    } else {
      log(caller, 'info', `Applied ${appliedCount} migrations`);
    }
  }
}
