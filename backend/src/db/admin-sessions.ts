import { createHash, randomBytes } from 'node:crypto';
import { db } from './client';
import type { Admin } from './admins';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export interface CreatedAdminSession {
  token: string;
  expiresAt: string;
}

interface SessionAdminRow {
  admin_id: string;
  username: string;
  enabled: boolean;
  admin_created_at: Date;
  admin_updated_at: Date;
  last_login_at: Date | null;
  expires_at: Date;
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createAdminSession(adminId: number): Promise<CreatedAdminSession> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.query(
    `
    INSERT INTO admin_sessions (
      admin_id,
      token_hash,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3
    )
    `,
    [adminId, tokenHash, expiresAt],
  );

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getAdminBySessionToken(token: string): Promise<Admin | null> {
  const tokenHash = hashSessionToken(token);
  const result = await db.query<SessionAdminRow>(
    `
      SELECT
        a.id AS admin_id,
        a.username,
        a.enabled,

        a.created_at AS admin_created_at,
        a.updated_at AS admin_updated_at,
        a.last_login_at,

        s.expires_at

      FROM admin_sessions s

      JOIN admins a
        ON a.id = s.admin_id

      WHERE
        s.token_hash = $1
        AND s.expires_at > NOW()
        AND a.enabled = TRUE

      LIMIT 1
      `,
    [tokenHash],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  /*
   * Session-Aktivität aktualisieren.
   */
  await db.query(
    `
    UPDATE admin_sessions
    SET
      last_used_at = NOW()
    WHERE token_hash = $1
    `,
    [tokenHash],
  );

  return {
    id: Number(row.admin_id),
    username: row.username,
    enabled: row.enabled,
    createdAt: row.admin_created_at.toISOString(),
    updatedAt: row.admin_updated_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

export async function deleteAdminSession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);

  await db.query(
    `
    DELETE FROM admin_sessions
    WHERE token_hash = $1
    `,
    [tokenHash],
  );
}

export async function deleteExpiredAdminSessions(): Promise<number> {
  const result = await db.query(
    `
      DELETE FROM admin_sessions
      WHERE expires_at <= NOW()
      `,
  );

  return result.rowCount ?? 0;
}
