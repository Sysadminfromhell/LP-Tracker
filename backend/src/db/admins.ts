import * as argon2 from 'argon2';
import { db } from './client';

export interface Admin {
  id: number;
  username: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface AdminRow {
  id: string;
  username: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

function mapAdmin(row: AdminRow): Admin {
  return {
    id: Number(row.id),
    username: row.username,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

export async function getAdminCount(): Promise<number> {
  const result = await db.query<{
    count: string;
  }>(
    `
      SELECT COUNT(*) AS count
      FROM admins
      `,
  );
  return Number(result.rows[0].count);
}

export async function findAdminByUsername(username: string): Promise<Admin | null> {
  const result = await db.query<AdminRow>(
    `
      SELECT
        id,
        username,
        enabled,
        created_at,
        updated_at,
        last_login_at
      FROM admins
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
      `,
    [username],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapAdmin(result.rows[0]);
}

export async function ensureInitialAdmin(): Promise<Admin | null> {
  const adminCount = await getAdminCount();
  if (adminCount > 0) {
    console.log(`[ADMIN] ${adminCount} admin account(s) found ✓`);
    return null;
  }
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username) {
    throw new Error('No admin exists and ADMIN_USERNAME is not configured');
  }
  if (!password) {
    throw new Error('No admin exists and ADMIN_PASSWORD is not configured');
  }
  if (username.length < 3) {
    throw new Error('ADMIN_USERNAME must contain at least 3 characters');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  }
  console.log(`[ADMIN] Creating initial admin "${username}"...`);
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });
  const result = await db.query<AdminRow>(
    `
      INSERT INTO admins (
        username,
        password_hash
      )
      VALUES (
        $1,
        $2
      )
      RETURNING
        id,
        username,
        enabled,
        created_at,
        updated_at,
        last_login_at
      `,
    [username, passwordHash],
  );
  const admin = mapAdmin(result.rows[0]);
  console.log(`[ADMIN] Initial admin "${admin.username}" created ✓`);
  return admin;
}

interface AdminAuthRow extends AdminRow {
  password_hash: string;
}

export async function authenticateAdmin(username: string, password: string): Promise<Admin | null> {
  const result = await db.query<AdminAuthRow>(
    `
      SELECT
        id,
        username,
        password_hash,
        enabled,
        created_at,
        updated_at,
        last_login_at
      FROM admins
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
      `,
    [username.trim()],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  if (!row.enabled) {
    return null;
  }

  const valid = await argon2.verify(row.password_hash, password);

  if (!valid) {
    return null;
  }

  await db.query(
    `
    UPDATE admins
    SET
      last_login_at = NOW()
    WHERE id = $1
    `,
    [row.id],
  );

  return mapAdmin({
    ...row,
    last_login_at: new Date(),
  });
}
